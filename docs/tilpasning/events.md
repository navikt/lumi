---
title: Events
---

# Events

Event-callbacks lar deg reagere på brukerinteraksjoner og livssyklushendelser i surveyen. Bruk dem til logging, analytics eller tilpasset oppførsel.

## Alle events

Send et `events`-objekt til `LumiSurveyDock`:

```tsx
<LumiSurveyDock
  surveyId="min-flate"
  survey={survey}
  transport={transport}
  events={{
    onViewDock: (surveyId) => { /* ... */ },
    onAnswer: (questionId, value) => { /* ... */ },
    onSubmitStart: (submission) => { /* ... */ },
    onSubmitSuccess: (submission) => { /* ... */ },
    onSubmitError: (cause) => { /* ... */ },
    onValidationFailed: (missingQuestionIds) => { /* ... */ },
    onReset: () => { /* ... */ },
    onDismissalPersistFailed: (cause) => { /* ... */ },
    onStepChange: (currentStep, totalSteps) => { /* ... */ },
  }}
/>
```

## Event-referanse

### `onViewDock`

Fyres når docken vises for brukeren (åpnes eller rendres åpen).

```ts
onViewDock?: (surveyId: string) => void;
```

### `onAnswer`

Fyres hver gang brukeren svarer på eller endrer svar på et spørsmål.

```ts
onAnswer?: (questionId: string, value: unknown) => void;
```

### `onSubmitStart`

Fyres når brukeren trykker «Send inn» og innsending starter.

```ts
onSubmitStart?: (submission: LumiSurveySubmission) => void;
```

### `onSubmitSuccess`

Fyres etter at `transport.submit` returnerer uten feil.

```ts
onSubmitSuccess?: (submission: LumiSurveySubmission) => void;
```

### `onSubmitError`

Fyres hvis `transport.submit` kaster en feil.

```ts
onSubmitError?: (cause: unknown) => void;
```

### `onValidationFailed`

Fyres når brukeren prøver å sende inn uten å ha fylt ut alle påkrevde felt.

```ts
onValidationFailed?: (missingQuestionIds: string[]) => void;
```

### `onReset`

Fyres når skjemaet nullstilles (f.eks. når brukeren lukker og `resetOnClose` er `true`).

```ts
onReset?: () => void;
```

### `onDismissalPersistFailed`

Fyres når widgeten ikke klarer å lagre dismissed-tilstand — typisk fordi consent er nektet eller localStorage er utilgjengelig.

```ts
onDismissalPersistFailed?: (cause: unknown) => void;
```

### `onStepChange`

Fyres når brukeren navigerer mellom steg i step-modus.

```ts
onStepChange?: (currentStep: number, totalSteps: number) => void;
```

## Brukseksempler

### Amplitude-logging

```tsx
import * as amplitude from "@amplitude/analytics-browser";

<LumiSurveyDock
  surveyId="soknad-kvittering"
  survey={survey}
  transport={transport}
  events={{
    onViewDock: (surveyId) => {
      amplitude.track("survey_viewed", { surveyId });
    },
    onSubmitSuccess: (submission) => {
      amplitude.track("survey_submitted", {
        surveyId: submission.surveyId,
      });
    },
    onSubmitError: (cause) => {
      amplitude.track("survey_submit_error", {
        error: String(cause),
      });
    },
  }}
/>
```

### Feilsøking av lagring

```tsx
<LumiSurveyDock
  surveyId="min-flate"
  survey={survey}
  transport={transport}
  events={{
    onDismissalPersistFailed: (cause) => {
      console.warn("Kunne ikke lagre dismissed-tilstand:", cause);
      // Vurder å bytte til storageStrategy: "localStorage"
    },
  }}
/>
```

### Fremdriftssporing

```tsx
<LumiSurveyDock
  surveyId="lang-survey"
  survey={survey}
  transport={transport}
  behavior={{ questionLayout: "steps", showProgress: true }}
  events={{
    onStepChange: (current, total) => {
      console.log(`Steg ${current} av ${total}`);
    },
    onValidationFailed: (missing) => {
      console.warn("Mangler svar på:", missing);
    },
  }}
/>
```

## TypeScript-interface

```ts
interface LumiSurveyEvents {
  onViewDock?: (surveyId: string) => void;
  onAnswer?: (questionId: string, value: unknown) => void;
  onSubmitStart?: (submission: LumiSurveySubmission) => void;
  onSubmitSuccess?: (submission: LumiSurveySubmission) => void;
  onSubmitError?: (cause: unknown) => void;
  onValidationFailed?: (missingQuestionIds: string[]) => void;
  onReset?: () => void;
  onDismissalPersistFailed?: (cause: unknown) => void;
  onStepChange?: (currentStep: number, totalSteps: number) => void;
}
```
