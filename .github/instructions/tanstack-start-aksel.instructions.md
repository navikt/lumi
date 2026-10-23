---
applyTo: "apps/lumi-dashboard/app/**/*.{tsx,ts}"
---

# TanStack Start with Aksel Design System (lumi-dashboard)

This repo uses **TanStack Start** (`@tanstack/react-start`) + **TanStack Router** file-based routes (`apps/lumi-dashboard/app/routes/*`), built with Vite.

## Spacing Rules

**CRITICAL**: Always use Nav DS spacing tokens, never Tailwind padding/margin utilities.

### ✅ Correct Patterns

```tsx
import { Box, VStack, HGrid } from "@navikt/ds-react";

// Page container
<main>
  <Box
    paddingBlock={{ xs: "space-16", md: "space-24" }}
    paddingInline={{ xs: "space-16", md: "space-40" }}
  >
    {children}
  </Box>
</main>

// Component with responsive padding
<Box
  background="surface-subtle"
  padding={{ xs: "space-12", sm: "space-16", md: "space-24" }}
  borderRadius="12"
>
  <Heading size="large" level="2">Title</Heading>
  <BodyShort>Content</BodyShort>
</Box>

// Directional padding
<Box
  paddingBlock="space-16"    // Top and bottom
  paddingInline="space-24"   // Left and right
>
```

### ❌ Incorrect Patterns

```tsx
// Never use Tailwind padding/margin
<div className="p-4 md:p-6">  // ❌ Wrong
<div className="mx-4 my-2">   // ❌ Wrong
<Box padding="4">             // ❌ Wrong - no space- prefix
```

## Aksel v8 Notes

This project is on Aksel v8 (`@navikt/ds-react`/`@navikt/ds-css` ^8), so prefer these patterns:

### ✅ v8 Patterns

```tsx
// Box.New is removed in v8
import { Box, Button, Tag } from "@navikt/ds-react";

<Box borderRadius="8" padding="space-16" />

// Colors are expressed via data-color (danger/neutral/info/warning/success)
<Button data-color="danger" variant="primary">Slett</Button>
<Tag data-color="neutral" variant="outline" size="small">chip</Tag>

// Use space tokens everywhere, including zeros
<Box paddingBlock="space-0 space-16" />
```

### ❌ v8 Gotchas

```tsx
<Box.New />                       // ❌ Removed
<Button variant="danger" />       // ❌ Use data-color + variant
<VStack gap="0" />                // ❌ Use space-0
<Box paddingInline="0" />         // ❌ Use space-0
```

## Responsive Design

Mobile-first breakpoints: `xs`, `sm`, `md`, `lg`, `xl`.

```tsx
<HGrid columns={{ xs: 1, md: 2, lg: 3 }} gap="space-16">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</HGrid>
```

## Routing (TanStack Router)

Routes are file-based under `apps/lumi-dashboard/app/routes/*` using `createFileRoute()`.

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  return (
    <Link to="/export" search={(prev) => prev}>
      Gå til eksport
    </Link>
  );
}
```

On zod 3, routes validate search params with `validateSearch: zodValidator(schema)` from `@tanstack/zod-adapter`, never with the schema directly: used directly, a zod 3 schema turns async when anything throws during parsing, and the router rejects async search validation. Search schemas must stay synchronous and must not throw; report problems with `ctx.addIssue`. Give each field a `fallback()` without a trailing `.catch()` (see `app/schemas/searchSchema.ts`); the extra `.catch()` makes the search input `unknown`, so `Link`, `navigate` and `redirect` stop type-checking `search`.

```ts
import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  team: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/export")({
  validateSearch: zodValidator(searchSchema),
  component: ExportPage,
});
```

## Server Functions (TanStack Start)

Server-side calls live under `apps/lumi-dashboard/app/server/actions/*` and use `createServerFn()`.
Prefer Zod validation + auth middleware (matches repo patterns).

```ts
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "~/server/middleware/auth";
import { StatsParamsSchema } from "~/types/schemas";

export const fetchStatsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(StatsParamsSchema)
  .handler(async ({ data, context }) => {
    // fetch from backend with OBO token from context
  });
```

## Security Baseline (Dashboard)

- Keep global security headers/CSP in `apps/lumi-dashboard/app/start.ts` with helpers from `app/server/securityHeaders.ts`.
  - They are set with `setResponseHeaders`, so they reach every response that goes through Start's middleware chain, including responses built from thrown errors.
  - Every such response gets `Cache-Control: private, no-store`. Static assets are served by Nitro outside Start and keep their own caching.
- Keep nonce propagation flow intact:
  - nonce created in `start.ts`
  - passed via start context in `app/router.tsx`
  - consumed in `app/routes/__root.tsx`
- Server functions are CSRF-protected by `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })` in `requestMiddleware` in `app/start.ts`.
  - Keep it after `securityHeadersMiddleware`, so its 403 responses carry the security headers.
  - Only `Sec-Fetch-Site: same-origin` passes. Without that header, `Origin` and then `Referer` must match the request origin.
  - The Origin/Referer check for non-GET methods in `app/server/middleware/auth.ts` remains as a second layer in NAIS.
  - Rejections are logged without header values, apart from the `Sec-Fetch-Site` token. Server-only code in the middleware options must go through `createServerOnlyFn`, because Start's compiler leaves the options in the client code.
- The dashboard has no Subresource Integrity (SRI) for CDN-served JS/CSS today. Do not assume it exists; working SRI is tracked in #637.
- In root layout, import styles as CSS modules (`import "@navikt/ds-css"; import "~/styles/global.css";`) instead of `?url` links, so TanStack Start/Vite manage the stylesheets (manifest, hashed file names, CDN prefix).

## Internal Endpoints (Health + Metrics)

Internal endpoints are implemented as **server handlers** in route files under `apps/lumi-dashboard/app/routes/api/internal/*`.

- `GET /api/internal/isAlive`
- `GET /api/internal/isReady`
- `GET /api/internal/metrics` (Prometheus)

## Testing

This repo uses **Vitest** + Testing Library.

- Run unit tests: `pnpm run test`
- Run E2E tests: `pnpm run e2e`

## Boundaries

### ✅ Always

- Use Aksel Design System components
- Use spacing tokens with `space-` prefix
- Mobile-first responsive design
- Norwegian number formatting (`toLocaleString("no-NO")`)

### ⚠️ Ask First

- Adding custom CSS that bypasses Aksel primitives
- Changing authentication flow
- Modifying data aggregation logic

### 🚫 Never

- Use Tailwind padding/margin utilities (`p-*`, `m-*`)
- Use numeric spacing without `space-` prefix
- Ignore accessibility requirements
- Skip responsive props
