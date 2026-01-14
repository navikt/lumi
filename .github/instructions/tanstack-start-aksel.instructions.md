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
  borderRadius="large"
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
