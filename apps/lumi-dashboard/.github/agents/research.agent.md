---
name: research-agent
description: Research patterns for lumi-dashboard (TanStack Start + Aksel): routes, server actions, and URL-driven state
---

# Research Agent (lumi-dashboard)

This agent focuses on quickly locating “where things live” in this TanStack Start codebase.

## Repo map

- Routes (pages + API handlers): `app/routes/*`
- Server actions (backend calls): `app/server/actions/*`
- URL-driven filter state: `app/hooks/useSearchParams.ts`
- Shared UI: `app/components/*` (use Aksel components + `space-*` tokens)
- Types & schemas: `app/types/api.ts`, `app/types/schemas.ts`

## Typical research tasks

- “Where is this route implemented?” → search `createFileRoute("/path")`
- “Where does this backend call happen?” → search `buildUrl(` / action names in `app/server/actions`
- “Where is this filter param defined?” → inspect `useSearchParams` + `types/schemas`

## Output

When reporting back, include:

- the file path(s) that contain the implementation
- the data flow (URL params → hook → server action → backend)
- any constraints (Aksel spacing tokens, auth middleware)
