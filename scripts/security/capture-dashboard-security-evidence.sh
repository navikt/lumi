#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  cat <<'USAGE'
Usage:
  scripts/security/capture-dashboard-security-evidence.sh <environment> <base_url>

Example:
  scripts/security/capture-dashboard-security-evidence.sh dev https://lumi-dashboard.ansatt.dev.nav.no
  scripts/security/capture-dashboard-security-evidence.sh prod https://lumi-dashboard.ansatt.nav.no
USAGE
  exit 1
fi

ENVIRONMENT="$1"
BASE_URL="$2"
TIMESTAMP_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DATE_TAG="$(date -u +%Y-%m-%d)"
OUTPUT_DIR=".local-notes/security/evidence"
OUTPUT_FILE="${OUTPUT_DIR}/dashboard-security-evidence-${ENVIRONMENT}-${DATE_TAG}.md"

mkdir -p "${OUTPUT_DIR}"

capture_headers() {
  local url="$1"
  curl -sSI --max-time 20 "$url" || true
}

ROOT_HEADERS="$(capture_headers "${BASE_URL}/")"
METRICS_HEADERS="$(capture_headers "${BASE_URL}/api/internal/metrics")"
ALIVE_HEADERS="$(capture_headers "${BASE_URL}/api/internal/isAlive")"

{
  echo "# Dashboard security evidence (${ENVIRONMENT})"
  echo
  echo "- Captured: ${TIMESTAMP_UTC}"
  echo "- Base URL: ${BASE_URL}"
  echo
  echo "## 1) Response headers: /"
  echo '```http'
  echo "${ROOT_HEADERS}"
  echo '```'
  echo
  echo "## 2) Response headers: /api/internal/metrics"
  echo '```http'
  echo "${METRICS_HEADERS}"
  echo '```'
  echo
  echo "## 3) Response headers: /api/internal/isAlive"
  echo '```http'
  echo "${ALIVE_HEADERS}"
  echo '```'
  echo
  echo "## 4) Checklist"
  echo "- [ ] Strict-Transport-Security present"
  echo "- [ ] Content-Security-Policy present"
  echo "- [ ] X-Content-Type-Options present"
  echo "- [ ] Referrer-Policy present"
  echo "- [ ] Permissions-Policy present"
  echo "- [ ] X-Frame-Options present"
  echo "- [ ] /api/internal/metrics is blocked externally (non-200)"
} > "${OUTPUT_FILE}"

echo "Wrote ${OUTPUT_FILE}"
