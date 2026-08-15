# Local development scripts

## Full-chain-demo med ekte widget

`docker-compose.yml` starter hele den lokale kjeden:

```text
localhost:3001 (testbenk + lumi-survey)
  -> submission-proxy
  -> lumi-api
  -> Postgres
  -> localhost:3000 (dashboard uten mock-data)
```

### Oppstart

Forutsetninger er Docker og en GitHub Packages-token i `NPM_AUTH_TOKEN`.
Tokenet sendes som en BuildKit-secret og lagres ikke i image-lagene. De lokale
image-filene bruker offentlige Chainguard-basebilder, så NAV-registertilgang er
ikke nødvendig:

```bash
export NPM_AUTH_TOKEN="$(gh auth token)"
```

Start alt fra repo-roten:

```bash
npm run local:up
```

Første bygg laster ned Node-/JVM-avhengigheter og tar noen minutter. Når
containerne er klare:

1. Åpne <http://localhost:3001>.
2. Velg et scenario og send inn widgeten nederst til høyre.
3. Bruk «Åpne resultat i dashboard» eller gå til <http://localhost:3000>.
4. Velg teamet `local-dev` og surveyen med prefiks `local-demo-`.

Data ligger i Docker-volumet `lumi-postgres-data` og overlever vanlig restart.
Ingen seed-data er nødvendig; hver ekte innsending blir demoens datagrunnlag.

### Dekningsmatrise

Hvert scenario bruker en egen, stabil `surveyId` slik at API-ens immutable
definisjonskontroll også testes. Testbenken dekker:

| Scenario | Surveytype | Felt/variant |
| --- | --- | --- |
| Rating · emoji | `rating` | `rating/emoji`, `text`, `visibleIf` |
| Rating · tommel | `rating` | `rating/thumbs`, `text` |
| Rating · stjerner | `rating` | `rating/stars`, `text` |
| Rating · NPS | `rating` | `rating/nps`, `text` |
| Discovery | `discovery` | `text`, `singleChoice` |
| Top Tasks | `topTasks` | `singleChoice`, `text`, branching/early submit |
| Task Priority · avkryssing | `taskPriority` | `multiChoice/checkbox` |
| Task Priority · komboboks | `taskPriority` | `multiChoice/combobox` |
| Custom · feltmatrise | `custom` | `text`, `singleChoice`, `multiChoice` |

### Lokal auth

API, proxy og dashboard krever eksplisitt `LUMI_LOCAL_AUTH_BYPASS=true` i
Compose. Bypassen aktiveres bare uten `NAIS_CLUSTER_NAME`; proxyen og API-et
nekter å starte lokalt uten opt-in. Dashboardet sender en ikke-hemmelig
`Bearer local-dev` til API-ets lokale auth-realm. Dette oppsettet må aldri
eksponeres utenfor lokal maskin. Compose binder derfor alle publiserte porter
til `127.0.0.1`.

### Teardown

```bash
npm run local:down   # behold data
npm run local:reset  # slett også Postgres-volumet
```

## Local end-to-end submission flow

Test the **whole** Lumi submission chain locally — widget-shaped payload → API
parsing → v1/v2 dispatch → immutable definition + deduplication → Postgres
persistence — without any real TokenX/Azure token.

This works because lumi-api runs in **local mode** when `NAIS_CLUSTER_NAME` is
absent **and** `LUMI_LOCAL_AUTH_BYPASS=true` is set: submission auth is disabled
entirely — the plugin assigns a mock identity (`team=local-dev`) *without inspecting
the `Authorization` header at all*. The smoke test still sends `Bearer local-dev`,
but no token is actually required. Both `docker compose` and `./gradlew run` set the
flag for you; the bypass is **fail-closed**, so if the flag is missing in local mode
the app refuses to start. Deployed environments always have `NAIS_CLUSTER_NAME`, so
the bypass never activates there. See
`apps/lumi-api/src/main/kotlin/no/nav/lumi/config/auth/SubmissionAuthPlugin.kt` and
`config/ServerEnv.kt`.

### Steps

**Option A — API-stack in containers:**

The local-only image uses Chainguard's public non-root JRE. The deployed image
continues to use NAV's private, versioned JRE.

```bash
docker compose up -d --build postgres api
./scripts/lumi-local-smoke.sh         # waits for the API, then runs the flow
```

**Option B — database in a container, API on the host (faster iteration):**

```bash
docker compose up -d postgres
cd apps/lumi-api && ./gradlew run     # Flyway migrates on boot
./scripts/lumi-local-smoke.sh         # in another terminal
```

Both give "local mode" (auth disabled). The API reads `DB_*` env vars, so the
container points at the `postgres` service while the host falls back to
`localhost:5432`.

The smoke test walks the full rollout lifecycle on a single `surveyId` and
prints the resulting DB rows:

| Scenario | Expected |
| --- | --- |
| Legacy `schemaVersion: 1` submission | `201 Created` — existing widgets still work; registers an `auto` definition |
| `schemaVersion: 2` compatible takeover | `201 Created` — definition promoted `auto` → `api` |
| Same `deduplicationKey` again | `200 OK` (deduplicated, no new row) |
| Structural change, same `surveyId` | `409 Conflict` (immutable definition guard) |

> Requires port `5432` to be free. If you already run a local Postgres, stop it
> or change the published port in `docker-compose.yml`.

### Manual curl

`fixtures/v2-feedback.example.json` is a ready-to-send v2 payload:

```bash
curl -X POST http://localhost:8080/api/tokenx/v1/feedback \
  -H 'Authorization: Bearer local-dev' \
  -H 'Content-Type: application/json' \
  --data-binary @scripts/fixtures/v2-feedback.example.json
```

### Teardown

```bash
docker compose down          # stop Postgres, keep data volume
docker compose down -v       # also drop the data volume (fresh schema next time)
```
