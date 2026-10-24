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

Routes give their zod 4 search schema straight to `validateSearch`, without an adapter. The router then calls the schema's Standard Schema `validate`, and the answer must be synchronous. If anything throws during parsing (a transform, a refinement or a `.catch()` callback), zod 4 runs the parse again asynchronously and returns a Promise. The router refuses it with "Async validation not supported", and nothing handles the Promise when it rejects. Search schemas must therefore stay synchronous and must not throw; report problems with `ctx.addIssue`. `app/routes/__tests__/validateSearch.test.ts` gives every route's schema garbage and fails on a Promise or a throw.

Give each field `.catch(undefined)` (see `app/schemas/searchSchema.ts`), so an invalid value becomes `undefined` instead of an error. In zod 4, `.catch()` keeps the input type of the field, so `Link`, `navigate` and `redirect` still type-check `search`. `z.coerce.*` has `unknown` as its input type; give the type as a generic, as in `z.coerce.number<number>()`.

```ts
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  team: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/export")({
  validateSearch: searchSchema,
  component: ExportPage,
});
```

## Server Functions (TanStack Start)

Server-side calls live under `apps/lumi-dashboard/app/server/actions/*` and use `createServerFn()`.
Every server function is a public RPC endpoint: it can be called directly, whatever route or UI uses it.

- Attach `authMiddleware` to every server function that calls Lumi API or returns user data. Route guards and hidden UI are not access control. Only public data, such as `fetchBrowserObservabilityMetaServerFn`, may skip it.
- Chain in this order: `.middleware()`, `.validator()`, `.handler()`. Pass the zod schema straight to `.validator()`; `.inputValidator()` no longer exists.
- Use `GET` only for reads and `POST` for anything that changes data.
- A valid `team` or `surveyId` is not proof of access. Lumi API decides access from the OBO token the handler forwards.
- Loaders, `beforeLoad` and components run on both server and client. Keep tokens, `serverEnv` and server-only packages inside handlers, middleware `.server()` bodies and `createServerOnlyFn`. Import protection in `apps/lumi-dashboard/vite.config.ts` fails the build if client code still imports a package in `serverOnlyModules`, a `*.server.*` file or a file under `app/mock/`. Add new server-only packages to `serverOnlyModules`.

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

### Failed server functions

- `serverFnFailureMiddleware` is the first entry in `functionMiddleware` in `app/start.ts`, so it wraps every other middleware and the input validation. For a failed call over HTTP it sets the status from the error (`serverFnFailureStatus` in `app/server/serverFnStatus.ts`), unless a 4xx/5xx is already set. It logs one `Server function failed` line and counts the failure in `lumi_dashboard_server_fn_failures_total{fn,status}` and, for a 5xx, in `lumi_dashboard_server_fn_5xx_failures_total`, which the alert in `nais/alerts/prod.yaml` watches.
- Whether a call came over HTTP is Start's own `handlerType`, which `securityHeadersMiddleware` puts in the global context. Read it with `isServerFnHttpCall()`, not from the request path.
- To fail with a status, throw `HttpStatusError`. Set a status yourself only with `setServerFnHttpStatus`: during SSR a page runs its server functions in-process, so `setResponseStatus` there would change the status of the page.
- Classify failures from Lumi API where they happen. Parse its answers with `parseApiAnswer` from `app/server/fetchUtils.ts`, and pass on an error answer as `apiStatusError` or `BadGatewayError`. A plain `Error` from a handler gives 500; Start's own validation error gives 400.
- The browser gets only the message of a thrown error, apart from `ApiErrorException`. Never log error messages, input or answers from Lumi API; they can contain user data.

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
  - Behind the ingress, `request.url` is `http://`. Both checks compare with `getExpectedOrigin` in `app/server/requestOrigin.ts`, which takes the scheme from `X-Forwarded-Proto`.
  - Rejections are logged without header values, apart from the `Sec-Fetch-Site` token. Server-only code in the middleware options must go through `createServerOnlyFn`, because Start's compiler leaves the options in the client code.
- Login is handled by the Nais Azure AD sidecar (Wonderwall, `azure.sidecar` in `nais/*.yaml`). `authMiddleware` validates the token and exchanges it for an OBO token. Do not add session cookies or OAuth flows from TanStack's auth guides.
- Server routes (`server.handlers`) that return non-public data need `authMiddleware` too, through `server.middleware`. The `api/internal/*` routes serve Nais probes and Prometheus and have no auth by design.
- The dashboard has no Subresource Integrity (SRI) for CDN-served JS/CSS today. Do not assume it exists; working SRI is tracked in #637.
- In root layout, import styles as CSS modules (`import "@navikt/ds-css"; import "~/styles/global.css";`) instead of `?url` links, so TanStack Start/Vite manage the stylesheets (manifest, hashed file names, CDN prefix).

## Internal Endpoints (Health + Metrics)

Internal endpoints are implemented as **server handlers** in route files under `apps/lumi-dashboard/app/routes/api/internal/*`.

- `GET /api/internal/isAlive`
- `GET /api/internal/isReady`
- `GET /api/internal/metrics` (Prometheus)

## Up-to-date TanStack docs for agents

TanStack Start changes faster than model training data. Look up TanStack APIs in these sources instead of relying on memory. Where they disagree with this file, this file wins.

1. **Skills shipped in the installed packages** (after `pnpm install`). They match the installed versions but can lag the docs a little. Open the files directly; search tools often skip `node_modules`.
   - Server functions: `node_modules/.pnpm/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md`
   - Middleware: `node_modules/.pnpm/node_modules/@tanstack/start-client-core/skills/start-core/middleware/SKILL.md`
   - Where code runs (loaders, env, server-only code): `node_modules/.pnpm/node_modules/@tanstack/start-client-core/skills/start-core/execution-model/SKILL.md`
   - Server routes: `node_modules/.pnpm/node_modules/@tanstack/start-client-core/skills/start-core/server-routes/SKILL.md`
   - Search params: `apps/lumi-dashboard/node_modules/@tanstack/router-core/skills/router-core/search-params/SKILL.md`
   - Not-found and error handling: `apps/lumi-dashboard/node_modules/@tanstack/router-core/skills/router-core/not-found-and-errors/SKILL.md`
   - All of them: `find -L apps/lumi-dashboard/node_modules/@tanstack node_modules/.pnpm/node_modules/@tanstack -path '*/skills/*' -name SKILL.md`
2. **Current docs as Markdown.** Add `.md` to any TanStack docs URL, or start from https://tanstack.com/start/latest/llms.txt and https://tanstack.com/router/latest/llms.txt. These follow the latest release, which can be newer than the installed one.

Skip TanStack's guidance on session cookies, OAuth, password reset and rate limiting; see Security Baseline. The skills also show a hand-written Origin check for CSRF; this app uses `createCsrfMiddleware` instead.

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
