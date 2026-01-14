---
applyTo: "apps/lumi-api/**/*.kt"
---

# Kotlin/Ktor Standards (lumi-api)

These rules are intentionally repo-specific. Prefer matching existing patterns over inventing new frameworks.

## Application Structure

- Entry point is `embeddedServer(Netty, module = Application::module)`.
- Composition happens via `configureX()` functions (serialization, status pages, auth, database, routes, metrics).

```kotlin
fun Application.module() {
    configureSerialization()
    configureStatusPages()
    configureCallLogging()
    configureRateLimiting()
    configureAuth()
    configureDatabase()
    configureOpenApi()
    configureMetrics()
    configureRouting()
}
```

## Configuration

- Use `ServerEnv.current` for type-safe env access and local defaults.
- Fail fast in NAIS if required env vars are missing.

```kotlin
val env = ServerEnv.current
val jdbcUrl = env.database.getConnectionUrl()
```

## Authentication & Authorization

This repo uses **NAIS Texas sidecar introspection**.

✅ Prefer:
- Validating tokens via the Texas introspection client/helper
- Constructing `BrukerPrincipal` from introspected claims
- Authorization via `ClientAuthorizationPlugin` + `TeamAuthorizationPlugin`

🚫 Avoid:
- Implementing JWKS/JWT verification in-app “just for this endpoint”
- Parsing JWTs directly for `azp_name`/groups

Typical structure:

```kotlin
install(Authentication) {
    bearer(AZURE_REALM) {
        authenticate { credential ->
            // validateTokenWithTexas(credential.token)
        }
    }
}

routing {
    internalRoutes()
    submissionRoutes()

    authenticate(AZURE_REALM) {
        install(ClientAuthorizationPlugin) {
            allowedClientId = getLumiAnalyticsClientId()
        }
        install(TeamAuthorizationPlugin)
        feedbackRoutes()
        statsRoutes()
        exportRoutes()
        discoveryRoutes()
    }
}
```

## Routing

- Prefer route modules under `no.nav.lumi.routes`.
- For analytics routes, use Ktor Resources (`@Resource`) for typed routing.
- Keep `/internal/*` endpoints unauthenticated.

Operational endpoints in this repo:
- `GET /internal/isAlive`
- `GET /internal/isReady`
- `GET /internal/prometheus`

## Database (Exposed + Flyway)

- Flyway migrations live under `apps/lumi-api/src/main/resources/db/migration/`.
- DB is initialized via `DatabaseHolder` + `configureDatabase()`.
- Use Exposed DSL inside `transaction {}` blocks.

```kotlin
transaction {
    FeedbackTable
        .select { FeedbackTable.team eq team }
        .limit(size, offset = offset)
        .map { it.toDto() }
}
```

Guidelines:
- Keep schema aligned with existing migrations (not “idealized” schemas).
- Prefer small, additive migrations.
- `feedback_json` is stored as text; cast to `json`/`jsonb` only where needed in SQL.

## Logging

- Use SLF4J (`LoggerFactory.getLogger(...)`).
- Never log bearer tokens.
- Avoid logging raw feedback payloads unless already redacted.

## Boundaries

### ✅ Always

- Follow existing module structure and plugins.
- Use `ServerEnv` for new configuration.

### ⚠️ Ask First

- Changing auth strategy (Texas vs in-app JWT verification)
- Large schema changes or changing how JSON is stored/queried

### 🚫 Never

- Introduce Kafka/Rapids & Rivers patterns in this repo without an explicit decision.
