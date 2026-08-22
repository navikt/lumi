#!/usr/bin/env bash

# Runs the browser-visible Lumi path against an isolated local Compose project:
# SurveyDocumentV1 widget -> submission proxy -> API -> Postgres -> dashboard.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="lumi-full-chain-smoke"
COMPOSE=(docker compose --project-name "$PROJECT_NAME" -f "$ROOT/docker-compose.yml")

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
wait_for "lumi-api" "http://127.0.0.1:8080/internal/isAlive"
wait_for "lumi-dashboard" "http://127.0.0.1:3000"
wait_for "lumi-local-demo" "http://127.0.0.1:3001/healthz"

cd "$ROOT"
pnpm run e2e:full-chain
