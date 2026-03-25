# Changelog

All notable changes to `@navikt/lumi-survey` will be documented in this file.

This project follows SemVer.

## [Unreleased]

## [0.4.0] - 2026-03-25

### Added

- Multi-signal device detection: uses UA Client Hints, UA string parsing, and iPadOS 13+ heuristic (`maxTouchPoints`) before falling back to viewport width (Closes #168)
- `screenResolution` field in submission context — captures actual screen dimensions via `window.screen`

### Changed

- `deviceType` classification is now based on actual device signals instead of viewport width alone, fixing misclassification when browser DevTools is open

## [0.3.0] - 2026-03-20

### Added

- `hasIntro` prop on `ProgressProps` — shows progress bar from step 0 when survey has intro page

### Fixed

- Progress bar no longer jumps/oscillates with chained `visibleIf` conditions (Closes #163)
- Progress bar now reaches 100% on the last step in branching surveys
- Progress bar only updates on navigation events, preventing visual jitter from checkbox interactions

### Changed

- Replaced high-water mark mechanism with direct reachability estimation via `computeReachableSteps` algorithm

## [0.2.0] - 2026-03-17

### Added

- Added optional `intro` support to `LumiSurveyDock`, so surveys can start with an intro screen before the first question.
- Added `behavior.showProgress` and `events.onStepChange` for step-based surveys, including progress feedback based on visible steps.
- Added `DEFAULT_SURVEY_THUMBS`, `DEFAULT_SURVEY_STARS`, and `DEFAULT_SURVEY_NPS` exports for ready-made rating surveys.

### Changed

- `useLumiSurvey().validate()` and `submit()` now accept an optional question subset, so step-based and branched flows can validate only the questions in the active path.

### Fixed

- Step navigation now respects `visibleIf` conditions when moving through branched surveys.
- Removed the horizontal scrollbar on emoji rating rows and improved smiley alignment.

## [0.1.1] - 2026-03-05

### Changed

- localStorage key prefix changed from `flexjar-*` to `lumi-*`. Previously dismissed surveys will reappear once as the old keys are no longer read. Requires `lumi-*` to be allowlisted in the NAV consent API.

### Removed

- Removed all legacy `flexjar` references from source, mocks, and documentation.
- Removed duplicate test file `FlexJarDock.test.tsx` (covered by `LumiSurveyDock.test.tsx`).

## [0.1.0] - 2026-02-26

### Changed

- Removed `@navikt/nav-dekoratoren-moduler` dependency. The `consent` storage strategy now reads directly from the NAV consent API window globals (`window.__DECORATOR_DATA__` and `window.webStorageController`). No extra npm package needed — behavior is identical.
- Simplified consent API polling logic (setInterval instead of recursive setTimeout).
- Cleaned up Storybook config (removed module aliasing and viteFinal override).

## [0.0.5] - 2026-01-21

### Changed

- Tooling: upgraded to Vitest v4 and added V8 coverage provider support (`@vitest/coverage-v8`).

## [0.0.4] - 2026-01-21

### Fixed

- Next.js/SSR safety: LumiSurveyDock is a client component and avoids `window is not defined` during server rendering.

## [0.0.3] - 2026-01-21

### Changed

- Rating surveys: the first rating question defaults to `required: true` when omitted.
- Submit UX: button stays hidden until the user has interacted (validation happens on submit).
- Optional labeling: “(valgfritt)” is derived from `required` consistently; presets no longer hardcode it in prompt strings.

## [0.0.2] - 2026-01-21

### Added

- Runtime validation for invalid question references (visibility/branching).
- NPS hover/focus styling (moved to dedicated NPS styles).

### Changed

- Privacy-safe defaults: `url` is never auto-collected; `pathname` is only auto-collected when `behavior.collectLocation` is enabled.
- Personal data notice is only shown when a text question is actually visible.
- Submit UX: submit button is hidden until submission is possible (no disabled “send” button).
- Logic conditions: `field` defaults to `"ANSWER"` when omitted.

### Removed

- Deprecated `createLumiApiTransport()` export.

## [0.0.1] - 2026-01-19

### Added

- First installable edition

### Changed

- Made `@navikt/lumi-survey` self-contained for external publishing.
