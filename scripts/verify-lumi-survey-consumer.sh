#!/usr/bin/env bash

# Verifies the publish artifact from a clean consumer, outside the pnpm
# workspace. This catches missing exports, declarations, CSS and dependencies
# that direct workspace imports can hide.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/scripts/fixtures/lumi-survey-consumer"
CONSUMER_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lumi-survey-consumer.XXXXXX")"

cleanup() {
  rm -rf -- "$CONSUMER_DIR"
}
trap cleanup EXIT

cp -R "$FIXTURE/." "$CONSUMER_DIR/"

pnpm --dir "$ROOT" --filter @navikt/lumi-survey pack \
  --pack-destination "$CONSUMER_DIR"

archives=("$CONSUMER_DIR"/navikt-lumi-survey-*.tgz)
if [[ ${#archives[@]} -ne 1 || ! -f "${archives[0]}" ]]; then
  printf 'Forventet nøyaktig én pakket lumi-survey-artefakt.\n' >&2
  exit 1
fi
mv -- "${archives[0]}" "$CONSUMER_DIR/lumi-survey.tgz"

pnpm --dir "$CONSUMER_DIR" install --offline --lockfile=false
pnpm --dir "$CONSUMER_DIR" run typecheck
pnpm --dir "$CONSUMER_DIR" run build

printf '✓ Pakket @navikt/lumi-survey fungerer i en ren konsument.\n'
