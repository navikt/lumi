# Lumi repository guide

This file points coding agents to the durable repository rules. General agent
workflows are supplied outside the repository.

## Primary guidance source

Use repo-root `.github/` as the canonical source:

1. `.github/copilot-instructions.md`
2. `.github/instructions/*.instructions.md` (match by `applyTo`)

## Scope routing

- For `apps/lumi-api/**`:
  - Use `.github/instructions/kotlin-ktor.instructions.md`
  - Use `.github/instructions/database.instructions.md` for Flyway files
  - Use `.github/instructions/api-testing.instructions.md` for API test files

- For `apps/lumi-dashboard/**`:
  - Use `.github/instructions/tanstack-start-aksel.instructions.md`
  - Use `.github/instructions/dashboard-testing.instructions.md` for dashboard tests

- For `packages/lumi-survey/**`:
  - Use `.github/instructions/lumi-survey.instructions.md`

## Validation before completion

- Run `pnpm run lint`
- Run `pnpm run typecheck`
- Run targeted tests for changed area:
  - `pnpm test` for frontend/shared logic changes
  - `pnpm run api:test` for backend changes

## Working agreement

- Keep changes scoped and consistent with existing patterns.
- Do not introduce new auth mechanisms or DB migration semantics without explicit user confirmation.
- Use `pnpm` for scripts and installs (not `npm`/`yarn`).
