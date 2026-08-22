---
title: Datakontrakt
---

# Datakontrakt

Datakontrakten definerer strukturen på payloaden som sendes fra Lumi Survey-widgeten til Lumi API.

## Transport payload

Widgeten samler inn svar og sender en strukturert JSON-payload til backend. Payloaden har disse hoveddelene:

| Felt | Påkrevd | Beskrivelse |
| :--- | :--- | :--- |
| `schemaVersion` | ✅ | Nåværende widget sender alltid `2`. Backend godtar også `1` i en overgangsperiode mens eldre widget-versjoner fases ut |
| `submittedAt` | ✅ | ISO 8601 tidsstempel for innsending |
| `surveyId` | ✅ | Unik survey-identifikator |
| `surveyType` | ✅ | En av: `"rating"`, `"topTasks"`, `"discovery"`, `"taskPriority"`, `"custom"` |
| `deduplicationKey` | ✅ | Genereres av widgeten og gjør nytt forsøk etter transportfeil trygt |
| `definition` | ✅ | Alle spørsmålene i surveyen, også de som ikke er besvart |
| `answers` | ✅ | Strukturert array med svar på spørsmål som er synlige ved innsending (se under) |
| `context` | Anbefalt | Nettleser-/brukerkontekst for segmentering |

::: tip Når skal du endre `surveyId`?
Behold samme ID når surveyen fortsatt måler det samme med samme struktur. Bruk
en ny ID ved strukturelle eller semantiske endringer. Se
[Survey-identitet og endringer](/guider/survey-identitet) for en konkret
beslutningstabell og forklaring av 409-feil.
:::

::: info Deduplication
Du trenger ikke sette `deduplicationKey` selv når du bruker widgeten. Den samme nøkkelen brukes når en innsending feiler og brukeren prøver på nytt. Etter vellykket innsending, reset eller ny sidevisning får neste innsending en ny nøkkel.
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

Widgeten samler automatisk nettleserkontekst og slår sammen med bruker-definert segmenteringsdata:

```typescript
interface LumiContext {
  // Auto-samlet av widgeten
  deviceType?: DeviceType;   // "mobile" | "tablet" | "desktop"
  viewport?: { width: number; height: number };
  screenResolution?: { width: number; height: number };
  userAgent?: string;

  // Kun eksplisitt context (samles aldri inn automatisk)
  url?: string;              // Gjeldende side-URL

  // Eksplisitt context, eller automatisk med collectLocation: true
  pathname?: string;         // URL pathname

  // Segmentering (LAV KARDINALITET → dashboard-grafer)
  tags?: Record<string, string | number | boolean>;

  // Debugging (HØY KARDINALITET → kun i detaljvisning)
  debug?: Record<string, unknown>;
}
```

### Tags vs. debug

| Felt | Kardinalitet | Bruksområde | Eksempel |
| :--- | :--- | :--- | :--- |
| `tags` | Lav (< 10 verdier) | Grafer, segmentering | `{ abTest: "A", rolle: "arbeidsgiver" }` |
| `debug` | Høy (OK) | Inspeksjon av enkeltinnslag | `{ sessionId: "abc-123", behandlingId: "..." }` |

::: warning Ikke legg høy-kardinalitet i tags
Tags med mange unike verdier (f.eks. bruker-IDer) gir ubrukelige grafer i dashboardet. Bruk `debug`-feltet for slike verdier.
:::

## Survey-typer

Backend mapper `surveyType`-strenger til enums:

| Widget-verdi | Backend-enum |
| :--- | :--- |
| `"rating"` | `SurveyType.RATING` |
| `"topTasks"` | `SurveyType.TOP_TASKS` |
| `"discovery"` | `SurveyType.DISCOVERY` |
| `"taskPriority"` | `SurveyType.TASK_PRIORITY` |
| Alt annet | `SurveyType.CUSTOM` |

### Faste felt i spesialiserte analyser

Bruk de ferdige oppsettene i Surveyverkstedet eller funksjonene som er beskrevet under [Velg hva dere vil måle](/guider/surveytyper). API-et avviser en spesialisert survey som mangler feltene analysen trenger.

| Type | Felt | Spørsmålstype | Svar som har fast betydning |
| :--- | :--- | :--- | :--- |
| `discovery` | `task` | Fritekst | — |
| `discovery` | `success` | Enkeltvalg | `yes`, `partial`, `no` |
| `topTasks` | `task` | Enkeltvalg | ID-ene til oppgavene dere oppgir |
| `topTasks` | `success` | Enkeltvalg | `yes`, `partial`, `no` |
| `taskPriority` | `priority` | Flervalg | ID-ene til oppgavene dere oppgir |

`blocker` er et valgfritt fritekstfelt i discovery og top tasks. Dere kan legge til egne spørsmål utenom feltene i tabellen.
`success` skal ha nøyaktig de tre svarverdiene i tabellen; ekstra utfall kan ikke klassifiseres av analysen og blir avvist.

## Komplett eksempel

I eksempelet er `context.url` satt eksplisitt av konsumentappen; widgeten samler aldri inn full URL automatisk. `pathname` kan settes eksplisitt eller samles inn med `collectLocation: true`.

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

- [Survey-identitet og endringer](/guider/survey-identitet) — når du kan beholde samme `surveyId`
- [API-endepunkter](/referanse/api-endepunkter) — endepunktene som mottar denne payloaden
- [Context & tags](/guider/context-og-tags) — hvordan du konfigurerer context i widgeten
