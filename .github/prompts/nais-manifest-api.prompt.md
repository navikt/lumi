---
name: nais-manifest-api
description: Generate or update Nais manifests for lumi-api (Kotlin/Ktor) in this monorepo
---

You are creating or updating Nais application manifests for `apps/lumi-api`.

In this monorepo, manifests live under:

- `apps/lumi-api/nais/app/dev.yaml`
- `apps/lumi-api/nais/app/prod.yaml`

## Required Configuration

Generate a complete Nais manifest with:

- **Application name and namespace** (ask for team namespace if not provided)
- **Container image**: Use `{{image}}` placeholder (replaced by CI/CD)
- **Port**: Default to 8080 unless specified
- **Prometheus metrics**: This repo exposes metrics at `/internal/prometheus`

## Resources

```yaml
resources:
  requests:
    cpu: 50m
    memory: 256Mi
  limits:
    memory: 512Mi
```

## Observability

- **Prometheus scraping**: Enabled at `/internal/prometheus`
- **Tracing**: OpenTelemetry auto-instrumentation enabled

## Health Checks

```yaml
liveness:
  path: /internal/isAlive
  initialDelay: 5
  timeout: 1
readiness:
  path: /internal/isReady
  initialDelay: 5
  timeout: 1
```

## Optional Components (ask first)

1. **PostgreSQL database** (GCP Cloud SQL)
2. **Kafka** (NOTE: `lumi-api` does not currently use Kafka)
3. **Azure AD authentication**
4. **TokenX** (NOTE: `lumi-api` uses Texas introspection for inbound)
5. **Ingress/domain configuration**

## Output rules

- If updating an existing manifest: keep unrelated fields intact; change only what’s required.
- Use `{{image}}` placeholder for the image.
- Keep indentation valid YAML.
