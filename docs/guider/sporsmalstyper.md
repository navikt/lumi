---
title: Spørsmålstyper
---

# Spørsmålstyper

Lumi støtter fire spørsmålstyper: **rating**, **text**, **singleChoice** og **multiChoice**. Hver type har egne properties som styrer oppførselen.

## Rating

Rating lar brukeren gi en vurdering på en visuell skala. Du velger variant — skalaen følger automatisk.

| Variant | Skala | Visuelt |
| :--- | :--- | :--- |
| `emoji` (standard) | 1–5 | 😡 🙁 😐 😀 😍 |
| `thumbs` | 1–2 | 👎 👍 |
| `stars` | 1–5 | ⭐⭐⭐⭐⭐ |
| `nps` | 0–10 | Nummerte knapper med lav/høy-label |

### Emoji (standard)

```tsx
{
  id: "rating",
  type: "rating",
  variant: "emoji", // kan utelates — emoji er standard
  prompt: "Hvordan var opplevelsen din?",
  description: "Tenk på oppgaven du nettopp gjorde.",
  required: true,
}
```

### Thumbs

Passer for enkle spørsmål som «Var dette nyttig?».

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

NPS bruker en skala fra 0 til 10 med valgfrie tekster i hver ende.

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

### Felt for rating

| Property | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | Unik ID for spørsmålet |
| `type` | `"rating"` | ✅ | Spørsmålstype |
| `variant` | `"emoji" \| "thumbs" \| "stars" \| "nps"` | ❌ | Visuell variant (standard: `"emoji"`) |
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

### Felt for text

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

- `"checkbox"` (standard) — tradisjonell avkrysningsliste, best for få valg
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
  id: "priority",
  type: "multiChoice",
  variant: "combobox",
  prompt: "Hvilke oppgaver er viktigst for deg?",
  maxSelections: 2,
  randomize: true,
  options: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
  ],
}
```

`maxSelections` må være minst 1 og kan ikke være høyere enn antallet alternativer.

### Felt for valgspørsmål

| Property | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | Unik ID for spørsmålet |
| `type` | `"singleChoice" \| "multiChoice"` | ✅ | Spørsmålstype |
| `prompt` | `string` | ✅ | Spørsmålsteksten |
| `description` | `string` | ❌ | Hjelpetekst under prompt |
| `options` | `Array<{ value, label, description? }>` | ✅ | Valgalternativer |
| `required` | `boolean` | ❌ | Om svaret er påkrevd |
| `randomize` | `boolean` | ❌ | Randomiser rekkefølgen på alternativer |
| `variant` | `"checkbox" \| "combobox"` | ❌ | Visuell variant (kun multiChoice, standard: `"checkbox"`) |
| `maxSelections` | `number` | ❌ | Maks antall valg (kun multiChoice) |

## Felles felt

Alle spørsmålstyper deler disse:

| Property | Type | Beskrivelse |
| :--- | :--- | :--- |
| `id` | `string` | Unik identifikator — brukes i svar-payloaden |
| `prompt` | `string` | Spørsmålsteksten som vises til brukeren |
| `description` | `string` | Valgfri hjelpetekst under spørsmålet |
| `required` | `boolean` | Krever svar for å sende inn |
| `visibleIf` | `VisibleIfCondition` | Se [Vis bare relevante spørsmål](/guider/betinget-synlighet) |

## Komplett eksempel

Her er en survey med flere spørsmålstyper og relevante oppfølgingsspørsmål:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { LumiSurveyDock } from "@navikt/lumi-survey";
import type {
  SurveyDocumentV1,
  LumiSurveyTransport,
} from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  submit: async (submission) => {
    const response = await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
    if (!response.ok) {
      throw new Error(`Innsending feilet med status ${response.status}`);
    }
  },
};

const survey = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "vurdering",
      questions: [
        {
          id: "rating",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var opplevelsen din?",
          required: true,
        },
      ],
    },
    {
      id: "oppgave",
      questions: [
        {
          id: "reason",
          type: "singleChoice",
          prompt: "Hva var du her for å gjøre?",
          options: [
            { value: "apply", label: "Søke om noe" },
            { value: "status", label: "Sjekke status" },
            { value: "other", label: "Annet" },
          ],
          visibleIf: {
            questionId: "rating",
            operator: "EXISTS",
          },
        },
      ],
    },
    {
      id: "kommentar",
      questions: [
        {
          id: "comment",
          type: "text",
          prompt: "Har du andre tilbakemeldinger?",
          maxLength: 1000,
          visibleIf: {
            questionId: "reason",
            operator: "EXISTS",
          },
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

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

::: tip Velg sider først
Legg hvert spørsmål på sin egen side når brukeren skal svare på én ting om gangen. Samle flere spørsmål på samme side bare når de hører tett sammen. Se [Sider og flyt](/guider/sider-og-flyt).
:::
