# Lumi Codebase Review and Implementation Plan

## Scope
- Full monorepo: API, dashboard, survey package, CI/CD, NAIS manifests, Dockerfiles.
- Focus: authn/authz, PII handling, data integrity, reliability/ops, testing, CI/CD hygiene.

## Findings

### P0
- None identified in this pass.

### P1
- **No explicit request size limit on submission endpoints.**
  - Risk: oversized payloads can increase memory pressure and slow down parsing.
  - Evidence: `apps/lumi-api/src/main/kotlin/no/nav/lumi/routes/SubmissionRoutes.kt` uses `call.receiveText()` without a size guard.
- **CORS behavior is implicit (no explicit CORS config).**
  - Risk: unclear policy; if a browser client ever calls the API directly, CORS may be misconfigured by default.
  - Evidence: no CORS plugin configuration found in `apps/lumi-api/src/main/kotlin/no/nav/lumi/config`.
- **Rate limiting key uses `X-Forwarded-For` without validation.**
  - Risk: spoofable header outside trusted ingress; likely ok behind NAIS, but should be explicit.
  - Evidence: `apps/lumi-api/src/main/kotlin/no/nav/lumi/config/RateLimiting.kt`.

### P2
- **`feedback_json` stored as TEXT with repeated JSON casts.**
  - Risk: query performance and indexing constraints for analytics filters.
  - Evidence: `apps/lumi-api/src/main/resources/db/migration/V1__Initial_schema.sql`, JSON extraction in `apps/lumi-api/src/main/kotlin/no/nav/lumi/repository/FeedbackRepository.kt`.
- **Limited supply-chain/security automation in CI.**
  - Risk: slower detection of vulnerable deps.
  - Evidence: `.github/workflows/ci.yaml` lacks CodeQL/Dependabot/Renovate or container scanning.
- **Dashboard allows all NAV users at Azure level; access is enforced in API.**
  - Risk: wider login surface, even if API blocks non-authorized teams.
  - Evidence: `apps/lumi-dashboard/nais/prod.yaml` (`allowAllUsers: true`) and API team enforcement in `apps/lumi-api/src/main/kotlin/no/nav/lumi/config/auth/TeamAuthorizationPlugin.kt`.

## Implementation Plan (proposal)

### Phase 0 — Decisions (1–2 days)
1. **Confirm CORS policy** for API:
   - If API is server-to-server only, explicitly configure CORS to reject browser origins.
   - If browser access is allowed, define allowed origins and methods.
2. **Define maximum submission payload size** for `POST /api/*/v1/feedback`.
3. **Decide on dashboard access posture**:
   - Keep `allowAllUsers: true` with API team gating, or tighten Azure access with groups.

### Phase 1 — Security & Robustness (short, 1–2 days)
1. **Add request size limit** for submission routes.
   - Prefer a Ktor body-size limiter or a request pipeline guard that rejects oversized payloads early.
2. **Make CORS policy explicit** in API config (even if “deny all”).
3. **Harden rate-limit keying**:
   - Trust `X-Forwarded-For` only behind known ingress; otherwise fall back to remote address.

### Phase 2 — Data & Performance (medium, 3–5 days)
1. **Evaluate migrating `feedback_json` to JSONB** and add indexes for common paths.
   - Consider GIN indexes for JSON fields used in filters and stats.
2. **Add performance notes/tests** for tag filtering and full-text search on `feedback_tag`.

### Phase 3 — CI/CD & Ops Hygiene (medium, 2–4 days)
1. **Add dependency scanning** (Dependabot or Renovate).
2. **Add CodeQL or SAST** for Kotlin/TypeScript.
3. **Optional**: container scanning for built images.

## Verification Plan
- **Security**: confirm explicit CORS behavior in lower envs; check request-size rejection returns clear 4xx.
- **Functional**: existing API tests pass; add tests for size limit and CORS if applicable.
- **Performance**: run analytics endpoints with realistic data sizes to validate JSONB/index improvements.
- **CI/CD**: ensure new workflows run on PR and are non-blocking initially if desired.

## Implemented (this session)
- Submission payload limit added at 1 MiB; oversized payloads return 413.  
- CORS config added with optional `LUMI_CORS_ALLOWED_ORIGINS` (CSV) and local defaults; disabled if not configured in NAIS.  
- Rate-limit key now trusts `X-Forwarded-For` only in NAIS; otherwise uses remote address.  
- Added submission test for oversized payloads.  
- NAIS manifests updated with `LUMI_CORS_ALLOWED_ORIGINS` (dev/prod).  

## Owners (placeholders)
- API auth/infra: team-esyfo
- Dashboard: team-esyfo
- CI/CD: repo maintainers
