#!/usr/bin/env bash
# wind-down.sh — scale down Varunai infrastructure at end of a work session.
#
# What this does:
#   1. Scales Varunai API, OTel Collector, and Grafana to maxInstances=1
#      (they already have minInstances=0 so they'll drain to zero on idle)
#   2. Reduces Varunai API CPU/memory to economy settings
#
# Uptime checks have been removed from Terraform to prevent keepalive
# cold-starts. Services now truly scale to zero when idle.
#
# Prerequisites: gcloud auth login (ADC)
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
echo "=== Wind-down complete ==="
echo "All services will drain to zero on their own (minInstances=0)."
echo "No uptime checks — services stay at zero until the dashboard is opened."
echo "Run scripts/wind-up.sh at the start of your next session."
