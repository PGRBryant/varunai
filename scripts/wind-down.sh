#!/usr/bin/env bash
# wind-down.sh — scale down Varunai infrastructure at end of a work session.
#
# What this does:
#   1. Scales Varunai API, OTel Collector, and Grafana to maxInstances=1
#      (they already have minInstances=0 so they'll drain to zero on idle)
#   2. Reduces Varunai API CPU/memory to economy settings
#   3. Throttles any GCP uptime checks to 1 h (prevents keepalive cold-starts)
#
# All Cloud Run services in this project use minInstances=0 (scale-to-zero),
# so the main cost driver is keepalive traffic and over-provisioned limits.
#
# Prerequisites: gcloud auth login (ADC), curl, node
# Usage: bash scripts/wind-down.sh

set -euo pipefail

PROJECT="varunai-490119"
REGION="us-central1"

echo "=== Varunai Wind-Down ==="
echo ""

# ── 1. Varunai API — reduce headroom ────────────────────────────────────────
echo "→ Scaling varunai-api to maxInstances=1, economy resources..."
gcloud run services update varunai-api \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --max-instances=1 \
  --cpu=1 \
  --memory=512Mi \
  --quiet
echo "  ✓ varunai-api scaled down"
echo ""

# ── 2. OTel Collector — reduce headroom ─────────────────────────────────────
echo "→ Scaling otel-collector to maxInstances=1..."
gcloud run services update otel-collector \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --max-instances=1 \
  --quiet 2>/dev/null && echo "  ✓ otel-collector scaled down" \
  || echo "  ⚠ otel-collector not deployed — skipping"
echo ""

# ── 3. Grafana — already maxInstances=1, just confirm ───────────────────────
echo "→ Confirming grafana at maxInstances=1..."
gcloud run services update grafana \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --max-instances=1 \
  --quiet 2>/dev/null && echo "  ✓ grafana confirmed" \
  || echo "  ⚠ grafana not deployed — skipping"
echo ""

# ── 4. Uptime checks → throttle to 1 h ─────────────────────────────────────
echo "→ Checking for uptime monitors to throttle..."
ACCESS_TOKEN=$(gcloud auth print-access-token)

CHECKS=$(curl -sf \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://monitoring.googleapis.com/v3/projects/${PROJECT}/uptimeCheckConfigs" \
  | node -e "
    const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    (d.uptimeCheckConfigs || []).forEach(c => console.log(c.name));
  " 2>/dev/null || true)

if [ -z "${CHECKS}" ]; then
  echo "  (no uptime checks configured — nothing to throttle)"
else
  while IFS= read -r check; do
    display=$(basename "${check}")
    echo "  → Throttling ${display} to period=3600s..."
    curl -sf -X PATCH \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"period":"3600s"}' \
      "https://monitoring.googleapis.com/v3/${check}?updateMask=period" \
      > /dev/null
    echo "    ✓ Done"
  done <<< "${CHECKS}"
fi

echo ""
echo "=== Wind-down complete ==="
echo "All services will drain to zero on their own (minInstances=0)."
echo "Run scripts/wind-up.sh at the start of your next session."
