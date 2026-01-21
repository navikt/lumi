# Changelog

All notable changes to `@navikt/lumi-survey` will be documented in this file.

This project follows SemVer.

## [Unreleased]

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
