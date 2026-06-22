# Local development scripts

## Local end-to-end submission flow

Test the **whole** Lumi submission chain locally — widget-shaped payload → API
parsing → v1/v2 dispatch → immutable definition + deduplication → Postgres
persistence — without any real TokenX/Azure token.

This works because lumi-api runs in **local mode** when `NAIS_CLUSTER_NAME` is
absent: authentication is disabled and any non-empty `Authorization: Bearer <x>`
is mapped to a mock identity (`team=local-dev`). See
`apps/lumi-api/src/main/kotlin/no/nav/lumi/config/Auth.kt` and
`config/auth/SubmissionAuthPlugin.kt`. **This bypass is fail-safe**: deployed
environments always have `NAIS_CLUSTER_NAME`, so real Texas auth is always used
there.

### Steps

**Option A — whole stack in containers (one command):**

> **Prerequisite:** the api image runs on the same Chainguard JRE as production,
> pulled from NAV's registry. Authenticate once with
> `gcloud auth configure-docker europe-north1-docker.pkg.dev` (needs cgr-nav
> access). Option B builds no image and skips this.

```bash
docker compose up -d --build          # postgres + api (first build takes a few min)
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
