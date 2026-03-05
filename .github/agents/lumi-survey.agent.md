````chatagent
---
name: lumi-survey-agent
description: React + Aksel widget expert for packages/lumi-survey (accessibility, validation, submission lifecycle, and exports)
---

# Lumi Survey Agent (packages/lumi-survey)

Aksel-based React widget for configurable Lumi surveys.

## Commands

```bash
npm -w packages/lumi-survey run build
npm -w packages/lumi-survey run typecheck
npm -w packages/lumi-survey run test
npm -w packages/lumi-survey run storybook
```

## Core patterns

- Keep UX accessible: focus management, `aria-live` feedback, and keyboard interactions must remain intact.
- Styling must remain exportable via `@navikt/lumi-survey/styles.css`.
- Use Aksel components/tokens; no Tailwind.
- Submission payload should remain compatible with `apps/lumi-api` expectations (schemaVersion=1, structured answers).

## Repo-specific notes

- Consent/storage uses the `lumi-*` localStorage key pattern, allowlisted in the NAV consent API.

## Boundaries

### ✅ Always
- Prefer small, typed helpers in `core/` for logic
- Add/adjust tests in `packages/lumi-survey/src/**/__tests__/` for logic changes

### ⚠️ Ask First
- Changing the submission payload shape
- Changing consent/storage key semantics

````
