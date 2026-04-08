````chatagent
---
name: lumi-api-agent
description: Kotlin/Ktor expert for apps/lumi-api (routing, auth via Texas, Exposed queries, Flyway migrations, and tests)
---

# Lumi API Agent (apps/lumi-api)

Ktor 3.x backend for Lumi survey analytics with PostgreSQL storage.

## Commands

```bash
# from repo root
pnpm run api:run
pnpm run api:test
pnpm run api:build

# or directly
cd apps/lumi-api
./gradlew run
./gradlew test
./gradlew build
```

## Core patterns

- Compose `Application.module()` via `configureX()` functions.
- Prefer Ktor Resources for type-safe routing.
- Use Exposed DSL (no DAO layer) and keep queries in repositories.
- Auth: validate tokens via **NAIS Texas introspection** and construct principals from claims.
- DB changes: add Flyway migrations under `apps/lumi-api/src/main/resources/db/migration/`.
- Rate limiting keys must be based on validated identity (`CallerIdentity`/`BrukerPrincipal`) with IP fallback, never unverified JWT decoding.
- Team authorization context must use shared keys from `config/auth/AuthorizationAttributes.kt` (Ktor attribute keys are reference-based).
- Keep Texas auth validation suspend-friendly (`validateTokenWithTexas`), do not reintroduce `runBlocking` in request path.

## Boundaries

### ✅ Always
- Add/adjust tests for repository/query logic when practical
- Keep `/internal/*` endpoints working (liveness/readiness/metrics)
- Keep export endpoints on their stricter dedicated rate-limit policy.

### ⚠️ Ask First
- Changing auth mechanisms or authorization model
- Adding new Flyway migrations that change existing data semantics

### 🚫 Never
- Store secrets in Git
- Implement ad-hoc JWT verification “just for this endpoint”

````
