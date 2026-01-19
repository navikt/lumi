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

Shared types live in `packages/lumi-types` and are consumed by the dashboard and other internal code.

The survey widget (`packages/lumi-survey`) is intentionally self-contained (no dependency on internal workspace-only packages) so it can be published and installed externally without extra packages.

Note: The survey widget still uses the legacy NAV localStorage allowlist key pattern `flexjar-*` for consent-related persistence until a new pattern can be allowlisted.

## Common commands
- Dashboard: `npm run dev`
- Dashboard lint/typecheck: `npm run lint` / `npm run typecheck`

## Releasing

- `@navikt/lumi-survey`: see `packages/lumi-survey/CONTRIBUTING.md`

## Guardrails

- Verify that `@navikt/lumi-survey` stays publishable (no `@navikt/lumi-types` / `zod` leakage): `npm run verify:lumi-survey`
