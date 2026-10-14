---
title: Sider og flyt
---

# Sider og flyt

Surveyen består av sider, og brukeren går gjennom dem i samme rekkefølge som de står i Surveyverksted. Som standard viser widgeten én side om gangen.

## Sider i Surveyverksted

Et nytt spørsmål får sin egen side. Under **Hvor skal det vises?** i redigeringen av et spørsmål velger dere **På en egen side**, eller for eksempel **Sammen med spørsmål 2** for å legge det på siden til spørsmålet før. Sidene flytter dere med pilene **Flytt side opp** og **Flytt side ned** i lista **Spørsmål**.

En felles overskrift for en side med flere spørsmål skriver dere under **Hjelpetekst og flere innstillinger**, i feltene **Felles overskrift på siden** og **Felles hjelpetekst på siden**.

Kodeeksemplene under er for utviklere.

## Delene i en survey

- Velkomstsiden (`intro`) gir kort kontekst før surveyen begynner.
- En side (`pages[]`) er spørsmålene som vises sammen.
- Spørsmålene (`questions[]`) er det brukeren svarer på.
- Når Lumi viser én side om gangen, er hver synlig side et steg.
- Takkesiden etter innsending forteller at svaret er levert. Bruk `success` når dere vil tilpasse teksten.

Velkomstsiden og takkesiden telles ikke med i framdriften.

## Ett spørsmål om gangen

Legg hvert spørsmål på sin egen side. Når dokumentet har flere sider, viser `questionLayout: "auto"` dem som steg. `auto` er standard, så dere trenger ikke sette det selv.

```typescript
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

const survey = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "oppgave",
      questions: [
        {
          id: "hva-ville-du-gjore",
          type: "text",
          prompt: "Hva kom du hit for å gjøre?",
          required: true,
        },
      ],
    },
    {
      id: "resultat",
      questions: [
        {
          id: "fikk-du-gjort-det",
          type: "singleChoice",
          prompt: "Fikk du gjort det du skulle?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "delvis", label: "Delvis" },
            { value: "nei", label: "Nei" },
          ],
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;
```

Surveyverksted lager nesten den samme surveyen når dere velger **Hva kom brukeren for å gjøre?**, og da viser dashboardet også oppgavene som går igjen. Se [Velg hva dere vil måle](/guider/surveytyper).

Ikke legg inn en sidetittel som bare gjentar spørsmålet. Spørsmålsteksten er allerede overskriften brukeren trenger.

## Flere spørsmål på samme side

Samle spørsmål på samme side når de må leses eller besvares i sammenheng. En kort sidetittel og beskrivelse kan da gi felles kontekst.

```typescript
{
  id: "kontaktopplevelse",
  title: "Om kontakten med Nav",
  description: "Tenk på den siste gangen du tok kontakt.",
  questions: [
    {
      id: "kanal",
      type: "singleChoice",
      prompt: "Hvordan tok du kontakt?",
      required: true,
      options: [
        { value: "telefon", label: "Telefon" },
        { value: "chat", label: "Chat" },
        { value: "skriv", label: "Skriv til oss" },
      ],
    },
    {
      id: "opplevelse",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan opplevde du kontakten?",
      required: true,
    },
  ],
}
```

Brukeren må svare på alle synlige, obligatoriske spørsmål på siden før hen kan gå videre.

## Hopp over sider som ikke er relevante

Sett `visibleIf` på spørsmålene som skal vises betinget. En side hoppes over når ingen av spørsmålene på den er synlige. Hvordan betingelsene skrives, står i [Vis bare relevante spørsmål](/guider/betinget-synlighet).

```typescript
{
  id: "oppfolging",
  questions: [
    {
      id: "hva-manglet",
      type: "text",
      prompt: "Hva manglet for at du skulle bli ferdig?",
      visibleIf: {
        all: [
          { questionId: "fikk-du-gjort-det", operator: "EXISTS" },
          {
            questionId: "fikk-du-gjort-det",
            operator: "NEQ",
            value: "ja",
          },
        ],
      },
    },
  ],
}
```

Flyten går alltid framover: widgeten viser de synlige sidene i rekkefølgen i `pages`, og `visibleIf` kan bare vise til spørsmål som kommer før.

## Start og avslutt tydelig

Bruk en velkomstside når brukeren trenger å vite hvorfor dere spør, omtrent hvor lang tid det tar eller hva svaret brukes til. Oppgi tidsbruk bare når dere har testet den. I Surveyverksted velger dere **Velkomstside** i lista og krysser av for **Vis velkomstside før spørsmålene**. I kode heter den `intro`.

Tilpass takkesiden når standardteksten ikke er presis nok. Skriv hva som har skjedd og eventuelt hva som skjer videre. I Surveyverksted velger dere **Takkeside** i lista og deretter **Tilpass takkesiden**. I kode heter den `success`.

```typescript
{
  authoringSchemaVersion: 1,
  intro: {
    title: "Fortell oss om opplevelsen din",
    body: "Vi bruker svarene til å gjøre tjenesten bedre.",
    startLabel: "Start",
  },
  pages: [/* ... */],
  success: {
    title: "Svaret er sendt inn",
    body: "Takk for at du hjelper oss.",
  },
}
```

Appen kan overstyre enkeltfelt fra dokumentet med props på `LumiSurveyDock` når den trenger rik tekst i React, en annen knappetekst eller automatisk lukking. Se [props-referansen](/referanse/props-referanse).

## Vis alle spørsmål samtidig

Bruk `behavior.questionLayout: "singlePage"` bare når alle sidene skal vises på en gang. Sidetitler og beskrivelser beholdes som struktur, men brukeren navigerer ikke mellom steg.

```tsx
<LumiSurveyDock
  {...otherProps}
  survey={survey}
  behavior={{ questionLayout: "singlePage" }}
/>
```

I nye surveyer skal dere ikke bruke `questionLayout: "steps"` for å vise ett spørsmål om gangen. Lag én side per spørsmål, og behold standardverdien `auto`.
