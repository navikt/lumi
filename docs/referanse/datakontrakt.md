---
title: Datakontrakt
---

# Datakontrakt

Payloaden er `submission.transportPayload` fra widgeten. Appen sender den som JSON til egen backend, og backenden sender den videre til Lumi API.

## Felt i `transportPayload`

Payloaden har disse hoveddelene:

| Felt | Påkrevd | Beskrivelse |
| :--- | :--- | :--- |
| `schemaVersion` | Ja | Dagens widget sender alltid `2`. Lumi API godtar også `1` i en overgangsperiode mens eldre widgetversjoner fases ut |
| `submittedAt` | Ja | Tidspunkt for innsending i ISO 8601 |
| `surveyId` | Ja | Unik ID for surveyen |
| `surveyType` | Ja | En av: `"rating"`, `"topTasks"`, `"discovery"`, `"taskPriority"`, `"custom"` |
| `deduplicationKey` | Ja | Genereres av widgeten. Samme nøkkel brukes ved nytt forsøk etter transportfeil, så svaret ikke lagres to ganger |
| `definition` | Ja | Alle spørsmålene i surveyen, også de som ikke er besvart |
| `answers` | Ja | Svar på spørsmålene som er synlige ved innsending, se [Answers-arrayet](#answers-arrayet) |
| `context` | Anbefalt | Kontekst fra nettleseren og appen, brukes til segmentering |

::: tip Når skal dere endre `surveyId`?
Behold samme ID når surveyen fortsatt måler det samme med samme struktur. Bruk
en ny ID når strukturen eller betydningen endres. Se
[Survey-identitet og endringer](/guider/survey-identitet) for en
beslutningstabell og forklaring på 409-feil.
:::

::: info Deduplisering
Dere trenger ikke sette `deduplicationKey` selv når dere bruker widgeten. Den samme nøkkelen brukes når en innsending feiler og brukeren prøver på nytt. Etter vellykket innsending, nullstilling eller ny sidevisning får neste innsending en ny nøkkel.
:::

## Answers-arrayet

Hvert element i `answers` følger dette skjemaet. Dersom et besvart spørsmål blir
skjult av `visibleIf` før innsending, utelates svaret. `definition` inneholder
fortsatt alle spørsmålene, slik at surveydefinisjonen er stabil.

```typescript
interface TransportAnswer {
  fieldId: string;       // Unik spørsmåls-ID (f.eks. "task", "feedback")
  fieldType: string;     // En av: "RATING", "TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"
  value: AnswerValue;    // Selve svaret
  question: {
    label: string;       // Spørsmålsteksten vist til bruker
    description?: string;
    options?: Array<{ id: string; label: string }>;  // Påkrevd for valg-typer (for label-oppslag)
  };
}
```

### Svartyper

`AnswerValue` er en union med fire varianter:

```typescript
// Fritekst
{ type: "text", text: "Veldig bra!" }

// Rating (tallverdi)
{ type: "rating", rating: 5, ratingVariant: "emoji", ratingScale: 5 }

// Enkeltvalg
{ type: "singleChoice", selectedOptionId: "opt_1" }

// Flervalg
{ type: "multiChoice", selectedOptionIds: ["opt_1", "opt_2"] }
```

## Context-objektet {#context}

Widgeten samler inn kontekst fra nettleseren automatisk og slår den sammen med segmenteringsdataene dere setter selv:

```typescript
interface LumiContext {
  // Samles inn automatisk av widgeten
  deviceType?: DeviceType;   // "mobile" | "tablet" | "desktop"
  viewport?: { width: number; height: number };
  screenResolution?: { width: number; height: number };
  userAgent?: string;

  // Bare når dere setter den i context (samles aldri inn automatisk)
  url?: string;              // Gjeldende side-URL

  // Settes i context, eller samles inn automatisk med collectLocation: true
  pathname?: string;         // URL pathname

  // Segmentering (lav kardinalitet, brukes i grafer i dashboardet)
  tags?: Record<string, string | number | boolean>;

  // Valgfri debug-data (lagres, men vises ikke i dashboardet eller eksporten)
  debug?: Record<string, unknown>;
}
```

`userAgent` og `debug` tas imot og lagres, men vises ikke i dashboardet eller eksporten.

### `tags` og `debug`

| Felt | Kardinalitet | Bruksområde | Eksempel |
| :--- | :--- | :--- | :--- |
| `tags` | Lav (< 10 verdier) | Grafer, segmentering | `{ abTest: "A", rolle: "arbeidsgiver" }` |
| `debug` | Kan være høy | Lagres, men vises ikke i dashboardet eller eksporten | `{ buildVersion: "2.4.1", featureVariant: "ny-kvittering" }` |

::: warning Hold identifikatorer ute av context
Tags med mange unike verdier gir ubrukelige grafer i dashboardet. Ikke flytt bruker-, person- eller saksidentifikatorer til `debug`. Feltet lagres, selv om det ikke vises i dashboardet eller eksporten.
:::

Se [hvor og når PII-maskering skjer](/referanse/sikkerhet#pii-feltdekning) for nøyaktig feltdekning og begrensninger.

## Survey-typer

Lumi API gjør om `surveyType` til disse enum-verdiene:

| Widget-verdi | Backend-enum |
| :--- | :--- |
| `"rating"` | `SurveyType.RATING` |
| `"topTasks"` | `SurveyType.TOP_TASKS` |
| `"discovery"` | `SurveyType.DISCOVERY` |
| `"taskPriority"` | `SurveyType.TASK_PRIORITY` |
| Alt annet | `SurveyType.CUSTOM` |

### Faste felt i spesialiserte analyser

Bruk de ferdige oppsettene i Surveyverksted eller funksjonene som er beskrevet under [Velg hva dere vil måle](/guider/surveytyper). API-et avviser en spesialisert survey som mangler feltene analysen trenger.

| Type | Felt | Spørsmålstype | Svar som har fast betydning |
| :--- | :--- | :--- | :--- |
| `discovery` | `task` | Fritekst | – |
| `discovery` | `success` | Enkeltvalg | `yes`, `partial`, `no` |
| `topTasks` | `task` | Enkeltvalg | ID-ene til oppgavene dere oppgir |
| `topTasks` | `success` | Enkeltvalg | `yes`, `partial`, `no` |
| `taskPriority` | `priority` | Flervalg | ID-ene til oppgavene dere oppgir |

`blocker` er et valgfritt fritekstfelt i discovery og top tasks. Dere kan legge til egne spørsmål utenom feltene i tabellen.
`success` skal ha nøyaktig de tre svarverdiene i tabellen. Analysen kan ikke klassifisere andre svarverdier, og de blir avvist.

## Komplett eksempel

I eksempelet har appen satt `context.url` selv. Widgeten samler aldri inn hele URL-en automatisk. `pathname` kan appen sette selv, eller widgeten kan samle den inn med `collectLocation: true`.

```json
{
  "schemaVersion": 2,
  "submittedAt": "2024-12-03T14:22:00.000Z",
  "surveyId": "sykepenger-rating",
  "surveyType": "rating",
  "deduplicationKey": "retryable-submit:sykepenger-rating:abc123",
  "definition": {
    "surveyType": "rating",
    "fields": [
      {
        "fieldId": "rating",
        "fieldType": "RATING",
        "ratingVariant": "emoji",
        "ratingScale": 5
      },
      {
        "fieldId": "feedback",
        "fieldType": "TEXT"
      }
    ]
  },
  "context": {
    "url": "https://nav.no/sykepenger",
    "pathname": "/sykepenger",
    "deviceType": "mobile",
    "viewport": { "width": 390, "height": 844 },
    "screenResolution": { "width": 390, "height": 844 },
    "tags": {
      "abTest": "A",
      "rolle": "bruker"
    }
  },
  "answers": [
    {
      "fieldId": "rating",
      "fieldType": "RATING",
      "question": { "label": "Hvordan var opplevelsen din?" },
      "value": {
        "type": "rating",
        "rating": 4,
        "ratingVariant": "emoji",
        "ratingScale": 5
      }
    },
    {
      "fieldId": "feedback",
      "fieldType": "TEXT",
      "question": { "label": "Har du andre tilbakemeldinger?" },
      "value": { "type": "text", "text": "Veldig bra!" }
    }
  ]
}
```

## Se også

- [Survey-identitet og endringer](/guider/survey-identitet): når dere kan beholde samme `surveyId`
- [API-endepunkter](/referanse/api-endepunkter): endepunktene som tar imot denne payloaden
- [Context og tags](/guider/context-og-tags): slik setter dere context i widgeten
