#!/usr/bin/env bash

# Runs the browser-visible Lumi path against an isolated local Compose project:
# Survey widget (DocumentV1 + legacy-flat) -> proxy -> API -> Postgres -> dashboard.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="lumi-full-chain-smoke"
COMPOSE=(docker compose --project-name "$PROJECT_NAME" -f "$ROOT/docker-compose.yml")
API_HOST_PORT="${LUMI_API_HOST_PORT:-8080}"
SUBMISSION_PROXY_HOST_PORT="${LUMI_SUBMISSION_PROXY_HOST_PORT:-8081}"
DASHBOARD_HOST_PORT="${LUMI_DASHBOARD_HOST_PORT:-3000}"
DEMO_HOST_PORT="${LUMI_DEMO_HOST_PORT:-3001}"

export LUMI_DASHBOARD_URL="${LUMI_DASHBOARD_URL:-http://127.0.0.1:$DASHBOARD_HOST_PORT}"
export LUMI_DEMO_URL="${LUMI_DEMO_URL:-http://127.0.0.1:$DEMO_HOST_PORT}"

if [[ -z "${NPM_AUTH_TOKEN:-}" ]]; then
  printf 'NPM_AUTH_TOKEN må være satt for å bygge workspace-imagene.\n' >&2
  exit 1
fi

cleanup() {
  local status=$?
  trap - EXIT

  if [[ $status -ne 0 ]]; then
    printf '\nFullkjedetesten feilet. Compose-logger:\n' >&2
    "${COMPOSE[@]}" logs --no-color >&2 || true
  fi

  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

wait_for() {
  local name=$1
  local url=$2

  for attempt in $(seq 1 60); do
    if curl --fail --silent --show-error --max-time 2 --output /dev/null "$url"; then
      printf '✓ %s er klar\n' "$name"
      return 0
    fi
    if [[ $attempt -eq 60 ]]; then
      printf '%s ble ikke klar innen fire minutter (%s).\n' "$name" "$url" >&2
      return 1
    fi
    sleep 2
  done
}

"${COMPOSE[@]}" up --detach --build
wait_for "lumi-api" "http://127.0.0.1:$API_HOST_PORT/internal/isAlive"
wait_for "lumi-submission-proxy" "http://127.0.0.1:$SUBMISSION_PROXY_HOST_PORT/internal/isReady"
wait_for "lumi-dashboard" "$LUMI_DASHBOARD_URL"
wait_for "lumi-local-demo" "$LUMI_DEMO_URL/healthz"

cd "$ROOT"
pnpm run e2e:full-chain
