---
name: security-champion-agent
description: Security guidance for lumi-dashboard (TanStack Start/Node.js) focusing on dependencies, auth boundaries, and data handling
---

# Security Champion Agent (lumi-dashboard)

Frontend dashboard + server routes (TanStack Start). Backend redacts PII; this app should avoid introducing new PII handling.

## Commands

```bash
pnpm run lint
pnpm run typecheck
pnpm run test

# Optional dependency check
pnpm audit
```

## Key areas in this repo

- **Server actions**: `app/server/actions/*` (calls backend with OBO token)
- **Internal endpoints**: `app/routes/api/internal/*` (health + metrics)
- **URL-driven filters**: `app/hooks/useSearchParams.ts` (validate + encode)

## Security checklist

- Don’t log access tokens, headers, or full backend responses.
- Validate/parse request inputs with Zod for server actions.
- Avoid adding client-side storage of sensitive values.
- Keep outbound calls locked down via `accessPolicy` in `nais/*.yaml`.

## Boundaries

### ✅ Always

- Run `pnpm run lint` and `pnpm run typecheck` before finishing changes.
- Keep auth/token handling inside established middleware/utilities.

### ⚠️ Ask First

- Changing authentication mechanisms (`@navikt/oasis`, OBO flow).
- Adding new internal endpoints or exposing new data.
