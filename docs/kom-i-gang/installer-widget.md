---
title: Installer widget
---

# Installer widget

Denne siden viser deg hvordan du installerer `@navikt/lumi-survey` og får widgeten til å rendre i appen din.

## 1. Installer pakken

`@navikt/lumi-survey` publiseres offentlig på npmjs. Installasjonen krever
verken `.npmrc` eller GitHub-token:

```sh
pnpm add @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
# eller: npm install @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
# eller: yarn add @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

Guidene bruker `SurveyDocumentV1`, som krever `@navikt/lumi-survey` 2.0.0 eller nyere.

::: info Peer dependencies
`@navikt/lumi-survey` krever Aksel v8 (`@navikt/ds-react` og `@navikt/ds-css` versjon 8 eller nyere) som peer dependencies. Har du disse fra før, trenger du bare:

```sh
pnpm add @navikt/lumi-survey
# eller: npm install @navikt/lumi-survey
# eller: yarn add @navikt/lumi-survey
```
:::

## 2. Importer CSS

Importer stilarkene i appens entry-punkt (f.eks. `main.tsx`, `App.tsx` eller layout-filen din):

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
```

::: warning Rekkefølge
`@navikt/ds-css` **må** importeres **før** `@navikt/lumi-survey/styles.css` for at styling skal fungere korrekt.
:::

## 3. Rendre widgeten

Her er et minimalt eksempel som viser en survey-widget i appen din:

```tsx
import {
  LumiSurveyDock,
  type SurveyDocumentV1,
  type LumiSurveyTransport,
} from "@navikt/lumi-survey";

const survey = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "vurdering",
      questions: [
        {
          id: "opplevelse",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var opplevelsen din?",
          required: true,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

const transport: LumiSurveyTransport = {
  async submit(submission) {
    const response = await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
    if (!response.ok) {
      throw new Error(`Innsending feilet med status ${response.status}`);
    }
  },
};

export function App() {
  return (
    <LumiSurveyDock
      surveyId="min-app-tilbakemelding"
      survey={survey}
      transport={transport}
    />
  );
}
```

La oss bryte ned de viktigste delene:

- **`surveyId`** — en unik identifikator for surveyen din (f.eks. `"soknad-kvittering"`)
- **`survey`** — innholdet og sidene brukeren skal gå gjennom
- **`transport`** — et objekt med en `submit`-funksjon som sender data til din backend. Widgeten kaller denne med `submission.transportPayload` som inneholder alle svar

::: tip Transport-endepunktet
`/api/lumi/feedback` i eksempelet over er ditt eget endepunkt. Det mottar payloaden fra widgeten, gjør token exchange, og videresender til Lumi API. Vi setter opp dette i [Koble til backend](/kom-i-gang/koble-til-backend).
:::

## Sjekk at det fungerer

Når du starter appen din, skal du se en survey-widget nederst på siden. Den viser spørsmålet med emoji-skalaen fra `survey`-objektet.

Dette er et midlertidig eksempel for å sjekke installasjonen. I neste steg erstatter du `survey` med dokumentet fra Surveyverksted eller dokumentet dere skriver i kode.

Innsending vil feile (du har ikke satt opp backend ennå), men du kan bekrefte at widgeten rendres riktig.

## Neste steg

Widgeten kjører. Gå videre til [Legg surveyen i appen](/kom-i-gang/konfigurer-survey) for å bruke dokumentet fra Surveyverksted eller kode.
