---
title: Spørsmålstyper
---

# Spørsmålstyper

Lumi støtter fire spørsmålstyper: **rating**, **text**, **singleChoice** og **multiChoice**. Hver type har egne properties som styrer oppførselen.

## Rating

Rating lar brukeren gi en vurdering på en visuell skala. Du velger variant — skalaen følger automatisk.

| Variant | Skala | Visuelt |
| :--- | :--- | :--- |
| `emoji` (default) | 1–5 | 😡 🙁 😐 😀 😍 |
| `thumbs` | 1–2 | 👎 👍 |
| `stars` | 1–5 | ⭐⭐⭐⭐⭐ |
| `nps` | 0–10 | Nummerte knapper med lav/høy-label |

### Emoji (default)

```tsx
{
  id: "rating",
  type: "rating",
  variant: "emoji", // kan utelates — emoji er default
  prompt: "Hvordan var opplevelsen din?",
  description: "Svarene er anonyme og brukes til videreutvikling",
  required: true,
}
```

### Thumbs

Perfekt for enkle «Var dette nyttig?»-spørsmål.

```tsx
{
  id: "helpful",
  type: "rating",
  variant: "thumbs",
  prompt: "Var dette til hjelp?",
  required: true,
}
```

### Stars

Klassisk femstjerners vurdering.

```tsx
{
  id: "stars",
  type: "rating",
  variant: "stars",
  prompt: "Hvordan opplevde du å bruke tjenesten?",
  required: true,
}
```

### NPS (Net Promoter Score)

0–10-skala med valgfrie labels i endene. Standardmetodikk for å måle lojalitet.

```tsx
{
  id: "nps",
  type: "rating",
  variant: "nps",
  prompt: "Hvor sannsynlig er det at du vil anbefale oss?",
  lowLabel: "Lite sannsynlig",
  highLabel: "Svært sannsynlig",
  required: true,
}
```

### Rating-properties

| Property | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | Unik ID for spørsmålet |
| `type` | `"rating"` | ✅ | Spørsmålstype |
| `variant` | `"emoji" \| "thumbs" \| "stars" \| "nps"` | ❌ | Visuell variant (default: `"emoji"`) |
| `prompt` | `string` | ✅ | Spørsmålsteksten |
| `description` | `string` | ❌ | Hjelpetekst under prompt |
| `required` | `boolean` | ❌ | Om svaret er påkrevd |
| `lowLabel` | `string` | ❌ | Label for lav verdi (kun `nps`) |
| `highLabel` | `string` | ❌ | Label for høy verdi (kun `nps`) |
| `labels` | `Array<{ value, label }>` | ❌ | Egne labels per verdi |

## Text

Fritekstfelt med valgfri maks-lengde. Bra for oppfølgingsspørsmål.

```tsx
{
  id: "comment",
  type: "text",
  prompt: "Hva kan vi forbedre?",
  maxLength: 1000,
  placeholder: "Skriv her...",
}
```

### Text-properties

| Property | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | Unik ID for spørsmålet |
| `type` | `"text"` | ✅ | Spørsmålstype |
| `prompt` | `string` | ✅ | Spørsmålsteksten |
| `description` | `string` | ❌ | Hjelpetekst under prompt |
| `required` | `boolean` | ❌ | Om svaret er påkrevd |
| `maxLength` | `number` | ❌ | Maks antall tegn |
| `minRows` | `number` | ❌ | Minimum antall rader i tekstfeltet |
| `placeholder` | `string` | ❌ | Plassholdertekst |
| `autoComplete` | `string` | ❌ | HTML autocomplete-attributt |

## Single choice

Brukeren velger ett alternativ fra en liste.

```tsx
{
  id: "reason",
  type: "singleChoice",
  prompt: "Hva var du her for å gjøre?",
  options: [
    { value: "apply", label: "Søke om noe" },
    { value: "status", label: "Sjekke status" },
    { value: "other", label: "Annet" },
  ],
  required: true,
}
```

## Multi choice

Brukeren velger ett eller flere alternativer. Støtter to varianter:

- `"checkbox"` (default) — tradisjonell avkrysningsliste, best for få valg
- `"combobox"` — søkbar dropdown med chips, anbefalt for 10+ alternativer

```tsx
{
  id: "topics",
  type: "multiChoice",
  prompt: "Hvilke temaer er du interessert i?",
  variant: "checkbox",
  options: [
    { value: "health", label: "Helse" },
    { value: "work", label: "Arbeid" },
    { value: "family", label: "Familie" },
  ],
}
```

### Combobox-variant med maxSelections

For mange alternativer (f.eks. Task Priority-surveyer) er combobox-varianten bedre:

```tsx
{
  id: "priorities",
  type: "multiChoice",
  variant: "combobox",
  prompt: "Velg de 5 viktigste oppgavene for deg",
  maxSelections: 5,
  randomize: true,
  options: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
    // ... flere alternativer
  ],
}
```

### Choice-properties (gjelder både single og multi)

| Property | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | Unik ID for spørsmålet |
| `type` | `"singleChoice" \| "multiChoice"` | ✅ | Spørsmålstype |
| `prompt` | `string` | ✅ | Spørsmålsteksten |
| `description` | `string` | ❌ | Hjelpetekst under prompt |
| `options` | `Array<{ value, label, description? }>` | ✅ | Valgalternativer |
| `required` | `boolean` | ❌ | Om svaret er påkrevd |
| `randomize` | `boolean` | ❌ | Randomiser rekkefølgen på alternativer |
| `variant` | `"checkbox" \| "combobox"` | ❌ | Visuell variant (kun multiChoice, default: `"checkbox"`) |
| `maxSelections` | `number` | ❌ | Maks antall valg (kun multiChoice) |

## Felles properties

Alle spørsmålstyper deler disse:

| Property | Type | Beskrivelse |
| :--- | :--- | :--- |
| `id` | `string` | Unik identifikator — brukes i svar-payloaden |
| `prompt` | `string` | Spørsmålsteksten som vises til brukeren |
| `description` | `string` | Valgfri hjelpetekst under spørsmålet |
| `required` | `boolean` | Krever svar for å sende inn |
| `analyticsId` | `string` | Valgfri ID for analytics (bruker `id` om ikke satt) |
| `visibleIf` | `LogicCondition` | Betinget visning — se [Betinget synlighet](/bruk/betinget-synlighet) |
| `logic` | `LogicRule[]` | Branching-regler — se [Avansert](/tilpasning/avansert) |

## Komplett eksempel

Her er en survey med flere spørsmålstyper og progressiv disclosure:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { LumiSurveyDock } from "@navikt/lumi-survey";
import type { LumiSurveyTransport } from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  submit: async (submission) => {
    await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};

const survey = {
  type: "custom" as const,
  questions: [
    {
      id: "rating",
      type: "rating" as const,
      variant: "emoji" as const,
      prompt: "Hvordan var opplevelsen din?",
      required: true,
    },
    {
      id: "reason",
      type: "singleChoice" as const,
      prompt: "Hva var du her for å gjøre?",
      options: [
        { value: "apply", label: "Søke om noe" },
        { value: "status", label: "Sjekke status" },
        { value: "other", label: "Annet" },
      ],
      visibleIf: { field: "ANSWER" as const, questionId: "rating", operator: "EXISTS" as const },
    },
    {
      id: "comment",
      type: "text" as const,
      prompt: "Har du andre tilbakemeldinger?",
      maxLength: 1000,
      visibleIf: { field: "ANSWER" as const, questionId: "rating", operator: "EXISTS" as const },
    },
  ],
};

export function MyPage() {
  return (
    <LumiSurveyDock
      surveyId="min-flate"
      survey={survey}
      transport={transport}
    />
  );
}
```

::: tip Bruk presets for vanlige mønstre
For de fleste tilfeller trenger du ikke bygge surveyen fra scratch. Se [Presets](/bruk/presets) for ferdige konfigurasjoner.
:::
