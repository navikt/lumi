# Changelog

All notable changes to `@navikt/lumi-survey` will be documented in this file.

This project follows SemVer.

## [Unreleased]

## [2.2.0] - 2026-08-31

Version 2.1.1 was prepared in the repository but never published. Its changes
are included in 2.2.0 together with the later additions since 2.1.0.

### Added

- Schema V2 submissions now include a versioned, canonical `visibleIf` flow
  contract. Surveys that still use deprecated imperative `logic` remain
  submission-compatible but deliberately omit the flow contract so analytics
  treats those rows as unpinned. Legacy `visibleIf` shapes that cannot be
  represented exactly by `visible-if-v1` likewise keep submitting without a
  flow contract instead of failing or recording false provenance.

### Fixed

- `validateSurveyDocumentV1` and `buildCanonicalSurvey` now reject `visibleIf`
  operators that cannot work against the referenced question's type — for
  example `EQ` against a multiChoice question, whose array answers never
  strictly equal a single value. The error names the owning question, the
  referenced question and its type, and the operators that are allowed. The
  runtime-compatible set per type is exported as
  `allowedVisibleIfOperators`. `CONTAINS` remains supported for string-valued
  single-choice answers so existing code-authored V1 documents keep working;
  the workshop continues to offer exact equality for that type. METADATA
  conditions and legacy flat surveys are unaffected.

- Focus now follows dock transitions: opening targets the active heading,
  closing targets the minimized trigger, and successful submission targets the
  receipt heading. The minimized trigger no longer references an unmounted
  panel through disclosure attributes.
- Consent storage no longer leaves the widget blank for five seconds when the
  Nav decorator is unavailable. The initial view is released after a 300 ms
  grace period while a late persisted dismissal can still be applied.
- Rating questions now expose exactly one named group to assistive
  technology. The prompt is the fieldset legend (a level 3 heading when
  visible), the fieldset itself carries `role="radiogroup"`, and the
  visually hidden legend copy no longer duplicates an external prompt
  heading. Screen readers previously announced the question up to three
  times per rating group.
- The published stylesheet now contains only `lumi-`-namespaced selectors.
  Unused CSS Module output previously leaked generic selectors such as
  `.container`, `.header`, `.panel` and `.active` into consumer applications.
- Star-rating icons now keep a stable pointer target while hover and focus
  feedback changes. In Chromium, swapping the icon element during a real
  pointer interaction could leave the star focused but unchecked, so a
  required star question could not be submitted.
- Text answers that exceed the configured limit, or the API maximum of 2000
  characters, are now blocked in the widget with a field-level validation
  message instead of failing permanently as a generic transport error.
- Inline `events` objects no longer count parent re-renders as new dock views
  or restart the success auto-close timer.
- Dismissal storage failures now invoke `onDismissalPersistFailed` with their
  cause, while intentional `none` storage and server rendering remain silent.

### Internal

- The local full-chain verification now exercises every stable survey and
  field scenario from the test bench and records per-scenario receipts in the
  release evidence.

## [2.1.0] - 2026-08-20

### Added

- `createRatingSurveyDocument` and `DEFAULT_RATING_SURVEY_DOCUMENT` make the page-based model the recommended starting point for rating surveys too.
- `createDiscoverySurveyDocument`, `createTopTasksSurveyDocument` and `createTaskPrioritySurveyDocument` provide verified, page-based `SurveyDocumentV1` templates for Lumi's specialized analytics.
- Specialized survey contracts are checked by the widget before transport so invalid field IDs or answer shapes cannot silently produce empty analytics.

### Fixed

- Specialized fields must now be required and always visible, Task Priority enforces a usable selection limit, optional answers are validated when supplied, and checkbox choices enforce `maxSelections` in the UI as well as at submission.
- Submission setup errors now settle the widget in its error state and call `onSubmitError` instead of leaving the UI in a permanent submitting state.
- The new Discovery, Top Tasks and Task Priority document builders use one canonical field vocabulary: `task`, `success`, `blocker` and `priority`. The widget and API continue to accept the field IDs emitted by the deprecated 2.0.1 builders. Specialized analytics require an explicit `type`, so ordinary surveys with similarly named fields are never misclassified.
- Multi-choice `maxSelections` is now part of the V2 definition contract and is enforced by the API. Existing definitions without the field are enriched once on their first compatible submission; later limit changes are rejected as structural changes.

### Documentation

- The legacy flat `LumiSurveyConfig`, rating presets and builders are marked deprecated in TypeScript while remaining runtime-compatible in 2.x.
- The package README now teaches `SurveyDocumentV1` as the only model for new surveys and links to the page, visibility and migration guides. Legacy flat configs, presets, builders and `logic` remain supported in 2.x but are documented only as compatibility APIs.
- The `LumiSurveyDock` example now uses a consumer-defined `survey` variable instead of the nonexistent `NAV_STANDARD_RATING` symbol.

## [2.0.1] - 2026-08-20

### Fixed

- Rating questions now render validation messages with Aksel's `ErrorMessage` in a permanently mounted, polite live region. This gives rating, text and choice fields the same visual treatment and announcement priority. Rating errors previously used a plain `BodyShort` with an assertive alert and a package-owned colour override.
- Rating choices now form one keyboard tab stop. Arrow keys move and select within emoji, thumbs, stars and NPS controls, including wrapping from the first choice to the last and back.

## [2.0.0] - 2026-08-19

This release adds the **page-based authoring format** (`SurveyDocumentV1`) — the
serializable document Surveyverksted produces. A consumer on 1.0.0 cannot
type-check or render an authored export at all, because the format did not
exist there.

### BREAKING

- `question.visibleIf` is now typed `VisibleIfCondition` (leaf | group) so it
  can carry `any`/`all` groups. Code that reads `visibleIf.operator` directly
  must narrow with `isConditionGroup`/`isLeafCondition` first. Authoring a
  condition is unchanged — only reading one back is affected. `LogicCondition`
  stays leaf-only, so `LogicRule` consumers are untouched. (#333)

The dock title renders at the same size as in 1.0.0. Its line height tightens,
and the description below it grows from 14px to 16px. See Changed.

### Added

- `SurveyDocumentV1` gains optional survey-level screens: `intro` (`title`, `body?`, `startLabel?`) and `success` (`title`, `body?`) as plain strings. `LumiSurveyDock` derives its intro/success screens from the document, with explicit embed props as field-level overrides — a partial `success={{ primaryLabel }}` keeps the authored title and body. Blank titles read as absent (lenient drafts never render an empty screen), and blank `startLabel` falls back to `"Start"` so the intro button always has an accessible name. `validateSurveyDocumentV1` shape-checks the new fields. (#441)

- `behavior.initialPageId`, `behavior.simulatedViewport` and `style.panelMaxHeight` add an embedding seam for authoring previews: start the flow on a specific authored page, size and classify (`viewport`/`deviceType`) from a simulated viewport, and constrain the open panel's height. Production behavior is unchanged when the props are absent. (#338)
- `validateSurveyDocumentV1` exposes the widget's runtime document validation as a pure public seam for authoring tools before preview or export. (#338)
- `SurveyDocumentV1`, `SurveyPageV1` and `SurveyQuestionV1` add a serializable page-based authoring format. A page can contain multiple questions that render and validate together; `singlePage` preserves page headings while step layout navigates pages. The new format uses question-level `visibleIf` and deliberately rejects legacy `logic`. Existing flat `LumiSurveyConfig` inputs remain supported unchanged. (#336)
- `visibleIf` now supports `any` (OR) and `all` (AND) to combine multiple conditions. The wider condition type is exported as `VisibleIfCondition` (with `isConditionGroup`/`getLeafConditions`/`isLeafCondition` helpers); `LogicCondition` stays leaf-only so `LogicRule` consumers are unaffected. Note: `question.visibleIf` is now typed `VisibleIfCondition` (leaf | group), so code reading `visibleIf.operator` directly must first narrow with `isConditionGroup`/`isLeafCondition`. (#333)

### Changed

- `behavior.initialPageId` now also suppresses the intro screen when the requested page exists in the document — an explicit start page (authoring previews, deep links) outranks the intro. A typo'd or unknown id keeps the intro and falls back to normal navigation. (#441)

- `createTopTasksSurvey` now expresses its flow with `visibleIf` instead of `logic`. Answer-based value conditions (`EQ`/`NEQ`/`GT`/`LT`/`CONTAINS`) automatically enable step mode under `questionLayout: "auto"`, while `EXISTS`-only progressive disclosure remains single-page. (#359)
- `behavior.showProgress: true` now shows progress from the first question in step mode. Intro and success screens are not counted, and single-step surveys omit the indicator. Branching exposes only the known step number to assistive technology. (#334)
- Progress indicators now include visible step text: `Steg X av N` for linear surveys and `Steg X` when branching makes the total uncertain. (#418)
- Dock header typography now comes from Aksel `Heading`/`BodyShort` props instead of `font-size` overrides in the package stylesheet. **Upgrading from 1.0.0 does not change the rendered header size:** 1.0.0 asked for `Heading medium` but the package's own unlayered rule overrode it to 1.25rem, so the header rendered at 20px/600 then and renders at 20px/600 now. Two smaller things do change: the heading's line height tightens from 32px to 28px, and the panel description grows from 14px to 16px, because it too came from a stylesheet override (`--ax-font-size-small`) and now uses `BodyShort size="small"` — which is 16px in Aksel's scale, not 14px. The header is the panel's title block and keeps one scale whatever fills it — an authored page title, the first question standing in for one, intro or success. (#416, #447)
- An authored page title now renders at the title scale with a visible group boundary above its questions. It previously shared the field scale with the question headings and labels below it (Aksel `Heading xsmall` and `.aksel-label` are both 1.125rem/bold), so a title, the question under it and the next field label were three identical lines. Applies both in the panel header and inline in `singlePage` layout. New in this release — the page format itself did not exist in 1.0.0. (#447)

### Fixed

- Step navigation now moves focus to the newly rendered question heading after both Next and Back, without stealing focus when an answer changes. (#417)
- `logic` conditions that reference another question via `condition.questionId` are now evaluated against that question's answer instead of the current question's. Cross-question branching (e.g. routing on an earlier answer) now works the same way `visibleIf` already did. (#332)
- Submissions now omit answers from questions hidden by `visibleIf` at submit time while retaining the complete survey definition. Hidden answers remain in local state so they are restored if the user reopens the branch. (#357)
- Reachable-step estimates now count overlapping unresolved `visibleIf` branches (such as multiple `NEQ`/`CONTAINS` conditions or overlapping numeric ranges) together while still counting mutually exclusive branches only once. (#358)
- `METADATA` conditions now receive auto-collected context fields (`deviceType`, `viewport`, `screenResolution`, `userAgent`) and opt-in location fields in addition to flattened `context.tags`. Submission-time visibility uses the same metadata map; `context.debug` remains excluded. (#144)

## [1.0.0] - 2026-06-24

This release switches the widget to the **v2 submission schema**. The widget now always emits `schemaVersion: 2`; the v1 wire format is no longer sent. Requires a backend that accepts schema v2 (`@navikt/lumi-api` with schema v2 support, shipped in #297).

### Changed

- **BREAKING:** Submissions are now sent with `schemaVersion: 2` — the widget no longer emits the v1 payload shape (#297)
- Each submission now carries a self-describing `definition` block (`SubmissionDefinition` with typed `fields`: `RATING`, `TEXT`, `SINGLE_CHOICE`, `MULTI_CHOICE`, `DATE`), so the survey structure travels with the data

### Added

- `deduplicationKey` on every submission for idempotent delivery: generated client-side, exposed via `getDeduplicationKey` from `useLumiSurvey`, and rotated after a successful submit and on reset
- New public types re-exported from the package: `LumiApiFeedbackSubmission` (the `V1 | V2` union), `LumiApiFeedbackSubmissionV2`, `LumiApiSubmissionDefinition`, and `LumiApiSubmissionFieldDefinition`

### Internal

- Migrated the workspace from npm to pnpm (#210) and upgraded to TypeScript 6 (#238)
- Removed unused close-button CSS from the dock fallback styles (#269)

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
