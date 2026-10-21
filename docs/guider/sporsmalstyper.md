---
title: Spørsmålstyper
---

# Spørsmålstyper

Lumi har fire spørsmålstyper: `rating`, `text`, `singleChoice` og `multiChoice`. Alle typene har [noen felles felt](#felles-felt), og hver type har i tillegg egne felt.

## Rating

Brukeren gir en vurdering på en visuell skala. Dere velger variant, og varianten bestemmer skalaen.

| Variant | Skala | Visuelt |
| :--- | :--- | :--- |
| `emoji` (standard) | 1–5 | 😡 🙁 😐 😀 😍 |
| `thumbs` | 1–2 | 👎 👍 |
| `stars` | 1–5 | ⭐⭐⭐⭐⭐ |
| `nps` | 0–10 | Nummererte knapper med valgfri tekst i hver ende |

### Emoji (standard)

```tsx
{
  id: "rating",
  type: "rating",
  variant: "emoji", // kan utelates, emoji er standard
  prompt: "Hvordan var opplevelsen din?",
  description: "Tenk på oppgaven du nettopp gjorde.",
  required: true,
}
```

### Thumbs

Passer til enkle spørsmål som «Var dette nyttig?».

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

Brukeren gir fra én til fem stjerner.

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

| Felt | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Ja | Unik ID for spørsmålet |
| `type` | `"rating"` | Ja | Spørsmålstype |
| `variant` | `"emoji" \| "thumbs" \| "stars" \| "nps"` | Nei | Visuell variant (standard: `"emoji"`) |
| `prompt` | `string` | Ja | Spørsmålsteksten |
| `description` | `string` | Nei | Hjelpetekst under spørsmålsteksten |
| `required` | `boolean` | Nei | Om svaret er påkrevd |
| `lowLabel` | `string` | Nei | Tekst ved laveste verdi (bare `nps`) |
| `highLabel` | `string` | Nei | Tekst ved høyeste verdi (bare `nps`) |
| `labels` | `Array<{ value, label }>` | Nei | Egen tekst for hver verdi |

## Text

Et fritekstfelt som passer godt til oppfølgingsspørsmål. Uten `maxLength` kan
brukeren skrive 1000 tegn, og API-kontrakten tillater høyst 2000 tegn. `maxLength`
må være et positivt heltall. Er verdien høyere, bruker widgeten 2000.

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

| Felt | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Ja | Unik ID for spørsmålet |
| `type` | `"text"` | Ja | Spørsmålstype |
| `prompt` | `string` | Ja | Spørsmålsteksten |
| `description` | `string` | Nei | Hjelpetekst under spørsmålsteksten |
| `required` | `boolean` | Nei | Om svaret er påkrevd |
| `maxLength` | `number` | Nei | Positivt heltall (standard 1000, øvre grense 2000) |
| `minRows` | `number` | Nei | Minste antall rader i tekstfeltet |
| `placeholder` | `string` | Nei | Plassholdertekst |
| `autoComplete` | `string` | Nei | `autocomplete`-attributtet i HTML |

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

Brukeren velger ett eller flere alternativer. Det finnes to varianter:

- `"checkbox"` (standard): en vanlig liste med avkrysningsbokser, best når det er få alternativer
- `"combobox"`: en nedtrekksliste med søk der valgene vises som chips, anbefalt fra ti alternativer og oppover

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

### Combobox med `maxSelections`

Med mange alternativer passer `combobox` bedre. Et typisk eksempel er oppgavelisten i **Hvilke oppgaver er viktigst?**

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

| Felt | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Ja | Unik ID for spørsmålet |
| `type` | `"singleChoice" \| "multiChoice"` | Ja | Spørsmålstype |
| `prompt` | `string` | Ja | Spørsmålsteksten |
| `description` | `string` | Nei | Hjelpetekst under spørsmålsteksten |
| `options` | `Array<{ value, label, description? }>` | Ja | Alternativene brukeren kan velge |
| `required` | `boolean` | Nei | Om svaret er påkrevd |
| `randomize` | `boolean` | Nei | Viser alternativene i tilfeldig rekkefølge |
| `variant` | `"checkbox" \| "combobox"` | Nei | Visuell variant (bare `multiChoice`, standard: `"checkbox"`) |
| `maxSelections` | `number` | Nei | Høyeste antall valg (bare `multiChoice`) |

## Felles felt

Disse feltene finnes på alle spørsmålstyper:

| Felt | Type | Beskrivelse |
| :--- | :--- | :--- |
| `id` | `string` | Unik ID, som også brukes i payloaden med svarene |
| `prompt` | `string` | Spørsmålsteksten som vises til brukeren |
| `description` | `string` | Valgfri hjelpetekst under spørsmålsteksten |
| `required` | `boolean` | Brukeren må svare før surveyen kan sendes inn |
| `visibleIf` | `VisibleIfCondition` | Se [Vis bare relevante spørsmål](/guider/betinget-synlighet) |

## Komplett eksempel

Surveyen under har tre spørsmålstyper på hver sin side. Det andre og det tredje spørsmålet vises først når brukeren har svart på det forrige.

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { LumiSurveyDock, LumiSurveyHttpError } from "@navikt/lumi-survey";
import type {
  SurveyDocumentV1,
  LumiSurveyTransport,
} from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  submit: async (submission, options) => {
    const response = await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
      signal: options?.signal ?? null,
    });
    if (!response.ok) {
      throw LumiSurveyHttpError.fromResponse(response);
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
      surveyId="min-app-tilbakemelding"
      survey={survey}
      transport={transport}
    />
  );
}
```

::: tip Velg sider først
Legg hvert spørsmål på sin egen side når brukeren skal svare på én ting om gangen. Samle flere spørsmål på samme side bare når de hører tett sammen. Se [Sider og flyt](/guider/sider-og-flyt).
:::
