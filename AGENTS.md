# Lumi Codex Agent Guide

This file makes Codex use the same guidance model as GitHub Copilot in this repo.

## Primary guidance source

Use repo-root `.github/` as the canonical source:

1. `.github/copilot-instructions.md`
2. `.github/instructions/*.instructions.md` (match by `applyTo`)
3. `.github/agents/*.agent.md` (pick relevant domain agent)
4. `.github/skills/*/skill.md` and `.github/prompts/*.prompt.md` when task-specific

## Scope routing

- For `apps/lumi-api/**`:
  - Always load `.github/agents/lumi-api.agent.md`
  - Use `.github/instructions/kotlin-ktor.instructions.md`
  - Use `.github/instructions/database.instructions.md` for Flyway files
  - Use `.github/instructions/api-testing.instructions.md` for API test files

- For `apps/lumi-dashboard/**`:
  - Always load `.github/agents/tanstack-start.agent.md`
  - Use `.github/instructions/tanstack-start-aksel.instructions.md`
  - Use `.github/instructions/dashboard-testing.instructions.md` for dashboard tests

- For `packages/lumi-survey/**`:
  - Always load `.github/agents/lumi-survey.agent.md`
  - Use relevant `.github/skills/*` when contract/styling rules are involved

## App-local `.github` folders

`apps/*/.github/copilot-instructions.md` files are deprecated stubs. Treat them only as pointers back to repo-root `.github/`.

If app-local `agents/`, `instructions/`, or `skills/` are present, they are supplemental context. Prefer repo-root `.github/` when there is overlap or conflict.

## Validation before completion

- Run `npm run lint`
- Run `npm run typecheck`
- Run targeted tests for changed area:
  - `npm test` for frontend/shared logic changes
  - `npm run api:test` for backend changes

## Working agreement

- **Never push directly to `main`** — always create a feature branch and open a PR.
- Run `npm run lint` and `npm run typecheck` before pushing — CI will reject lint errors.
- Keep changes scoped and consistent with existing patterns.
- Do not introduce new auth mechanisms or DB migration semantics without explicit user confirmation.
- Use `npm` for scripts and installs (not `pnpm`/`yarn`).
