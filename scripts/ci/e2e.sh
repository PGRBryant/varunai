#!/usr/bin/env bash
set -euo pipefail

echo "Starting GCP e2e smoke checks"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found; ensure google-github-actions/setup-gcloud ran correctly"
  exit 2
fi

API_URL=$(gcloud run services describe varunai-api --region us-central1 --format 'value(status.url)')
echo "API URL: ${API_URL}"

echo "Checking API /health"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${API_URL}/health")
echo "Health returned HTTP ${STATUS}"
if [[ "${STATUS}" != "200" && "${STATUS}" != "503" ]]; then
  echo "API health check failed"
  exit 1
fi

HOSTING_URL="https://varunai-dashboard.web.app"
echo "Checking Hosting at ${HOSTING_URL}"
HOST_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${HOSTING_URL}")
echo "Hosting returned HTTP ${HOST_STATUS}"
if [[ "${HOST_STATUS}" != "200" ]]; then
  echo "Hosting check failed"
  exit 1
fi

echo "Checking sample API endpoint /api/flags"
FLAGS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${API_URL}/api/flags")
echo "/api/flags returned HTTP ${FLAGS_STATUS}"
if [[ "${FLAGS_STATUS}" != "200" ]]; then
  echo "/api/flags check failed"
  exit 1
fi

# Verika authenticated check
VERIKA_ENDPOINT=${VERIKA_ENDPOINT:-"https://verika-api-hdzhlg4y7a-ue.a.run.app"}
if [[ -z "${VERIKA_SERVICE_TOKEN:-}" ]]; then
  echo "VERIKA_SERVICE_TOKEN not set as env; attempting to read from Secret Manager"
  if gcloud secrets versions access latest --secret=VERIKA_SERVICE_TOKEN >/dev/null 2>&1; then
    VERIKA_SERVICE_TOKEN=$(gcloud secrets versions access latest --secret=VERIKA_SERVICE_TOKEN)
  else
    echo "No VERIKA_SERVICE_TOKEN available; skipping authenticated Verika check"
    exit 0
  fi
fi

echo "Checking Verika /health with provided token"
VERIKA_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${VERIKA_SERVICE_TOKEN}" "${VERIKA_ENDPOINT}/health")
echo "Verika /health returned HTTP ${VERIKA_STATUS}"
if [[ "${VERIKA_STATUS}" != "200" ]]; then
  echo "Authenticated Verika health check failed"
  exit 1
fi

echo "E2E smoke checks passed"
