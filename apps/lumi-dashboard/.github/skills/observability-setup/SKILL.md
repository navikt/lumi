---
name: observability-setup
description: Observability setup for lumi-dashboard (TanStack Start/Node.js) on Nais
---

# Observability Setup (lumi-dashboard)

This repo exposes operational endpoints under `/api/internal/*`.

## Endpoints

- `GET /api/internal/isAlive`
- `GET /api/internal/isReady`
- `GET /api/internal/metrics` (Prometheus via `prom-client`)

## Local verification

```bash
curl -i http://localhost:3000/api/internal/isAlive
curl -i http://localhost:3000/api/internal/isReady
curl -s http://localhost:3000/api/internal/metrics | head -50
```

## Nais manifest essentials

Manifests live in `nais/*.yaml`.

```yaml
spec:
  port: 3000

  liveness:
    path: /api/internal/isAlive
    initialDelay: 5
  readiness:
    path: /api/internal/isReady
    initialDelay: 5

  prometheus:
    enabled: true
    path: /api/internal/metrics

  observability:
    autoInstrumentation:
      enabled: true
      runtime: nodejs
```

## Metric design guidance

- Keep label sets small and stable.
- Avoid high-cardinality labels (user IDs, feedback IDs).
- Prefer “what happened” counters over per-entity tracking.

## Boundaries

### ✅ Always

- Keep paths consistent across code and Nais manifests.
- Keep liveness fast and dependency-light.

### ⚠️ Ask First

- Adding new alert rules/dashboards or changing scrape settings.
