---
title: Datakontrakt
---

# Datakontrakt

Datakontrakten definerer strukturen på payloaden som sendes fra Lumi Survey-widgeten til Lumi API.

## Transport payload

Widgeten samler inn svar og sender en strukturert JSON-payload til backend. Payloaden har disse hoveddelene:

| Felt | Påkrevd | Beskrivelse |
| :--- | :--- | :--- |
| `schemaVersion` | ✅ | Alltid `2` (gjeldende versjon) |
| `submittedAt` | ✅ | ISO 8601 tidsstempel for innsending |
| `surveyId` | ✅ | Unik survey-identifikator |
| `surveyType` | ✅ | En av: `"rating"`, `"topTasks"`, `"discovery"`, `"taskPriority"`, `"custom"` |
| `deduplicationKey` | ✅ | Stabil nøkkel som gjør retry trygt |
| `definition` | ✅ | Alle spørsmålene i surveyen, også de som ikke er besvart |
| `answers` | ✅ | Strukturert array med svar (se under) |
| `context` | Anbefalt | Nettleser-/brukerkontekst for segmentering |

::: tip Når skal du endre `surveyId`?
Behold samme `surveyId` når du legger til spørsmål. Bruk ny `surveyId` når du fjerner, endrer navn på eller endrer type/options for spørsmål. Da unngår du å blande ulike datastrukturer i samme analyse.
:::

## Answers-arrayet

Hvert element i `answers` følger dette skjemaet:

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
{ type: "rating", rating: 5 }

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
  userAgent?: string;

  // Opt-in (krever collectLocation: true)
  url?: string;              // Gjeldende side-URL
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

## Komplett eksempel

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
      "value": { "type": "rating", "rating": 4 }
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

- [API-endepunkter](/referanse/api-endepunkter) — endepunktene som mottar denne payloaden
- [Context & tags](/guider/context-og-tags) — hvordan du konfigurerer context i widgeten
