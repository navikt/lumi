---
title: Konfigurer survey
---

# Konfigurer survey

Definer surveyen din som et TypeScript-objekt og send det til `LumiSurveyDock`. Du har full kontroll over spørsmål, rekkefølge og betinget synlighet.

## Definer surveyen

En survey er et objekt som tilfredsstiller `LumiSurveyConfig`. Her er et typisk oppsett med emoji-rating etterfulgt av et valgfritt fritekstfelt:

```typescript
import type { LumiSurveyConfig } from "@navikt/lumi-survey";

export const mySurvey = {
  type: "rating",
  questions: [
    {
      id: "inntrykk",
      type: "rating",
      variant: "emoji",
      prompt: "Hva er ditt inntrykk av tjenesten?",
      required: true,
    },
    {
      id: "innspill",
      type: "text",
      prompt: "Har du noen kommentarer eller innspill?",
      maxLength: 1000,
      visibleIf: {
        field: "ANSWER",
        questionId: "inntrykk",
        operator: "EXISTS",
      },
    },
  ],
} satisfies LumiSurveyConfig;
```

Tre ting å merke seg:

- **`type`** scoper surveyen — se [Surveytyper](/guider/surveytyper) for alle alternativer.
- **`questions`** er den ordnede listen med spørsmål — se [Spørsmålstyper](/guider/sporsmalstyper) for tilgjengelige typer.
- **`visibleIf`** gjør at fritekstfeltet først vises etter at brukeren har gitt en rating — se [Betinget synlighet](/guider/betinget-synlighet).

::: tip `satisfies` fremfor typeannotasjon
`satisfies LumiSurveyConfig` gir deg typevalidering **og** bevarer den smale literal-typen, slik at `mySurvey.type` er `"rating"` — ikke `string`. Dette er idiomatisk TypeScript og gir bedre inferens nedover i appen.
:::

## Tips for gode surveys

- **Hold det kort** — 1–2 spørsmål gir høyest svarprosent.
- **Vær konkret** — still spørsmål om en spesifikk opplevelse, ikke generell tilfredshet.
- **Bruk progresjon** — vis oppfølgingsspørsmål med `visibleIf` i stedet for å vise alt på én gang.
- **Segmentér med tags** — bruk `context.tags` for å skille mellom brukergrupper eller flater. Se [Context og tags](/guider/context-og-tags).
- **Velg en stabil `surveyId`** — denne identifiserer én analyseserie på tvers av utrullinger. Strukturelle eller semantiske endringer krever en ny ID, for eksempel `min-flate-feedback-v2`. Se [Survey-identitet og endringer](/guider/survey-identitet) for beslutningstabellen.

## Snarvei: Bruk en preset

Trenger du raskt en standard survey uten å definere spørsmålene selv? Bruk en ferdiglagd preset:

```tsx
import { LumiSurveyDock, DEFAULT_SURVEY_RATING } from "@navikt/lumi-survey";

<LumiSurveyDock
  surveyId="min-flate"
  survey={DEFAULT_SURVEY_RATING}
  transport={transport}
/>
```

Se [Presets og builders](/guider/presets-og-builders) for alle tilgjengelige presets og builders.

## Neste steg

Surveyen din er klar! Gå videre til [Koble til backend](/kom-i-gang/koble-til-backend) for å sette opp token exchange og NAIS-tilgang slik at svarene lagres.
