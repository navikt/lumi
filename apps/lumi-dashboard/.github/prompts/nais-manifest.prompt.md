---
name: nais-manifest
description: Generate or update the Nais manifests for lumi-dashboard (TanStack Start)
---

You are working in the `lumi-dashboard` frontend repo (TanStack Start on Node.js).

This repo keeps manifests in `nais/`:

- `nais/dev.yaml`
- `nais/prod.yaml`
- `nais/demo.yaml` (if applicable)

## Requirements (defaults)

- Port: 3000
- Liveness: `GET /api/internal/isAlive`
- Readiness: `GET /api/internal/isReady`
- Metrics: `GET /api/internal/metrics` (Prometheus)
- Node.js auto-instrumentation enabled
- Azure AD enabled and Azure sidecar `autoLogin` enabled
- Ensure Azure sidecar ignores `/api/internal/*`
- Outbound `accessPolicy` to `lumi-api`

## Output rules

- If updating an existing manifest: keep unrelated fields intact; change only what’s required.
- Use `{{image}}` placeholder for the image.
- Keep indentation valid YAML.

## Example snippet

```yaml
apiVersion: nais.io/v1alpha1
kind: Application
metadata:
  name: lumi-dashboard
  namespace: team-esyfo
  labels:
    team: team-esyfo
spec:
  image: {{image}}
  port: 3000

  liveness:
    path: /api/internal/isAlive
    initialDelay: 10
  readiness:
    path: /api/internal/isReady
    initialDelay: 10

  prometheus:
    enabled: true
    path: /api/internal/metrics

  observability:
    autoInstrumentation:
      enabled: true
      runtime: nodejs

  azure:
    application:
      enabled: true
      tenant: nav.no
    sidecar:
      enabled: true
      autoLogin: true
      autoLoginIgnorePaths:
        - /api/internal/*

  accessPolicy:
    outbound:
      rules:
        - application: lumi-api

  env:
    - name: NODE_ENV
      value: production
```

## Questions (ask if unknown)

1. Which environment (dev/prod/demo)?
2. Team namespace?
3. Do we need additional outbound rules besides `lumi-api`?
