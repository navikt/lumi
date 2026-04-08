---
name: tanstack-start-agent
description: TanStack Start + TanStack Router expert for lumi-dashboard (routes, server actions, search params, and internal endpoints)
---

# TanStack Start Agent (lumi-dashboard)

This repo uses TanStack Start (`@tanstack/react-start`) with file-based TanStack Router routes under `app/routes/*`.

## Commands

```bash
pnpm run dev
pnpm run lint
pnpm run typecheck
pnpm run test
```

## Core patterns

- **File routes**: add pages + API endpoints under `app/routes/` using `createFileRoute()`.
- **Server handlers**: API endpoints use `server.handlers` in the route definition.
- **Server actions**: backend calls use `createServerFn()` in `app/server/actions/*`, typically with:
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
