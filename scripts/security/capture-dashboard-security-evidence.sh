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

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

ENVIRONMENT="$1"
BASE_URL="${2%/}"
TIMESTAMP_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DATE_TAG="$(date -u +%Y-%m-%d)"
OUTPUT_DIR="${REPO_ROOT}/.local-notes/security/evidence"
OUTPUT_FILE="${OUTPUT_DIR}/dashboard-security-evidence-${ENVIRONMENT}-${DATE_TAG}.md"

mkdir -p "${OUTPUT_DIR}"

capture_headers() {
  local url="$1"
  curl -sSI --max-time 20 "$url" || true
}

extract_status_code() {
  local headers="$1"
  printf '%s\n' "${headers}" | sed -nE 's#^HTTP/[0-9.]+[[:space:]]+([0-9]{3}).*$#\1#p' | head -n 1
}

header_present() {
  local headers="$1"
  local header_name="$2"
  if printf '%s\n' "${headers}" | grep -qi "^${header_name}:"; then
    echo "true"
  else
    echo "false"
  fi
}

checkbox() {
  local value="$1"
  if [[ "${value}" == "true" ]]; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

ROOT_HEADERS="$(capture_headers "${BASE_URL}/")"
METRICS_HEADERS="$(capture_headers "${BASE_URL}/api/internal/metrics")"
ALIVE_HEADERS="$(capture_headers "${BASE_URL}/api/internal/isAlive")"

ROOT_STATUS_CODE="$(extract_status_code "${ROOT_HEADERS}")"
METRICS_STATUS_CODE="$(extract_status_code "${METRICS_HEADERS}")"
ALIVE_STATUS_CODE="$(extract_status_code "${ALIVE_HEADERS}")"

HSTS_PRESENT="$(header_present "${ROOT_HEADERS}" "strict-transport-security")"
CSP_PRESENT="$(header_present "${ROOT_HEADERS}" "content-security-policy")"
XCTO_PRESENT="$(header_present "${ROOT_HEADERS}" "x-content-type-options")"
REFERRER_PRESENT="$(header_present "${ROOT_HEADERS}" "referrer-policy")"
PERMISSIONS_PRESENT="$(header_present "${ROOT_HEADERS}" "permissions-policy")"
XFO_PRESENT="$(header_present "${ROOT_HEADERS}" "x-frame-options")"

if [[ -n "${METRICS_STATUS_CODE}" && "${METRICS_STATUS_CODE}" != "200" ]]; then
  METRICS_BLOCKED="true"
else
  METRICS_BLOCKED="false"
fi

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
  echo "- $(checkbox "${HSTS_PRESENT}") Strict-Transport-Security present"
  echo "- $(checkbox "${CSP_PRESENT}") Content-Security-Policy present"
  echo "- $(checkbox "${XCTO_PRESENT}") X-Content-Type-Options present"
  echo "- $(checkbox "${REFERRER_PRESENT}") Referrer-Policy present"
  echo "- $(checkbox "${PERMISSIONS_PRESENT}") Permissions-Policy present"
  echo "- $(checkbox "${XFO_PRESENT}") X-Frame-Options present"
  echo "- $(checkbox "${METRICS_BLOCKED}") /api/internal/metrics is blocked externally (non-200)"
  echo
  echo "## 5) Status summary"
  echo "- / status code: ${ROOT_STATUS_CODE:-unknown}"
  echo "- /api/internal/metrics status code: ${METRICS_STATUS_CODE:-unknown}"
  echo "- /api/internal/isAlive status code: ${ALIVE_STATUS_CODE:-unknown}"
  if [[ "${ROOT_STATUS_CODE:-}" != "200" ]]; then
    echo
    echo "> Note: / returned ${ROOT_STATUS_CODE:-unknown}. If this is login redirect/unauthenticated response, capture headers from an authenticated 200 document request in browser DevTools and paste below."
  fi
} > "${OUTPUT_FILE}"

echo "Wrote ${OUTPUT_FILE}"
