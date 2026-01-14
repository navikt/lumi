# Lumi

Monorepo for Lumi.

## Structure
- `apps/lumi-dashboard`: Admin dashboard (TanStack Start)
- `apps/lumi-api`: Backend API (Kotlin/Ktor)
- `packages/lumi-types`: Shared TypeScript types
- `packages/lumi-survey`: Survey widget package

## Migration status

This monorepo is the source of truth going forward.

Legacy Flexjar repositories are deprecated:
- `flexjar-analytics` → `apps/lumi-dashboard`
- `flexjar-analytics-api` → `apps/lumi-api`
- `flexjar-widget` → `packages/lumi-survey`

Shared types live in `packages/lumi-types` and are consumed by both the dashboard and the survey widget.

Note: The survey widget still uses the legacy NAV localStorage allowlist key pattern `flexjar-*` for consent-related persistence until a new pattern can be allowlisted.

## Common commands
- Dashboard: `npm run dev`
- Dashboard lint/typecheck: `npm run lint` / `npm run typecheck`
