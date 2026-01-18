# Lumi (monorepo) – AI Coding Guide

Monorepo for Lumi survey analytics:

- `apps/lumi-dashboard`: TanStack Start (React) dashboard
- `apps/lumi-api`: Kotlin/Ktor backend (PostgreSQL + Flyway + Exposed)
- `packages/lumi-survey`: Aksel-based React survey widget
- `packages/lumi-types`: Shared TypeScript types

## Quality Standards & Workflow

- Always run `npm run lint` (Biome) and `npm run typecheck` before finishing a task.
- Run `npm test` when making logic changes.
- For backend changes: run `npm run api:test` (or `cd apps/lumi-api && ./gradlew test`).
- Keep changes scoped and consistent with existing patterns.

## Commands (repo root)

```sh
npm run dev
npm run lint
npm run lint:fix
npm run typecheck
npm test
npm run e2e

npm run api:run
npm run api:test
npm run api:build
```

## Copilot config location

This monorepo keeps Copilot guidance **only** under the repo root `.github/`:

- `.github/copilot-instructions.md` (this file)
- `.github/instructions/` (scoped rules via `applyTo`)
- `.github/agents/`, `.github/prompts/`, `.github/skills/`

Avoid duplicating Copilot files inside `apps/*/.github/` to prevent drift and conflicting instructions.

## Conventions

- Aksel (v8): use `@navikt/ds-react` components and spacing tokens (`space-*`, including `space-0`).
- No Tailwind.
- Keep filter/state URL-driven in the dashboard (TanStack Router search params).
- Backend owns PII redaction; frontend displays.

### Aksel v8 Migration Notes (House Style)

- Styling import: use `@navikt/ds-css` (not `@navikt/ds-css/darkside`).
- `Box.New` is removed in v8: use `Box`.
- Prefer numeric radius tokens (e.g. `"8"`, `"12"`) when `borderRadius` typing rejects legacy names.
- Color variants: avoid deprecated variants like `"danger"`, `"tertiary-neutral"`, `"secondary-neutral"`.
	- Use `data-color="danger" variant="primary"` for destructive actions.
	- Use `data-color="neutral" variant="tertiary"` for neutral tertiary actions.

## Project-specific notes

### Dashboard (`apps/lumi-dashboard`)
- Routes live under `apps/lumi-dashboard/app/routes/*`.
- Backend calls from server actions in `apps/lumi-dashboard/app/server/actions/*`.

### API (`apps/lumi-api`)
- Flyway migrations in `apps/lumi-api/src/main/resources/db/migration/*`.
- Auth via NAIS Texas introspection; avoid custom JWT verification.

### Survey widget (`packages/lumi-survey`)
- Keep accessibility and Aksel semantics intact.
- Widget styling must remain exportable via `@navikt/lumi-survey/styles.css`.

## Boundaries

### ✅ Always
- Run lint + typecheck (and relevant tests) for changed area(s)
- Prefer smallest change that solves the root cause

### ⚠️ Ask First
- Changing auth mechanisms (OBO/Texas/TokenX)
- Changing DB schema/migrations or production deployment config

### 🚫 Never
- Commit secrets
- Skip input validation or remove health/metrics endpoints
