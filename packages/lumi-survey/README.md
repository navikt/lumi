# Lumi Survey

Aksel-basert React-widget for å samle inn brukertilbakemeldinger via Lumi.

- [Kom i gang](https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi)
- [Lag en survey](https://navikt.github.io/lumi/kom-i-gang/lag-survey)
- [Props-referanse](https://navikt.github.io/lumi/referanse/props-referanse)

## Installer

Pakken publiseres til GitHub Packages. Legg dette i prosjektets `.npmrc`:

```properties
@navikt:registry=https://npm.pkg.github.com
```

Installer pakken og Aksel 8 eller nyere:

```sh
pnpm add @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

Importer stilarkene i denne rekkefølgen:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
```

## Legg til en survey

Bruk `SurveyDocumentV1` for nye surveyer. Et dokument kan ha en velkomstside, én eller flere sider med spørsmål og eget innhold i bekreftelsen etter innsending.

```tsx
import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  type SurveyDocumentV1,
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
    {
      id: "oppfolging",
      questions: [
        {
          id: "forbedring",
          type: "text",
          prompt: "Hva kan vi gjøre bedre?",
          visibleIf: {
            questionId: "opplevelse",
            operator: "LT",
            value: 4,
          },
        },
      ],
    },
  ],
  success: {
    title: "Svaret er sendt inn",
    body: "Takk for at du hjelper oss å gjøre tjenesten bedre.",
  },
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

export function FeedbackWidget() {
  return (
    <LumiSurveyDock
      surveyId="min-flate-tilbakemelding"
      survey={survey}
      transport={transport}
    />
  );
}
```

Hver side blir et steg når dokumentet har flere sider. Legg flere spørsmål på samme side når de skal vises og valideres sammen. Bruk `visibleIf` for å vise bare relevante oppfølgingsspørsmål.

Bruk de sidebaserte malene når dere vil starte fra et kontrollert oppsett: `createRatingSurveyDocument`, `createDiscoverySurveyDocument`, `createTopTasksSurveyDocument` og `createTaskPrioritySurveyDocument`. Se [Velg hva dere vil måle](https://navikt.github.io/lumi/guider/surveytyper) for eksempler og valg av metode.

## Koble til Lumi

`transport.submit` skal sende `submission.transportPayload` til appens eget endepunkt. Endepunktet gjør token exchange og videresender til Lumi API.

Se [Koble til backend](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend) for TokenX, Azure AD og NAIS-oppsett.

## Velg hvordan lukking huskes

- `consent` er standard for nav.no og bruker samtykkeløsningen fra dekoratøren.
- `localStorage` passer for interne flater uten samtykke-API.
- `none` lagrer ikke at brukeren har lukket widgeten.

```tsx
<LumiSurveyDock
  {...otherProps}
  behavior={{ storageStrategy: "localStorage" }}
/>
```

## Eldre surveyer

Flat `LumiSurveyConfig`, eldre presets, eldre builder-funksjoner og `logic` fortsetter å virke i 2.x. Ikke bruk dem i nye surveyer. Funksjonene som ender på `SurveyDocument` er de anbefalte, sidebaserte malene. Se [migreringsguiden](https://navikt.github.io/lumi/referanse/migrer-eldre-survey) når du skal endre en eksisterende survey.
