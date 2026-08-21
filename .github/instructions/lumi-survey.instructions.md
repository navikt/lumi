---
applyTo: "packages/lumi-survey/**/*.{ts,tsx,css,json,md}"
---

# Lumi Survey package rules

`@navikt/lumi-survey` is a published React package used outside this monorepo.
Changes must preserve its public contract, accessibility and packaging boundary.

## Public API and compatibility

- Use `SurveyDocumentV1` for new authoring APIs. Keep the legacy flat config
  working throughout 2.x, but do not extend or recommend it.
- Treat question IDs, option values, transport payloads and exported TypeScript
  types as public contracts. Add regression tests for contract changes.
- Keep runtime behavior compatible with the Lumi API validation rules.
- Document public additions in `packages/lumi-survey/CHANGELOG.md` and use
  SemVer when changing the package version.

## Packaging boundary

- Do not depend on `@navikt/lumi-types`, `zod` or other workspace-only packages.
- Keep the minimal public transport contracts in `src/contracts/`.
- Do not allow internal package references to leak into `dist`.
- Run `pnpm run verify:lumi-survey` after changing source, exports, dependencies
  or build configuration.

## UI and styling

- Use Aksel components and tokens. The peer dependency floor is Aksel v8.
- Preserve keyboard behavior, focus management and live-region semantics.
- Keep styles available through `@navikt/lumi-survey/styles.css` and avoid
  selectors that require dashboard-specific markup.
- Add or update tests under `src/**/__tests__/` for behavior changes.

## Verification

From the repository root, run:

```sh
pnpm --filter @navikt/lumi-survey run test
pnpm --filter @navikt/lumi-survey run typecheck
pnpm run verify:lumi-survey
```
