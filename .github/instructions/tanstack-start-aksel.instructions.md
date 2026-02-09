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

## Server Functions (TanStack Start)

Server-side calls live under `apps/lumi-dashboard/app/server/actions/*` and use `createServerFn()`.
Prefer Zod validation + auth middleware (matches repo patterns).

```ts
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { authMiddleware } from "~/server/middleware/auth";
import { StatsParamsSchema } from "~/types/schemas";

export const fetchStatsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(StatsParamsSchema))
  .handler(async ({ data, context }) => {
    // fetch from backend with OBO token from context
  });
```

## Security Baseline (Dashboard)

- Keep global security headers/CSP in `apps/lumi-dashboard/app/start.ts` with helpers from `app/server/securityHeaders.ts`.
- Keep nonce propagation flow intact:
  - nonce created in `start.ts`
  - passed via start context in `app/router.tsx`
  - consumed in `app/routes/__root.tsx`
- Keep CSRF checks for non-GET methods in `app/server/middleware/auth.ts` (Origin/Referer validation in prod).
- Keep SRI runtime injection for manifest assets in `app/server.ts` + `app/server/assetIntegrity.ts`.
- In root layout, import styles as CSS modules (`import "@navikt/ds-css"; import "~/styles/global.css";`) instead of `?url` links so SRI coverage is maintained.

## Internal Endpoints (Health + Metrics)

Internal endpoints are implemented as **server handlers** in route files under `apps/lumi-dashboard/app/routes/api/internal/*`.

- `GET /api/internal/isAlive`
- `GET /api/internal/isReady`
- `GET /api/internal/metrics` (Prometheus)

## Testing

This repo uses **Vitest** + Testing Library.

- Run unit tests: `npm test`
- Run E2E tests: `npm run e2e`

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
