---
title: Installer widget
---

# Installer widget

Denne siden viser deg hvordan du installerer `@navikt/lumi-survey` og får widgeten til å rendre i appen din.

## 1. Konfigurer npm-registry

`@navikt/lumi-survey` publiseres til GitHub Packages. Legg til en `.npmrc`-fil i roten av prosjektet ditt (ved siden av `package.json`):

```properties
@navikt:registry=https://npm.pkg.github.com
```

## 2. Installer pakken

```sh
npm install @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

::: info Peer dependencies
`@navikt/lumi-survey` krever Aksel v8 (`@navikt/ds-react` og `@navikt/ds-css` versjon 8 eller nyere) som peer dependencies. Har du disse fra før, trenger du bare:

```sh
npm install @navikt/lumi-survey
```
:::

## 3. Importer CSS

Importer stilarkene i appens entry-punkt (f.eks. `main.tsx`, `App.tsx` eller layout-filen din):

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
```

::: warning Rekkefølge
`@navikt/ds-css` **må** importeres **før** `@navikt/lumi-survey/styles.css` for at styling skal fungere korrekt.
:::

## 4. Rendre widgeten

Her er et minimalt eksempel som viser en survey-widget i appen din:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import {
  LumiSurveyDock,
  DEFAULT_SURVEY_RATING,
  type LumiSurveyTransport,
} from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  async submit(submission) {
    await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};

export function App() {
  return (
    <LumiSurveyDock
      surveyId="min-app-tilbakemelding"
      survey={DEFAULT_SURVEY_RATING}
      transport={transport}
    />
  );
}
```

La oss bryte ned de viktigste delene:

- **`surveyId`** — en unik identifikator for surveyen din (f.eks. `"soknad-kvittering"`)
- **`survey`** — konfigurasjonen for spørsmålene. Her bruker vi den ferdiglagde `DEFAULT_SURVEY_RATING`-preseten
- **`transport`** — et objekt med en `submit`-funksjon som sender data til din backend. Widgeten kaller denne med `submission.transportPayload` som inneholder alle svar

::: tip Transport-endepunktet
`/api/lumi/feedback` i eksempelet over er ditt eget endepunkt. Det mottar payloaden fra widgeten, gjør token exchange, og videresender til Lumi API. Vi setter opp dette i [Koble til backend](/kom-i-gang/koble-til-backend).
:::

## Verifiser at det fungerer

Når du starter appen din bør du se en survey-widget nederst på siden. Den viser en emoji-rating med valgfri fritekst — det er `DEFAULT_SURVEY_RATING`-preseten.

Innsending vil feile (du har ikke satt opp backend ennå), men du kan bekrefte at widgeten rendres riktig.

## Neste steg

Widgeten kjører! Gå videre til [Konfigurer survey](/kom-i-gang/konfigurer-survey) for å velge riktig surveytype for ditt behov.
