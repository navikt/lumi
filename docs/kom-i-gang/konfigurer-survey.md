---
title: Konfigurer survey
---

# Konfigurer survey

Denne siden viser deg hvordan du velger riktig surveytype — enten ved å bruke en ferdiglagd preset eller ved å definere egne spørsmål.

## Alternativ A: Bruk en preset

Den raskeste veien er å bruke en av de ferdiglagde presetene. Importer den du trenger og send den rett til `survey`-propen:

```tsx
import { LumiSurveyDock, DEFAULT_SURVEY_RATING } from "@navikt/lumi-survey";

<LumiSurveyDock
  surveyId="min-flate"
  survey={DEFAULT_SURVEY_RATING}
  transport={transport}
/>;
```

### Tilgjengelige presets

| Preset | Beskrivelse |
| :--- | :--- |
| `DEFAULT_SURVEY_RATING` | Emoji-rating + valgfri fritekst |
| `DEFAULT_SURVEY_DISCOVERY` | "Hva kom du hit for å gjøre?" + oppfølging |
| `DEFAULT_SURVEY_SERVICE_FEEDBACK` | Tjenestevurdering med detaljer |

### Builder-funksjoner

For mer tilpasning kan du bruke builder-funksjonene, som tar inn egne oppgaver eller valg:

| Builder | Beskrivelse |
| :--- | :--- |
| `createTopTasksSurvey(options)` | Top Tasks med egne oppgaver (McGovern-metoden) |
| `createTaskPrioritySurvey(options)` | Oppgaveprioritering / Long Neck-rangering |
| `createRatingSurvey(options)` | Tilpasset rating med egne spørsmål og oppfølging |
| `createDiscoverySurvey(options)` | Tilpasset oppdagelsessurvey |

Eksempel med `createTopTasksSurvey`:

```tsx
import { LumiSurveyDock, createTopTasksSurvey } from "@navikt/lumi-survey";

const topTasks = createTopTasksSurvey({
  tasks: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
    { value: "upload", label: "Laste opp dokumentasjon" },
  ],
});

<LumiSurveyDock
  surveyId="top-tasks"
  survey={topTasks}
  transport={transport}
/>;
```

::: tip Hvilken preset bør du velge?
- **Start med `DEFAULT_SURVEY_RATING`** hvis du vil ha en rask puls-måling
- **Bruk `DEFAULT_SURVEY_DISCOVERY`** hvis du vil forstå hva brukeren kom for å gjøre
- **Bruk `createTopTasksSurvey`** når du har en hypoteseliste over kjerneoppgaver

Se [Presets](/bruk/presets) for komplett dokumentasjon av alle presets og builder-funksjoner.
:::

## Alternativ B: Definer egne spørsmål

Du kan også bygge en helt egen survey ved å definere spørsmålene selv. En survey er et objekt med en `type` og en liste med `questions`:

```tsx
import { LumiSurveyDock } from "@navikt/lumi-survey";
import type { LumiSurveyTransport, LumiSurveyConfig } from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  submit: async (submission) => {
    await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};

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

export function App() {
  return (
    <LumiSurveyDock
      surveyId="min-flate"
      survey={survey}
      transport={transport}
    />
  );
}
```

I dette eksempelet:

1. Brukeren ser først en emoji-rating ("Hvordan var opplevelsen din?")
2. Etter at de velger en emoji, vises et fritekstfelt ("Har du andre tilbakemeldinger?")
3. `visibleIf` styrer denne progressive visningen — tekstfeltet dukker opp bare når rating er besvart

### Spørsmålstyper

| Type | Beskrivelse |
| :--- | :--- |
| `rating` | Rating-skala (emoji, thumbs, stars eller nps) |
| `text` | Fritekstfelt med valgfri makslengde |
| `singleChoice` | Velg ett alternativ |
| `multiChoice` | Velg flere alternativer |

Se [Spørsmålstyper](/bruk/sporsmalstyper) for komplett dokumentasjon med alle varianter og innstillinger.

### Betinget synlighet med `visibleIf`

`visibleIf` lar deg vise oppfølgingsspørsmål basert på tidligere svar:

```tsx
{
  id: "comment",
  type: "text",
  prompt: "Hva gikk galt?",
  visibleIf: {
    field: "ANSWER",
    questionId: "rating",
    operator: "LT",
    value: 3,
  },
}
```

Tilgjengelige operatorer: `EXISTS`, `EQ`, `NEQ`, `GT`, `LT`, `CONTAINS`.

Se [Betinget synlighet](/bruk/betinget-synlighet) for flere eksempler.

## Neste steg

Nå har du en survey som vises i appen din! Gå videre til [Koble til backend](/kom-i-gang/koble-til-backend) for å sette opp token exchange og NAIS-tilgang slik at svarene faktisk lagres.
