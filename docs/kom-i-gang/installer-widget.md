---
title: Installer widgeten
---

# Installer widgeten

`@navikt/lumi-survey` viser surveyen i React-appen deres. Dere trenger React 18 eller nyere og Aksel 8 eller nyere.

## Installer pakken

```sh
pnpm add @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

Har appen allerede Aksel-pakkene, holder det å installere `@navikt/lumi-survey`.

## Importer stilarkene

Importer stilarkene i appens inngangsfil eller felles layout, for eksempel `main.tsx` eller `App.tsx`. Aksel-stilarket skal stå før Lumi-stilarket:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
```

## Neste steg

[Legg surveyen i appen](/kom-i-gang/konfigurer-survey) med TypeScript-filen fra Surveyverksted.
