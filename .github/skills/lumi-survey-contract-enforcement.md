# Skill: Enforce `@navikt/lumi-survey` packaging boundaries

## Goal
Keep `@navikt/lumi-survey` publishable for external consumers without requiring internal workspace-only packages or extra runtime dependencies.

## Non-negotiables
- `@navikt/lumi-survey` must not depend on `@navikt/lumi-types`.
- `@navikt/lumi-survey` must not depend on `zod`.
- Built artifacts in `packages/lumi-survey/dist` must not contain imports/references to `@navikt/lumi-types` or `zod`.

## How to verify
From repo root:
- `pnpm run verify:lumi-survey`

This will build `@navikt/lumi-survey` and fail if forbidden dependencies leak into source or `dist`.

## If a change requires shared contracts
Prefer copying the minimal contract subset into `packages/lumi-survey/src/contracts/`.
If multiple external packages/repos must share a contract, consider extracting a dedicated published contract package later.
