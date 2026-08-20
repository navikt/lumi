---
title: Sider og flyt
---

# Sider og flyt

Du bygger surveyen med sider. Når Lumi viser én side om gangen, blir hver synlig side et steg. Rekkefølgen i `pages` blir rekkefølgen brukeren går gjennom.

## Den anbefalte modellen

- **Velkomstside (`intro`)** gir kort kontekst før surveyen begynner.
- **Side (`pages[]`)** er det som vises og valideres sammen.
- **Spørsmål (`questions[]`)** er det brukeren svarer på.
- **Steg** er en synlig side i den aktuelle flyten.
- **Bekreftelsen etter innsending** forteller at svaret er levert. Bruk `success` når du vil tilpasse teksten.

Velkomstsiden og bekreftelsen etter innsending er ikke med i fremdriften.

## Ett spørsmål om gangen

Legg hvert spørsmål på sin egen side. Når dokumentet har flere sider, viser `questionLayout: "auto"` dem som steg. `auto` er standard, så du trenger ikke sette det selv.

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

Ikke legg inn en sidetittel som bare gjentar spørsmålet. Spørsmålsteksten er allerede overskriften brukeren trenger.

## Flere spørsmål på samme side

Samle spørsmål når de må forstås eller besvares som en helhet. Da kan en kort sidetittel og beskrivelse gi felles kontekst.

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

Alle synlige, obligatoriske spørsmål på siden valideres før brukeren kan gå videre.

## Hopp over sider som ikke er relevante

Sett `visibleIf` på spørsmålene som skal være betinget. En side hoppes over når ingen av spørsmålene på siden er synlige.

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

Flyten er alltid lineær: Widgeten går gjennom de synlige sidene i dokumentrekkefølge. `visibleIf` i dokumentformatet kan bare vise til tidligere spørsmål. Det gjør flyten forutsigbar i både kode, Surveyverksted og forhåndsvisning.

## Start og avslutt tydelig

Bruk `intro` når brukeren trenger å vite hvorfor dere spør, omtrent hvor lang tid det tar eller hva svaret brukes til. Oppgi tidsbruk bare når dere har testet den.

Bruk `success` når standardbekreftelsen ikke er presis nok. Skriv hva som har skjedd og eventuelt hva som skjer videre.

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

Innholdet i dokumentet er standarden. Props på `LumiSurveyDock` kan overstyre enkeltfelt når appen trenger rik React-tekst, en annen knappetekst eller automatisk lukking. Se [props-referansen](/referanse/props-referanse).

## Vis alle spørsmål på én flate

Bruk `behavior.questionLayout: "singlePage"` bare når alle sidene skal vises samtidig. Sidetitler og beskrivelser beholdes som struktur, men brukeren navigerer ikke mellom steg.

```tsx
<LumiSurveyDock
  {...otherProps}
  survey={survey}
  behavior={{ questionLayout: "singlePage" }}
/>
```

For nye surveyer skal du ikke bruke `questionLayout: "steps"` for å få ett spørsmål om gangen. Lag én side per spørsmål og behold standardverdien `auto`.

## Kort sjekkliste

- Én side per spørsmål når du vil vise ett spørsmål om gangen.
- Flere spørsmål på samme side bare når de hører tydelig sammen.
- Ingen sidetittel når spørsmålsteksten gir nok kontekst.
- `visibleIf` for oppfølginger og sider som skal hoppes over.
- `auto` som standard. Bruk `singlePage` bare som et bevisst unntak.
