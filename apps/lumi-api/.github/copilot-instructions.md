<!--
DEPRECATED: Copilot guidance is now centralized at repo root.

Use:
- .github/copilot-instructions.md
- .github/instructions/
- .github/agents/ .github/prompts/ .github/skills/
-->

# Lumi API – AI Coding Guide

Ktor 3.x backend for Lumi survey analytics with PostgreSQL storage.

## Repository Overview

Single Kotlin/Ktor service deployed on NAIS. Provides:
- Submission endpoint for the widget
- Analytics endpoints for the dashboard (stats, feedback, export)
- Operational endpoints under `/internal/*`

## Architecture

```
src/main/kotlin/no/nav/lumi/
├── Application.kt        # Entry point, Ktor module setup
├── config/
│   ├── Auth.kt               # Azure AD via NAIS Texas introspection
│   ├── ServerEnv.kt          # Type-safe env/config (NAIS vs local)
│   ├── Database.kt           # HikariCP + Flyway + Exposed + DatabaseHolder
│   ├── Routing.kt            # Route registration + Ktor Resources
│   ├── Metrics.kt            # Micrometer + Prometheus
│   └── Serialization.kt
├── domain/
│   └── Models.kt             # DTOs, query types, FeedbackStatsResult
├── repository/
│   ├── FeedbackTable.kt      # Exposed Table definition + JsonExtract/DateDate helpers
│   ├── FeedbackRepository.kt # CRUD operations (Exposed DSL)
│   ├── FeedbackStatsRepository.kt # Stats/analytics queries (Exposed DSL)
│   └── Extensions.kt         # ResultRow.toDto() extension functions
├── routes/
│   ├── Resources.kt          # Ktor Resources (type-safe routing)
│   ├── SubmissionRoutes.kt   # POST feedback from widget
│   ├── FeedbackRoutes.kt     # GET/DELETE for dashboard
│   ├── StatsRoutes.kt        # Aggregations, timeline
│   ├── ExportRoutes.kt       # CSV/JSON/Excel
│   └── InternalRoutes.kt     # Health checks + /internal/prometheus
└── sensitive/
    ├── SensitiveDataFilter.kt    # Redaction logic
    └── SensitiveDataPatterns.kt  # Regex patterns for PII
```

### Key Technologies
- **Exposed 0.56+**: DSL-based type-safe SQL (no DAO layer)
- **Ktor Resources**: Type-safe routing with `@Resource` annotated classes
- **Micrometer + Prometheus**: Metrics exposed at `/internal/prometheus`

### Key Concepts
- **Sensitive data filtering**: All text responses pass through `SensitiveDataFilter.redact()` before API response
- **Texas auth**: JWT validation is delegated to NAIS Texas via introspection; app constructs `BrukerPrincipal` from claims
- **Two auth contexts**:
  - Submission routes authenticate the *calling app* and extract `team/app` from `azp_name`
  - Analytics routes authenticate the *user* and authorize via AD groups + `TeamAuthorizationPlugin`
- **Flyway migrations**: SQL files in `src/main/resources/db/migration/` (currently `V1__Initial_schema.sql`, `V2__Text_themes.sql`)
- **Soft delete**: Implemented as domain-level “clear/redact feedback content” (not a `deleted_at` column)

## Commands
```sh
./gradlew run       # Start locally (needs PostgreSQL)
./gradlew build     # Build fat JAR
./gradlew test      # Kotest + Testcontainers
```

## Build and Verify

Run after changes (especially logic changes):

```sh
./gradlew test
./gradlew build
```

## Local Development
```sh
# Start PostgreSQL
docker run -d --name lumi-db \
  -e POSTGRES_USER=lumi -e POSTGRES_PASSWORD=lumi -e POSTGRES_DB=lumi \
  -p 5432:5432 postgres:17

./gradlew run
```

Local operational endpoints:
- `GET http://localhost:8080/internal/isAlive`
- `GET http://localhost:8080/internal/isReady`
- `GET http://localhost:8080/internal/prometheus`

## Testing Patterns
- **Testcontainers**: Integration tests spin up PostgreSQL
- **Kotest**: Prefer `FunSpec` (matches existing tests)
- **Ktor testApplication**: Use `testModule()` helper which bypasses Texas and installs a test bearer realm

## API Conventions
1. **Query params**: `team`, `app`, `from`, `to`, `surveyId`, `tags`, `fritekst`, `page`, `size`
2. **Response format**: `Page<T>` wrapper with `content`, `totalElements`, `totalPages`
3. **Submission contract**: Canonical payload uses `schemaVersion=1`, `surveyId`, `surveyType`, `submittedAt`, and structured `answers[]` (no legacy flat keys)
4. **Error responses**: Use Ktor status pages for consistent JSON errors

## Related Repositories
- **[lumi-survey](https://github.com/navikt/lumi/tree/main/packages/lumi-survey)**: Survey widget (`@navikt/lumi-survey`) that POSTs to `/api/v1/feedback` with `schemaVersion=1` and structured `answers[]`.
- **[lumi-dashboard](https://github.com/navikt/lumi-dashboard)**: Dashboard that calls `/api/v1/intern/*` endpoints. DTOs in `domain/` must match `lib/api.ts` types.

## Sensitive Data Patterns
Located in `SensitiveDataPatterns.kt`:
| Pattern | Replacement |
|---------|-------------|
| Fødselsnummer (11 digits) | `[FØDSELSNUMMER FJERNET]` |
| NAVident (letter + 6 digits) | `[NAVIDENT FJERNET]` |
| Email | `[E-POST FJERNET]` |
| Phone (8 digits) | `[TELEFON FJERNET]` |
| Bank card/account | `[KORTNUMMER/KONTONUMMER FJERNET]` |

Adding new patterns: Add to `HIGH_CONFIDENCE_PATTERNS` list with appropriate regex and replacement text.

# Nav Development Standards

These standards apply across Nav projects.

## Nav Principles

- **Team First**: Autonomous teams with circles of autonomy, supported by Architecture Advice Process
- **Product Development**: Continuous development and product-organized reuse over ad hoc approaches
- **Essential Complexity**: Focus on essential complexity, avoid accidental complexity
- **DORA Metrics**: Measure and improve team performance using DevOps Research and Assessment metrics

## Nav Tech Stack

- **Backend**: Kotlin with Ktor, PostgreSQL
- **Frontend**: (separate repo) lumi-dashboard
- **Platform**: Nais (Kubernetes on Google Cloud Platform)
- **Auth**: Azure AD (validated via NAIS Texas introspection in this repo)
- **Observability**: Prometheus, Grafana Loki, Tempo (OpenTelemetry)

## Nav Code Standards

### Kotlin/Ktor Patterns

- Ktor `Application.module()` composed via `configureX()` functions
- Type-safe environment config via `ServerEnv`
- Exposed DSL repositories + Flyway migrations
- Texas introspection for auth (avoid in-app JWT verification)

### Frontend/Aksel

This repo is backend-only. Aksel/Next.js requirements belong in the frontend repo.

### Nais Deployment

- Manifests in `nais/app/` directory
- Required endpoints (this repo): `/internal/isAlive`, `/internal/isReady`, `/internal/prometheus`
- OpenTelemetry auto-instrumentation for observability

### Writing Effective Agents

Based on [GitHub's analysis of 2,500+ repositories](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/), follow these patterns when creating or updating agents in `.github/agents/`:

**Structure (in order):**

1. **Frontmatter** - Name and description in YAML
2. **Persona** - One sentence: who you are and what you specialize in
3. **Commands** - Executable commands early, with flags and expected output
4. **Related Agents** - Table of agents to delegate to
5. **Core Content** - Code examples over explanations (show, don't tell)
6. **Boundaries** - Three-tier system at the end

**Six Core Areas to Cover:**

- Commands (with flags and options)
- Testing patterns
- Project structure
- Code style (✅ Good / ❌ Bad examples)
- Git workflow
- Boundaries

**Three-Tier Boundaries:**

```markdown
## Boundaries

### ✅ Always
- Check if your code passes linting and type checks
- Verify that your code changes work as intended

### ⚠️ Ask First
- Modifying production configs
- Changing auth mechanisms

### 🚫 Never
- Commit secrets to git
- Skip input validation
```

**Key Principles:**

- **Commands early**: Put executable commands near the top, not buried at the bottom
- **Code over prose**: Show real code examples, not descriptions of what code should do
- **Specific stack**: Include versions (this repo uses Kotlin 2.1.x / Java 21)
- **Actionable boundaries**: "Never commit secrets" not "I cannot access secrets"
