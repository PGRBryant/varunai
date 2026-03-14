#!/usr/bin/env bash
# wind-up.sh — restore Varunai infrastructure at start of a work session.
#
# What this does:
#   1. Restores Varunai API to production-ready scaling and resources
#   2. Restores OTel Collector scaling
#   3. Restores any throttled GCP uptime checks to 60 s
#   4. Warms up key services with a health check
#
# Prerequisites: gcloud auth login (ADC), curl, node
# Usage: bash scripts/wind-up.sh

set -euo pipefail

PROJECT="varunai-490119"
REGION="us-central1"

echo "=== Varunai Wind-Up ==="
echo ""

# ── 1. Varunai API — restore production settings ────────────────────────────
echo "→ Restoring varunai-api to maxInstances=5, production resources..."
gcloud run services update varunai-api \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --max-instances=5 \
  --cpu=2 \
  --memory=1Gi \
  --quiet
echo "  ✓ varunai-api restored"
echo ""

# ── 2. OTel Collector — restore scaling ─────────────────────────────────────
echo "→ Restoring otel-collector to maxInstances=3..."
gcloud run services update otel-collector \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --max-instances=3 \
  --quiet 2>/dev/null && echo "  ✓ otel-collector restored" \
  || echo "  ⚠ otel-collector not deployed — skipping"
echo ""

# ── 3. Uptime checks → restore to 60 s ─────────────────────────────────────
echo "→ Checking for throttled uptime monitors to restore..."
ACCESS_TOKEN=$(gcloud auth print-access-token)

CHECKS=$(curl -sf \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://monitoring.googleapis.com/v3/projects/${PROJECT}/uptimeCheckConfigs" \
  | node -e "
    const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    (d.uptimeCheckConfigs || []).forEach(c => console.log(c.name));
  " 2>/dev/null || true)

if [ -z "${CHECKS}" ]; then
  echo "  (no uptime checks configured — nothing to restore)"
else
  while IFS= read -r check; do
    display=$(basename "${check}")
    echo "  → Restoring ${display} to period=60s..."
    curl -sf -X PATCH \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"period":"60s"}' \
      "https://monitoring.googleapis.com/v3/${check}?updateMask=period" \
      > /dev/null
    echo "    ✓ Done"
  done <<< "${CHECKS}"
fi

echo ""

# ── 4. Warm up services ─────────────────────────────────────────────────────
echo "→ Warming up services..."
VARUNAI_URL=$(gcloud run services describe varunai-api \
  --project="${PROJECT}" --region="${REGION}" \
  --format="value(status.url)" 2>/dev/null)

if [ -n "${VARUNAI_URL}" ]; then
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${VARUNAI_URL}/health" || echo "timeout")
  echo "  ✓ varunai-api: HTTP ${STATUS}"
else
  echo "  ⚠ varunai-api URL not found — skipping warm-up"
fi

echo ""
echo "=== Wind-up complete ==="
echo "Varunai API will be warm within ~10 s."
