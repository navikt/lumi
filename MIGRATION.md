# Migration to Lumi (from Flexjar)

Status as of 2026-01-14.

## What moved where

- `flexjar-analytics` (dashboard) → `apps/lumi-dashboard`
- `flexjar-analytics-api` (Ktor API) → `apps/lumi-api`
- `flexjar-widget` (widget) → `packages/lumi-survey`

New in Lumi:
- `packages/lumi-types` → shared TypeScript types and schemas used across the monorepo

The deprecated Flexjar repos are kept only for historical reference.

## Naming policy

- Public APIs and user-facing naming should use **Lumi**.
- Backwards-compatible aliases may exist internally to avoid breaking consumers.

## Consent storage compatibility (important)

The survey widget intentionally keeps the legacy NAV localStorage allowlist key pattern `flexjar-*` for consent-related persistence.

Reason: allowlisting a new key pattern requires coordination with another team, so we keep the existing allowlist-compatible pattern for now.

This does **not** prevent us from using Lumi naming elsewhere.

## Validation

Run these from the repo root:

- `npm run lint`
- `npm run typecheck`
- `npm -w packages/lumi-survey test`
- `npm test` (dashboard tests)

## Publishing guidance

- Inside this monorepo: no publishing is needed. `npm install` uses workspaces and the apps/packages depend on `@navikt/lumi-types` via the local workspace version.
- If you later want external consumers (outside this repo) to install `@navikt/lumi-survey`: you should publish `@navikt/lumi-types` and `@navikt/lumi-survey` together (same release process), or change `lumi-survey` to avoid a runtime dependency on a separately published types package.
