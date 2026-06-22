#!/usr/bin/env bash
#
# Local end-to-end smoke test for the Lumi submission flow.
#
# Exercises REAL widget-shaped payloads against a locally-running lumi-api (auth
# disabled in local mode) and a Postgres from docker-compose, then prints the
# resulting database rows. No real TokenX/Azure token is required.
#
# Walks the full rollout lifecycle on a single surveyId:
#   1. v1 submission                  -> 201  (legacy widget still works; AUTO definition)
#   2. v2 compatible takeover         -> 201  (AUTO -> API promotion)
#   3. v2 same deduplicationKey again -> 200  (deduplicated, no new row)
#   4. v2 structural change           -> 409  (immutable definition guard)
#
# Prerequisites (the script checks these for you):
#   - docker compose available
#   - lumi-api running on the host:  (cd apps/lumi-api && ./gradlew run)
#
# Usage:  scripts/lumi-local-smoke.sh
set -euo pipefail

API="${LUMI_API_URL:-http://localhost:8080}"
ENDPOINT="$API/api/tokenx/v1/feedback"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.yml"
SURVEY_ID="local-smoke-$(date +%Y%m%d-%H%M%S)-${RANDOM}"   # unique per run
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

note()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m  ✓ %s\033[0m\n' "$1"; }
bad()   { printf '\033[1;31m  ✗ %s\033[0m\n' "$1"; }
die()   { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

FAILED=0

# survey_id is passed as a psql variable (:'survey_id'), never interpolated into
# the SQL string — keeps the repo's "no SQL string-interpolation" rule intact.
psql_q()    { $COMPOSE exec -T postgres psql -U lumi -d lumi -v survey_id="$SURVEY_ID" -At -c "$1"; }
def_source(){ psql_q "SELECT source FROM survey_definitions WHERE survey_id = :'survey_id';"; }

post() { # $1 = json file -> echoes HTTP status, body in $TMP/body
  curl -s -o "$TMP/body" -w '%{http_code}' \
    -X POST "$ENDPOINT" \
    -H 'Authorization: Bearer local-dev' \
    -H 'Content-Type: application/json' \
    --data-binary "@$1"
}

expect() { # $1 = actual, $2 = expected, $3 = label
  if [ "$1" = "$2" ]; then ok "$3 -> HTTP $1"; else
    bad "$3 -> HTTP $1 (forventet $2)"; printf '    body: %s\n' "$(cat "$TMP/body")"; FAILED=1
  fi
}

check() { # $1 = actual, $2 = expected, $3 = label
  if [ "$1" = "$2" ]; then ok "$3 = $1"; else bad "$3 = $1 (forventet $2)"; FAILED=1; fi
}

# --- payload builders ---------------------------------------------------------
payload_v1() { # legacy widget: no definition block, no deduplicationKey
  cat <<JSON
{
  "schemaVersion": 1,
  "surveyId": "$SURVEY_ID",
  "surveyType": "rating",
  "submittedAt": "2026-06-20T12:00:00.000Z",
  "answers": [
    { "fieldId": "rating", "fieldType": "RATING", "question": { "label": "Hvordan var opplevelsen?" },
      "value": { "type": "rating", "rating": 4, "ratingVariant": "stars", "ratingScale": 5 } },
    { "fieldId": "feedback", "fieldType": "TEXT", "question": { "label": "Begrunnelse" },
      "value": { "type": "text", "text": "v1 smoke" } }
  ]
}
JSON
}

payload_v2() { # $1 = deduplicationKey, $2 = ratingVariant
  cat <<JSON
{
  "schemaVersion": 2,
  "surveyId": "$SURVEY_ID",
  "surveyType": "rating",
  "submittedAt": "2026-06-20T12:00:00.000Z",
  "deduplicationKey": "$1",
  "definition": {
    "surveyType": "rating",
    "fields": [
      { "fieldId": "rating", "fieldType": "RATING", "ratingVariant": "$2", "ratingScale": 5 },
      { "fieldId": "feedback", "fieldType": "TEXT" }
    ]
  },
  "answers": [
    { "fieldId": "rating", "fieldType": "RATING", "question": { "label": "Hvordan var opplevelsen?" },
      "value": { "type": "rating", "rating": 4, "ratingVariant": "$2", "ratingScale": 5 } },
    { "fieldId": "feedback", "fieldType": "TEXT", "question": { "label": "Begrunnelse" },
      "value": { "type": "text", "text": "v2 smoke" } }
  ]
}
JSON
}

# --- 1. Postgres --------------------------------------------------------------
note "1/8  Postgres (docker-compose)"
$COMPOSE up -d postgres >/dev/null
for i in $(seq 1 20); do
  if $COMPOSE exec -T postgres pg_isready -U lumi -d lumi >/dev/null 2>&1; then ok "Postgres oppe"; break; fi
  [ "$i" = "20" ] && die "Postgres ble ikke klar i tide"
  sleep 2
done

# --- 2. API health ------------------------------------------------------------
note "2/8  lumi-api ($API)"
# Poll, don't assume: with `docker compose up -d` the api container may still be
# booting (Ktor + Flyway) when this runs. Retry for ~60s before giving up.
for i in $(seq 1 30); do
  curl -fsS --max-time 3 -o /dev/null "$API/internal/isAlive" 2>/dev/null && break
  [ "$i" = "30" ] && die "lumi-api svarer ikke på /internal/isAlive etter ~60s.\n  Start den i et eget terminalvindu:\n    cd apps/lumi-api && ./gradlew run"
  sleep 2
done
ok "lumi-api oppe (/internal/isAlive)"
printf '  surveyId for denne kjøringen: \033[1m%s\033[0m\n' "$SURVEY_ID"

# --- 3. v1 submission -> 201 (backward-compat) --------------------------------
note "3/8  Legacy v1-innsending (eksisterende widget)"
payload_v1 > "$TMP/v1.json"
expect "$(post "$TMP/v1.json")" "201" "v1-innsending"

# --- 4. AUTO definition registered --------------------------------------------
note "4/8  v1 registrerte en AUTO-definisjon"
check "$(def_source)" "auto" "survey_definitions.source"

# --- 5. v2 compatible takeover -> 201 (AUTO -> API) ---------------------------
note "5/8  v2 tar over kompatibelt (AUTO -> API)"
payload_v2 "local-smoke-key-aaaaaaaa" "stars" > "$TMP/v2ok.json"
expect "$(post "$TMP/v2ok.json")" "201" "v2-overtakelse"
check "$(def_source)" "api" "survey_definitions.source"

# --- 6. duplicate -> 200 ------------------------------------------------------
note "6/8  Samme deduplicationKey igjen (dedup)"
expect "$(post "$TMP/v2ok.json")" "200" "v2-duplikat"

# --- 7. structural change -> 409 ----------------------------------------------
note "7/8  Endret definisjon, samme surveyId (immutability)"
payload_v2 "local-smoke-key-bbbbbbbb" "emoji" > "$TMP/v2bad.json"  # stars -> emoji
expect "$(post "$TMP/v2bad.json")" "409" "Strukturendring"
printf '    melding: %s\n' "$(cat "$TMP/body")"

# --- 8. database rows ---------------------------------------------------------
note "8/8  Rader i databasen for $SURVEY_ID"
echo "  feedback:"
psql_q "SELECT id, team, app, survey_id, definition_hash, deduplication_key_hash
        FROM feedback WHERE survey_id = :'survey_id' ORDER BY opprettet;" | sed 's/^/    /'
echo "  survey_definitions:"
psql_q "SELECT survey_id, team, source, definition_hash
        FROM survey_definitions WHERE survey_id = :'survey_id';" | sed 's/^/    /'

FB_COUNT="$(psql_q "SELECT count(*) FROM feedback WHERE survey_id = :'survey_id';")"
note "Oppsummering"
# v1 (1) + v2 takeover (1) persist; dedup (0) and 409 (0) do not -> 2 rows
check "$FB_COUNT" "2" "feedback-rader"

if [ "$FAILED" = "0" ]; then
  printf '\n\033[1;32m✓ Lokal ende-til-ende-flyt OK (v1 + v2 + promotering + dedup + immutability)\033[0m\n'
else
  die "Én eller flere sjekker feilet (se over)"
fi
