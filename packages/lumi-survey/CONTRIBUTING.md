# Contributing (Lumi Survey)

Dette dokumentet gjelder kun for `@navikt/lumi-survey`.

## Utvikling

Kjør fra repo root:

- `pnpm install --frozen-lockfile`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm --filter @navikt/lumi-survey test`

## Lage ny versjon av `@navikt/lumi-survey`

Monorepoet bruker workspaces, så til daglig trengs ingen publisering. Denne seksjonen er for når vi ønsker å publisere `@navikt/lumi-survey` til et registry for eksterne konsumenter.

### Viktig om TypeScript-typer

`@navikt/lumi-survey` publiserer TypeScript-typer via `dist/index.d.ts`.

For at konsumenter skal få autocomplete/typestøtte uten ekstra pakker, må typene være løselige uten interne workspace-avhengigheter. Derfor ligger API-kontrakten (TypeScript-typene) inne i `@navikt/lumi-survey`.

Vi holder kontrakten dependency-free (ingen Zod) for å minimere runtime-avhengigheter for eksterne konsumenter.

### Sjekkliste

1. Sørg for at endringen er bakoverkompatibel (semver).
2. Oppdater versjon i `packages/lumi-survey/package.json`.
2. Oppdater changelog: `packages/lumi-survey/CHANGELOG.md`.
3. Kjør kvalitetssjekker:
   - `pnpm run lint`
   - `pnpm run typecheck`
   - `pnpm run verify:lumi-survey`
   - `pnpm --filter @navikt/lumi-survey test`
4. Verifiser pakkeinnhold lokalt:
   - `pnpm --filter @navikt/lumi-survey pack --dry-run`
   - Sjekk at `dist/` inneholder `index.js`, `index.d.ts` og `index.css`.

## Versjonering (SemVer)

Vi følger SemVer: `MAJOR.MINOR.PATCH`.

- **PATCH** (`1.2.3` → `1.2.4`): Bugfix / intern refactor / docs. Ingen endring i public API eller kontrakt som bryter eksisterende konsumenter.
  - Eksempel: Fikser feil i branching, endrer feilmeldingstekst, forbedrer transportsikkerhet uten å endre typer.
- **MINOR** (`1.2.3` → `1.3.0`): Ny funksjonalitet som er bakoverkompatibel.
  - Eksempel: Ny survey preset-export, nye opsjoner som er valgfrie, nye typer/union-cases som ikke gjør eksisterende kode ugyldig.
- **MAJOR** (`1.2.3` → `2.0.0`): Breaking change.
  - Eksempel: Endrer props eller type-navn som eksisterende konsumenter bruker, fjerner exports, endrer kontrakt/transport-payload på en måte som gjør at eksisterende kode ikke kompilerer eller at runtime-endepunktet endrer forventet format.

Merk: før første stabile release kan vi starte på `0.1.0`. Da vil vi fortsatt bruke samme tenkning, men være litt mer fleksible.

## Changelog

Vi bruker `packages/lumi-survey/CHANGELOG.md` for release-notes.

Prinsipp:

- Hver gang du bumper versjon, legg inn en seksjon for den versjonen i changelog.
- Skriv kort og konkret (1–6 bullets). Tenk: "hva trenger en konsument å vite?".
- Interne refactors som ikke påvirker konsumenter kan stå under "Changed" eller utelates.

## Publisering til npmjs og GitHub Packages

Publisering er en “to-trinns” prosess:

1) Versjonsbump + endringer i en PR
2) Publiser fra `main` via GitHub Actions når PR er merget

### Steg-for-steg

1. Lag PR med endringen du vil slippe.
2. Velg SemVer-bump (patch/minor/major) basert på reglene over.
3. Oppdater versjon lokalt (anbefalt kommando):
   - `pnpm --filter @navikt/lumi-survey version patch --no-git-tag-version`
   - eller `pnpm --filter @navikt/lumi-survey version minor --no-git-tag-version`
   - eller `pnpm --filter @navikt/lumi-survey version major --no-git-tag-version`
4. Kjør sjekklista:
   - `pnpm run lint`
   - `pnpm run typecheck`
   - `pnpm run verify:lumi-survey`
   - `pnpm --filter @navikt/lumi-survey test`
   - `pnpm --filter @navikt/lumi-survey pack --dry-run`
5. Commit og push PR-en. Få PR-en merget til `main`.
6. Publiser:
   - GitHub → Actions → `Publish @navikt/lumi-survey (npmjs + GitHub Packages)`
   - Kjør først gjerne med `dry_run=true` (verifiserer alt uten publish)
   - Kjør deretter med `dry_run=false` for faktisk publisering

Workflowen pakker én tarball og publiserer den først til npmjs og deretter til
GitHub Packages. En omkjøring hopper bare over en eksisterende versjon når
tarballens digester er identiske. Release-taggen opprettes etter at begge
registrene er verifisert.

Publisering til npmjs bruker trusted publishing og krever ikke et langlivet
npm-token. Trusted publisher for pakken skal peke på GitHub-repoet
`navikt/lumi`, workflowfilen `publish-lumi-survey.yaml` og tillate
`npm publish`. GitHub Packages bruker workflowens kortlivede `GITHUB_TOKEN`.

**Første publisering til npmjs:**

npm krever at pakken finnes før trusted publisher kan konfigureres. En
npm-admin må derfor bootstrap-publisere en eksisterende release som offentlig
pakke og deretter konfigurere trusted publisher før den første kjøringen som
publiserer til begge registre. Ikke legg et npm-token i workflowen for å omgå
bootstrapen.

Monorepoets `.npmrc` beholdes fordi repoet også installerer interne
`@navikt`-pakker som bare finnes i GitHub Packages. Konsumenter av
`@navikt/lumi-survey` trenger ikke denne konfigurasjonen.

### Publisering (manuelt)

Dette er normalt ikke nødvendig. Anbefalt flyt er å publisere fra `main` via
workflowen over.

Bruk manuell publisering kun sammen med en npm-admin for bootstrap eller for å
rette opp en konkret publiseringsfeil. Den ordinære flyten skal alltid gå via
workflowen, slik at npmjs-publiseringen får provenance og begge registre
mottar samme tarball.
