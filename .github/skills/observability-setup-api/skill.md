---
name: observability-setup-api
description: Observability setup for lumi-api (Kotlin/Ktor) on Nais
---

# Observability Setup (lumi-api)

`apps/lumi-api` exposes operational endpoints under `/internal/*`.

## Endpoints

- `GET /internal/isAlive`
- `GET /internal/isReady`
- `GET /internal/prometheus`

## Local verification

```bash
curl -i http://localhost:8080/internal/isAlive
curl -i http://localhost:8080/internal/isReady
curl -s http://localhost:8080/internal/prometheus | head -50
```

## Repo boundaries

- Metrics path is `/internal/prometheus` (do not invent new paths).
- Kafka is not used in `lumi-api`; do not add Kafka readiness checks unless explicitly decided.

## Nais manifest essentials

Manifests live in `apps/lumi-api/nais/app/*.yaml`.

```yaml
spec:
  port: 8080

  liveness:
    path: /internal/isAlive
    initialDelay: 5
  readiness:
    path: /internal/isReady
    initialDelay: 5

  prometheus:
    enabled: true
    path: /internal/prometheus

  observability:
    autoInstrumentation:
      enabled: true
      runtime: java
```
