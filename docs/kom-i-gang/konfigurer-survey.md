---
title: Legg surveyen i appen
---

# Legg surveyen i appen

En survey består av én eller flere sider med spørsmål. Den kan også ha en velkomstside og eget innhold i bekreftelsen etter innsending. Definer alt som et `SurveyDocumentV1`.

```text
SurveyDocumentV1
├── intro?    Valgfri velkomstside
├── pages     Én eller flere sider med spørsmål
└── success?  Valgfritt eget innhold i bekreftelsen
```

Dette er formatet vi anbefaler for alle nye surveyer. Widgeten støtter fortsatt eldre konfigurasjoner, men du trenger ikke lære den gamle modellen for å lage en ny survey.

## Bruk versjonen fra Surveyverksted

Har dere laget surveyen i Surveyverksted, åpner du versjonen dere vil ta i bruk og velger **Kopier TypeScript**. Lim dokumentet inn i for eksempel `survey.ts`, og importer det der `LumiSurveyDock` rendres:

```tsx
import { survey } from "./survey";

<LumiSurveyDock
  surveyId="min-flate-tilbakemelding"
  survey={survey}
  transport={transport}
/>
```

Eksporten inneholder `satisfies SurveyDocumentV1`, slik at appens TypeScript-oppsett sjekker dokumentet. Appen eier filen og ruller den ut på vanlig måte.

Surveyverksted setter `type` og analysefeltene fra oppsettet dere valgte da utkastet ble opprettet. Ikke endre disse for hånd i den eksporterte koden. Skal surveyen måle noe annet, lag et nytt utkast med riktig oppsett. Se [Velg hva dere vil måle](/guider/surveytyper).

Skriver du surveyen direkte i kode, kan du starte med eksempelet under.

## Lag et dokument

Eksempelet under viser ett spørsmål om gangen. Hvert spørsmål ligger på sin egen side. Hver side blir et steg, og brukeren går videre med **Neste**.

```typescript
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

export const mySurvey = {
  authoringSchemaVersion: 1,
  type: "rating",
  intro: {
    title: "Hjelp oss å gjøre tjenesten bedre",
    body: "Du får to korte spørsmål om opplevelsen.",
    startLabel: "Start",
  },
  pages: [
    {
      id: "vurdering",
      questions: [
        {
          id: "inntrykk",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var opplevelsen din?",
          required: true,
        },
      ],
    },
    {
      id: "utdyping",
      questions: [
        {
          id: "innspill",
          type: "text",
          prompt: "Hva kan vi gjøre bedre?",
          maxLength: 1000,
          visibleIf: {
            questionId: "inntrykk",
            operator: "LT",
            value: 4,
          },
        },
      ],
    },
  ],
  success: {
    title: "Takk for tilbakemeldingen",
    body: "Vi bruker svaret til å gjøre tjenesten bedre.",
  },
} satisfies SurveyDocumentV1;
```

De viktigste delene er:

- `authoringSchemaVersion` forteller hvilken versjon av dokumentformatet du bruker.
- `type` forteller dashboardet hva surveyen måler.
- `pages` bestemmer hva som vises sammen, og hva som blir neste steg.
- `visibleIf` viser et spørsmål bare når det er relevant.
- `intro` og `success` er valgfrie. De gir brukeren en tydelig start og avslutning.

::: tip Bruk `satisfies`
`satisfies SurveyDocumentV1` sjekker dokumentet uten å gjøre typene mer generelle enn nødvendig. Da får du gode TypeScript-feil på feil feltnavn, tomme sider og ugyldige spørsmål.
:::

## Velg hva som skal stå på samme side

Bruk som hovedregel én side per spørsmål. Da får brukeren ett spørsmål om gangen uten ekstra konfigurasjon.

Legg flere spørsmål på samme side når de hører tett sammen og bør besvares som en gruppe. En sidetittel er valgfri. Bruk den bare når den tilfører kontekst som spørsmålsteksten ikke allerede gir.

Se [Sider og flyt](/guider/sider-og-flyt) for eksempler og anbefalinger.

## Vis bare relevante spørsmål

I eksempelet vises `innspill` bare når vurderingen er lavere enn 4. En side uten synlige spørsmål hoppes over automatisk.

Se [Vis bare relevante spørsmål](/guider/betinget-synlighet) for operatorer og kombinasjoner med `any` og `all`.

## Gi surveyen en stabil identitet

`surveyId` settes på `LumiSurveyDock`, ikke i dokumentet. Behold samme ID så lenge surveyen måler det samme med samme betydning. Bytt ID når du endrer spørsmål eller svaralternativer slik at resultatene ikke lenger kan sammenlignes.

Se [Survey-identitet og endringer](/guider/survey-identitet) for beslutningstabellen.

## Sjekk før du går live

- Prøv hele flyten med tastatur og på liten skjerm.
- Sjekk at bare relevante spørsmål dukker opp.
- Hold surveyen kort. Spør bare om det dere skal bruke svarene til.
- Bruk konkrete spørsmål om opplevelsen brukeren nettopp hadde.
- Unngå personopplysninger i spørsmål, `context` og fritekst der det er mulig.

## Neste steg

Gå videre til [Koble til backend](/kom-i-gang/koble-til-backend) for å lagre svarene i Lumi.
