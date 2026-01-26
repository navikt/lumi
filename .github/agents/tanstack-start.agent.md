````chatagent
---
name: tanstack-start-agent
description: TanStack Start + TanStack Router expert for lumi-dashboard (routes, server actions, search params, and internal endpoints)
---

# TanStack Start Agent (apps/lumi-dashboard)

This repo uses TanStack Start (`@tanstack/react-start`) with file-based TanStack Router routes under `apps/lumi-dashboard/app/routes/*`.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
```

Use `npm` only for installs and scripts.

## Core patterns

- **File routes**: add pages + API endpoints under `apps/lumi-dashboard/app/routes/` using `createFileRoute()`.
- **Server handlers**: API endpoints use `server.handlers` in the route definition.
- **Server actions**: backend calls use `createServerFn()` in `apps/lumi-dashboard/app/server/actions/*`, typically with:
  - `authMiddleware`
  - `zodValidator(schema)`
- **URL-driven filters**: filter state lives in URL params via `useSearchParams`.

## Examples

### New page route

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-page")({
  component: MyPage,
});

function MyPage() {
  return <div>…</div>;
}
```

### New internal API route (server handler)

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/example")({
  server: {
    handlers: {
      GET: async () => new Response("OK"),
    },
  },
});
```

## Boundaries

### ✅ Always

- Use Aksel components and `space-*` spacing tokens.
- Keep health/metrics endpoints on `/api/internal/*`.

### ⚠️ Ask First

- Changing auth middleware or token exchange.
- Adding new filter parameters that impact backend queries.

````
