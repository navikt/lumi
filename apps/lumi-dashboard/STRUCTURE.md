# Data Structure & Contract

This document outlines the data contract between the **Lumi Survey** (widget) and the **Lumi API**.

## Core Concept

The Widget collects answers and sends a transport payload to the backend. The Analytics backend expects a **structured** payload to correctly parse, aggregate, and display feedback.

## Widget Payload (Transport)

The transport payload is a JSON object with the following structure:

### Critical Fields

| Field | Required | Description |
|-------|----------|-------------|
| `surveyId` | ✅ | Unique survey identifier |
| `surveyType` | ✅ | One of: `"rating"`, `"topTasks"`, `"discovery"`, `"taskPriority"`, `"custom"` |
| `answers` | ✅ | Structured array of answers (see below) |
| `context` | Recommended | Browser/user context for segmentation |

### The `answers` Array

Each item in the `answers` array must follow this schema:

```typescript
interface TransportAnswer {
  fieldId: string;       // Unique question ID (e.g. "task", "feedback")
  fieldType: string;     // One of: "RATING", "TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"
  value: AnswerValue;    // The actual answer
  question: {
    label: string;       // Question text shown to user
    description?: string;
    options?: Option[];  // Required for choice types (for label lookup)
  };
}

// AnswerValue variants:
// { type: "text", text: "..." }
// { type: "rating", rating: 5 }
// { type: "singleChoice", selectedOptionId: "opt_1" }
// { type: "multiChoice", selectedOptionIds: ["opt_1", "opt_2"] }
```

### The `context` Object

The widget auto-collects browser context and merges with user-provided segmentation data:

```typescript
interface LumiContext {
  // Auto-collected by widget
  url?: string;              // Current page URL
  pathname?: string;         // URL pathname
  deviceType?: DeviceType;   // "mobile" | "tablet" | "desktop"
  viewport?: { width: number; height: number };
  userAgent?: string;

  // User-provided
  app?: string;              // Application identifier

  // Segmentation (LOW CARDINALITY - becomes dashboard graphs)
  tags?: Record<string, string | number | boolean>;
  
  // Debugging (HIGH CARDINALITY - shown in detail view only)
  debug?: Record<string, unknown>;
}
```

#### Tags vs Debug

| Field | Cardinality | Use Case | Example |
|-------|-------------|----------|---------|
| `tags` | Low (< 10 values) | Graphs, segmentation | `{ harSykmelding: true, rolle: "arbeidsgiver" }` |
| `debug` | High (OK) | Individual inspection | `{ sessionId: "abc-123", behandlingId: "..." }` |

## Backend Mapping

The backend maps `surveyType` strings to enums:

| Widget Value | Backend Enum |
|--------------|--------------|
| `"rating"` | `SurveyType.RATING` |
| `"topTasks"` | `SurveyType.TOP_TASKS` |
| `"discovery"` | `SurveyType.DISCOVERY` |
| `"taskPriority"` | `SurveyType.TASK_PRIORITY` |
| Everything else | `SurveyType.CUSTOM` |

## Example Payload

```json
{
  "surveyId": "sykepenger-rating",
  "surveyType": "rating",
  "context": {
    "url": "https://nav.no/sykepenger",
    "pathname": "/sykepenger",
    "deviceType": "mobile",
    "app": "sykepenger-frontend",
    "tags": {
      "harAktivSykmelding": true,
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
