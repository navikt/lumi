---
title: Installer widgeten
---

# Installer widgeten

`@navikt/lumi-survey` viser surveyen i React-appen deres. Dere trenger React 18 eller nyere og Aksel 8 eller nyere.

## Installer pakken

```sh
pnpm add @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

Har appen allerede Aksel 8 eller nyere, holder det å installere `@navikt/lumi-survey`.

Be om tilgang til Lumi API nå, fordi Team eSyfo må godkjenne den, se [Koble til backend](/kom-i-gang/koble-til-backend#mottakeren-inbound).

## Importer stilarkene

Importer stilarkene i appens inngangsfil eller felles layout. Med Vite er det for eksempel `main.tsx` eller `App.tsx`, og i Next.js App Router er det `app/layout.tsx`. Aksel-stilarket skal stå før Lumi-stilarket:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
```

Deretter [legger dere surveyen inn i appen](/kom-i-gang/konfigurer-survey) med TypeScript-filen fra Surveyverksted. Bruker appen Next.js App Router, importerer dere widgeten fra `@navikt/lumi-survey/client`, eller starter filen med widgeten med `"use client"`. Se [Next.js App Router](/kom-i-gang/konfigurer-survey#next-js).
