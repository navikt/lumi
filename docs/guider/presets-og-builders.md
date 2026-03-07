---
title: Presets og builders
---

# Presets og builders

Ferdiglagde snarveier for vanlige survey-mønster. For full kontroll, definer surveyen selv — se [Konfigurer survey](/kom-i-gang/konfigurer-survey).

Usikker på hvilken type som passer? Se [Surveytyper](/guider/surveytyper) for veiledning.

## Ferdiglagde presets

Disse kan brukes direkte uten konfigurasjon:

| Preset | Type | Beskrivelse |
| :--- | :--- | :--- |
| `DEFAULT_SURVEY_RATING` | `rating` | Emoji-rating (1–5) + valgfri fritekst |
| `DEFAULT_SURVEY_SERVICE_FEEDBACK` | `rating` | Tjenestevurdering med emoji + begrunnelse |
| `DEFAULT_SURVEY_THUMBS` | `rating` | Tommel opp/ned + valgfri forbedring |
| `DEFAULT_SURVEY_STARS` | `rating` | 5-stjerners vurdering + valgfri begrunnelse |
| `DEFAULT_SURVEY_NPS` | `rating` | NPS 0–10 + valgfri begrunnelse |
| `DEFAULT_SURVEY_DISCOVERY` | `discovery` | «Hva kom du for å gjøre?» + suksess + blocker |

### Eksempel: Bruk en preset direkte

```tsx
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

## Builder-funksjoner

Builders gir deg mer kontroll, men med fornuftige defaults:

| Builder | Beskrivelse |
| :--- | :--- |
| `createRatingSurvey({...})` | Tilpasset rating med egne spørsmål og oppfølging |
| `createDiscoverySurvey({...})` | Tilpasset discovery med egne prompts |
| `createTopTasksSurvey({tasks})` | Top Tasks (McGovern-metoden) |
| `createTaskPrioritySurvey({tasks})` | Task Priority / Long Neck-rangering |

### `createRatingSurvey`

Lager en rating-survey med valgfri oppfølging. Oppfølgingsspørsmål får automatisk `visibleIf` slik at de skjules inntil rating er valgt.

```tsx
import { createRatingSurvey } from "@navikt/lumi-survey";

const survey = createRatingSurvey({
  ratingPrompt: "Hvor fornøyd er du med søknadsprosessen?",
  ratingDescription: "Svarene er anonyme",
  followUpQuestions: [
    {
      id: "improvement",
      type: "text",
      prompt: "Hva kunne vært bedre?",
      maxLength: 500,
    },
  ],
});
```

### `createDiscoverySurvey`

Lager en discovery-survey for å finne ut hva brukere kommer for å gjøre. Alle parametere er valgfrie — uten argumenter får du samme survey som `DEFAULT_SURVEY_DISCOVERY`.

```tsx
import { createDiscoverySurvey } from "@navikt/lumi-survey";

const survey = createDiscoverySurvey({
  taskPrompt: "Hva skulle du gjøre her i dag?",
  taskPlaceholder: "F.eks. sjekke status på søknaden min...",
  successPrompt: "Fikk du til det du ville?",
  blockerPrompt: "Hva stoppet deg?",
  includeBlockerQuestion: true,
});
```

### `createTopTasksSurvey`

Top Tasks (McGovern-metoden) — brukeren velger hvilken oppgave de prøvde å gjøre, og om de klarte det. Støtter branching: svarer brukeren «Ja» på suksess-spørsmålet, hoppes blocker-spørsmålet over.

```tsx
import { createTopTasksSurvey } from "@navikt/lumi-survey";

const survey = createTopTasksSurvey({
  tasks: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status på søknad" },
    { value: "upload", label: "Laste opp dokumentasjon" },
  ],
  includeOtherTask: true,
  includeBlockerQuestion: true,
});
```

::: info Krever step-modus
Top Tasks har innebygd branching-logikk. Widgeten bytter automatisk til step-modus (`questionLayout: "steps"`) når `logic` finnes.
:::

### `createTaskPrioritySurvey`

Task Priority / Long Neck — brukeren velger de N viktigste oppgavene fra en liste. Anbefalt med 20–50 oppgaver.

```tsx
import { createTaskPrioritySurvey } from "@navikt/lumi-survey";

const survey = createTaskPrioritySurvey({
  tasks: [
    { value: "apply-sick", label: "Søke om sykepenger" },
    { value: "check-status", label: "Sjekke status på søknad" },
    { value: "upload-docs", label: "Laste opp dokumenter" },
    { value: "find-info", label: "Finne informasjon" },
    // ... 20-50 oppgaver
  ],
  maxSelections: 5,
  randomize: true,
  variant: "combobox",
});
```
