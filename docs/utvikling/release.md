---
title: Release-prosess
---

# Release-prosess

Release-prosess for `@navikt/lumi-survey`. Dashboard og API deployes automatisk via GitHub Actions og har ikke en manuell release-prosess.

## Versjonering (SemVer)

Vi følger [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Bump | Når | Eksempel |
| :--- | :--- | :--- |
| **PATCH** | Bugfix, intern refactor, docs. Ingen endring i public API. | `1.2.3` → `1.2.4` |
| **MINOR** | Ny funksjonalitet som er bakoverkompatibel. | `1.2.3` → `1.3.0` |
| **MAJOR** | Breaking change — endrer props, type-navn, fjerner exports, eller endrer transport-payload. | `1.2.3` → `2.0.0` |

::: info Pre-1.0
Før første stabile release (vi er på `0.x.y`) bruker vi samme tenkning, men er litt mer fleksible.
:::

## Sjekkliste

Før du publiserer en ny versjon:

1. Sørg for at endringen er **bakoverkompatibel** (med mindre det er en major-bump).
2. Oppdater versjon i `packages/lumi-survey/package.json`.
3. Oppdater [changelog](/referanse/changelog): `packages/lumi-survey/CHANGELOG.md`.
4. Kjør kvalitetssjekker:
   ```sh
   npm run lint
   npm run typecheck
   npm run verify:lumi-survey
   npm -w @navikt/lumi-survey test
   ```
5. Verifiser pakkeinnhold lokalt:
   ```sh
   npm -w @navikt/lumi-survey pack --dry-run
   ```
   Sjekk at `dist/` inneholder `index.js`, `index.d.ts` og `index.css`.

## Publisering via GitHub Actions (anbefalt)

Publisering er en to-trinns prosess:

### 1. Versjonsbump i PR

```sh
# Velg riktig bump-type:
npm version patch -w @navikt/lumi-survey --no-git-tag-version
# eller: npm version minor -w @navikt/lumi-survey --no-git-tag-version
# eller: npm version major -w @navikt/lumi-survey --no-git-tag-version
```

Commit versjonsbump + changelog-oppdatering i PR-en. Få den merget til `main`.

### 2. Publiser fra main

1. Gå til GitHub → **Actions** → **Publish @navikt/lumi-survey (GitHub Packages)**.
2. Kjør først med `dry_run=true` for å verifisere uten å publisere.
3. Kjør deretter med `dry_run=false` for faktisk publisering.

::: warning Publiser alltid fra main
Publiser kun fra `main`-branchen for å sikre at publisert kode matcher det som er reviewet og merget.
:::

## Manuell publisering

::: details Kun for feilsøking
Manuell publisering er normalt ikke nødvendig. Bruk det kun for å debugge publish-problemer.

Krav: Samme kvalitetssjekker som CI (lint/typecheck/verify/tests + `pack --dry-run`), pluss en token med skriverettigheter til GitHub Packages.

```sh
npm -w @navikt/lumi-survey publish
```

Se `publishConfig.registry` i `packages/lumi-survey/package.json` for registry-konfigurasjon.
:::

## TypeScript-typer

`@navikt/lumi-survey` publiserer TypeScript-typer via `dist/index.d.ts`. Typene er dependency-free (ingen Zod-runtime) slik at konsumenter får autocomplete uten ekstra pakker.

::: tip
API-kontrakten (TypeScript-typene) ligger inne i `@navikt/lumi-survey` — ikke i en separat pakke. Vi holder den dependency-free for å minimere runtime-avhengigheter for eksterne konsumenter.
:::

## Changelog

Vi bruker `packages/lumi-survey/CHANGELOG.md` for release-notes.

- Legg inn en ny seksjon for hver versjon.
- Skriv kort og konkret (1–6 bullets). Tenk: «hva trenger en konsument å vite?»
- Interne refactors som ikke påvirker konsumenter kan stå under «Changed» eller utelates.

Se [changelog](/referanse/changelog) for full versjonshistorikk.

## Se også

- [Bidra til Lumi](/utvikling/bidra) — lokal utvikling og monorepo-kommandoer
- [Changelog](/referanse/changelog) — versjonshistorikk
