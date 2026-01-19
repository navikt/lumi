# Contributing (Lumi Survey)

Dette dokumentet gjelder kun for `@navikt/lumi-survey`.

## Utvikling

Kjør fra repo root:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm -w @navikt/lumi-survey test`

## Lage ny versjon av `@navikt/lumi-survey`

Monorepoet bruker workspaces, så til daglig trengs ingen publisering. Denne seksjonen er for når vi ønsker å publisere `@navikt/lumi-survey` til et registry for eksterne konsumenter.

### Viktig om TypeScript-typer

`@navikt/lumi-survey` publiserer TypeScript-typer via `dist/index.d.ts`.

For at konsumenter skal få autocomplete/typestøtte uten ekstra pakker, må typene være løselige uten interne workspace-avhengigheter. Derfor ligger API-kontrakten som `createLumiApiTransport()` bruker inne i `@navikt/lumi-survey`.

Vi holder kontrakten dependency-free (ingen Zod) for å minimere runtime-avhengigheter for eksterne konsumenter.

### Sjekkliste

1. Sørg for at endringen er bakoverkompatibel (semver).
2. Oppdater versjon i `packages/lumi-survey/package.json`.
3. Kjør kvalitetssjekker:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run verify:lumi-survey`
   - `npm -w @navikt/lumi-survey test`
4. Verifiser pakkeinnhold lokalt:
   - `npm -w @navikt/lumi-survey pack --dry-run`
   - Sjekk at `dist/` inneholder `index.js`, `index.d.ts` og `index.css`.

### Publisering (manuelt)

Når dere er klare for faktisk publisering må dette være avklart først:

- Hvilket registry (npmjs / GitHub Packages / intern løsning)
- Tilgang til `@navikt`-scope og publish-token
- `private` må være fjernet eller satt til `false` i `packages/lumi-survey/package.json`

Deretter kan du publisere fra repo root, f.eks:

- `npm -w @navikt/lumi-survey publish`

(Flagg som `--access public` kan være nødvendig, avhengig av registry/scope-policy.)
