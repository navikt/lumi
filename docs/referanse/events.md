---
title: Events
---

# Events

Widgeten kaller funksjonene i `events` blant annet når brukeren ser surveyen, svarer, sender inn eller går til en ny side. Funksjonene kan for eksempel sende hendelser til Amplitude eller logge feil ved lagring.

## Alle events

Send et `events`-objekt til `LumiSurveyDock`:

```tsx
<LumiSurveyDock
  surveyId="min-app-tilbakemelding"
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
    onStepChange: (visibleStepIndex, totalVisibleSteps) => { /* ... */ },
  }}
/>
```

## Event-referanse

### `onViewDock`

Kalles én gang hver gang panelet faktisk åpnes for brukeren, enten det vises åpent fra start eller brukeren åpner det fra den minimerte knappen. Den minimerte knappen alene teller ikke.

Fra versjon 2.3.0 venter widgeten til den har lest lagringen. Brukere på nav.no som ikke har samtykket til `surveys`, og alle brukere i apper uten Nav-dekoratøren som ikke setter `storageStrategy: "localStorage"`, ser bare den minimerte knappen. De teller ikke før de åpner surveyen selv. Regner dere svarandel mot antall visninger, får tallserien et brudd ved 2.3.0.

```ts
onViewDock?: (surveyId: string) => void;
```

### `onAnswer`

Kalles hver gang brukeren svarer på eller endrer svar på et spørsmål.

```ts
onAnswer?: (questionId: string, value: unknown) => void;
```

### `onSubmitStart`

Kalles når brukeren trykker **Send** og innsendingen starter. Prøver widgeten
én gang til etter 429 eller 503, kalles den ikke på nytt.

```ts
onSubmitStart?: (submission: LumiSurveySubmission) => void;
```

### `onSubmitSuccess`

Kalles etter at `transport.submit` returnerer uten feil.

```ts
onSubmitSuccess?: (submission: LumiSurveySubmission) => void;
```

### `onSubmitError`

Kalles én gang når innsendingen har feilet, etter et eventuelt nytt forsøk.
`cause` er feilen fra siste forsøk. Brukte forsøket mer enn ti sekunder, er
`cause` en `DOMException` med navnet `TimeoutError`.

```ts
onSubmitError?: (cause: unknown) => void;
```

### `onValidationFailed`

Kalles når brukeren prøver å sende inn uten å ha fylt ut alle påkrevde felt.

```ts
onValidationFailed?: (missingQuestionIds: string[]) => void;
```

### `onReset`

Kalles når skjemaet nullstilles, for eksempel når brukeren lukker widgeten og `resetOnClose` er `true`.

```ts
onReset?: () => void;
```

### `onDismissalPersistFailed`

Kalles når widgeten ikke klarer å lagre at brukeren har lukket surveyen eller sendt inn svar. Lagringen skjer rett etter en vellykket innsending, så også den kan utløse hendelsen. Funksjonen kalles i tillegg når widgeten ikke klarer å fjerne en lagret lukking, enten fordi brukeren åpner surveyen igjen, eller fordi ventetiden er over når siden lastes. Det skjer typisk når brukeren ikke har gitt samtykke, eller når `localStorage` ikke er tilgjengelig. Å lese lagringen utløser ikke hendelsen. Finnes det ingenting å fjerne, prøver ikke widgeten.

```ts
onDismissalPersistFailed?: (cause: unknown) => void;
```

### `onStepChange`

Kalles når stegvis visning initialiseres, også dersom velkomstsiden fortsatt
vises, og når brukeren går til en annen side. For `SurveyDocumentV1` er hvert
steg en synlig side. `totalVisibleSteps` er et estimat. Før brukeren har svart
på spørsmål som styrer `visibleIf`, kan tallet ta med sider som senere hoppes
over.

```ts
onStepChange?: (visibleStepIndex: number, totalVisibleSteps: number) => void;
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
  surveyId="min-app-tilbakemelding"
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

### Følg framdriften

```tsx
<LumiSurveyDock
  surveyId="lang-survey"
  survey={survey}
  transport={transport}
  behavior={{ showProgress: true }}
  events={{
    onStepChange: (step, total) => {
      console.log(`Steg ${step + 1} av ${total}`);
    },
    onValidationFailed: (missing) => {
      console.warn("Mangler svar på:", missing);
    },
  }}
/>
```

Eldre, flate konfigurasjoner kaller `onStepChange` én gang per spørsmål i
stegvis visning. Etter migrering kan en side med flere spørsmål derfor gi færre
kall.

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
  onStepChange?: (visibleStepIndex: number, totalVisibleSteps: number) => void;
}
```
