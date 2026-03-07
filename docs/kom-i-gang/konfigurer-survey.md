---
title: Konfigurer survey
---

# Konfigurer survey

Denne siden viser deg hvordan du velger riktig surveytype for din app.

## Alternativ A: Bruk en preset

Den raskeste veien er å bruke en ferdiglagd preset. Importer den du trenger og send den rett til `survey`-propen:

```tsx
import { LumiSurveyDock, DEFAULT_SURVEY_RATING } from "@navikt/lumi-survey";

<LumiSurveyDock
  surveyId="min-flate"
  survey={DEFAULT_SURVEY_RATING}
  transport={transport}
/>;
```

Lumi har 6 ferdiglagde presets og 4 builder-funksjoner for ulike bruksscenarioer — fra enkel emoji-rating til Top Tasks-analyse.

Se [Presets & surveytyper](/guider/presets) for komplett oversikt med eksempler og veiledning.

## Alternativ B: Definer egne spørsmål

Du kan også bygge en helt egen survey ved å definere spørsmålene selv:

```tsx
import { LumiSurveyDock } from "@navikt/lumi-survey";
import type { LumiSurveyConfig } from "@navikt/lumi-survey";

const survey: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var opplevelsen din?",
      required: true,
    },
    {
      id: "feedback",
      type: "text",
      prompt: "Har du andre tilbakemeldinger?",
      maxLength: 1000,
      visibleIf: { field: "ANSWER", questionId: "rating", operator: "EXISTS" },
    },
  ],
};
```

I dette eksempelet ser brukeren først en emoji-rating, og etter at de velger en emoji vises et fritekstfelt. `visibleIf` styrer denne progressive visningen.

Se [Spørsmålstyper](/guider/sporsmalstyper) for alle tilgjengelige typer og [Betinget synlighet](/guider/betinget-synlighet) for flere eksempler på `visibleIf`.

## Neste steg

Nå har du en survey som vises i appen din! Gå videre til [Koble til backend](/kom-i-gang/koble-til-backend) for å sette opp token exchange og NAIS-tilgang slik at svarene faktisk lagres.
