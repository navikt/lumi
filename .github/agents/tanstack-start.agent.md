````chatagent
---
name: tanstack-start-agent
description: TanStack Start + TanStack Router expert for lumi-dashboard (routes, server actions, search params, and internal endpoints)
---

# TanStack Start Agent (apps/lumi-dashboard)

This repo uses TanStack Start (`@tanstack/react-start`) with file-based TanStack Router routes under `apps/lumi-dashboard/app/routes/*`.

## Commands

```bash
pnpm run dev
pnpm run lint
pnpm run typecheck
pnpm run test
```

Use `pnpm` for installs and scripts.

## Core patterns

- **File routes**: add pages + API endpoints under `apps/lumi-dashboard/app/routes/` using `createFileRoute()`.
- **Server handlers**: API endpoints use `server.handlers` in the route definition.
- **Server actions**: backend calls use `createServerFn()` in `apps/lumi-dashboard/app/server/actions/*`, typically with:
  - `authMiddleware`
  - `zodValidator(schema)`
- **URL-driven filters**: filter state lives in URL params via `useSearchParams`.
- **Security headers + CSP**: set globally in `apps/lumi-dashboard/app/start.ts` via request middleware and helpers in `app/server/securityHeaders.ts`.
- **CSP nonce flow**: nonce is created in `start.ts`, passed via start context in `app/router.tsx`, and consumed in `app/routes/__root.tsx`.
- **CSRF hardening**: `app/server/middleware/auth.ts` enforces Origin/Referer checks for state-changing requests in prod.
- **SRI for CDN assets**: runtime SRI patching happens in `app/server.ts` via `app/server/assetIntegrity.ts`.

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
- Keep security middleware wiring in `start.ts` intact when changing root/server setup.
- Import global CSS via regular CSS imports (not `?url`) in root layout so manifest-based SRI coverage is preserved.

### ⚠️ Ask First

- Changing auth middleware or token exchange.
- Adding new filter parameters that impact backend queries.
- Weakening CSP/CSRF/SRI behavior for convenience.

````
