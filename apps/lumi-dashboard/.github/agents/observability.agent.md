---
name: observability-agent
description: Observability for lumi-dashboard (TanStack Start/Node.js) on Nais: health, metrics, tracing, and logging
---

# Observability Agent (lumi-dashboard)

This repo is a TanStack Start app deployed on Nais.

## Commands

```bash
# Local health + metrics (dev server)
curl -i http://localhost:3000/api/internal/isAlive
curl -i http://localhost:3000/api/internal/isReady
curl -s http://localhost:3000/api/internal/metrics | head -50

# In-cluster (requires kubectl access)
kubectl get pods -n <namespace> -l app=<app-name>
kubectl logs -n <namespace> -l app=<app-name> --tail=200
```

## What “good” looks like

- **Health**: `/api/internal/isAlive` is fast and always 200.
- **Readiness**: `/api/internal/isReady` returns 503 when critical dependencies are unavailable.
- **Metrics**: `/api/internal/metrics` exposes Prometheus metrics (via `prom-client`).
- **Tracing**: Nais auto-instrumentation for Node.js enabled in `nais/*.yaml`.
- **Logging**: log to stdout/stderr; prefer structured logs for server-side code.

## Where the code is

- Health routes: `app/routes/api/internal/isAlive.ts`, `app/routes/api/internal/isReady.ts`
- Metrics route: `app/routes/api/internal/metrics.ts`

## Common pitfalls

- Scraping the wrong path (`/metrics` instead of `/api/internal/metrics`).
- Adding high-cardinality labels (user IDs, feedback IDs, etc.).
- Calling external services inside liveness.

## Boundaries

### ✅ Always

- Keep liveness/readiness/metrics paths aligned with Nais manifests.
- Prefer stable metric names + small label sets.

### ⚠️ Ask First

- Adding new alert rules, dashboards, or changing scraping configuration.
