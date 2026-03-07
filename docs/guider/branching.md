---
title: Avansert
---

# Avansert branching med `logic`

Bruk `logic` når du trenger å endre flyten i surveyen — hoppe til et annet spørsmål, skippe neste steg, eller avslutte tidlig. For enkel vis/skjul bruker du heller [`visibleIf`](/guider/betinget-synlighet).

::: info Når bruke hva?
- **Vis/skjul spørsmål** → `visibleIf`
- **Endre rekkefølge / hoppe / avslutte** → `logic`
:::

## Slik fungerer det

`logic` er et array med regler som evalueres *etter* at brukeren svarer på et spørsmål. Første regel som matcher vinner.

```ts
interface LogicRule {
  condition: LogicCondition;
  action: LogicAction;
}
```

Widgeten bytter automatisk til step-modus (`questionLayout: "steps"`) når `logic` finnes.

## Action-typer

| Action | Beskrivelse |
| :--- | :--- |
| `JUMP_TO` | Hopp til et spesifikt spørsmål (krever `targetId`) |
| `SKIP` | Hopp over neste spørsmål (gå til `currentIndex + 2`) |
| `SUBMIT` | Send inn surveyen umiddelbart |

### TypeScript-typer

```ts
type LogicAction =
  | { type: "JUMP_TO"; targetId: string }
  | { type: "SKIP" }
  | { type: "SUBMIT" };
```

## Conditions

Conditions bestemmer om en regel skal aktiveres. Samme operator-sett som `visibleIf`.

```ts
type LogicCondition =
  | {
      field?: "ANSWER";
      questionId?: string;    // for kryssreferanse til annet spørsmål
      operator: "EXISTS" | "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS";
      value?: string | number | boolean;
    }
  | {
      field: "METADATA";
      key: string;
      operator: "EXISTS" | "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS";
      value: string | number | boolean;
    };
```

For `logic` evalueres betingelsen vanligvis mot *det gjeldende spørsmålets* svar — `questionId` er valgfri her (i motsetning til `visibleIf` der du alltid refererer til et annet spørsmål).

## Eksempler

### Avslutt tidlig for høy score

Fornøyde brukere trenger ikke svare på oppfølgingsspørsmål:

```tsx
const survey = {
  type: "custom",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvor fornøyd er du?",
      required: true,
      logic: [
        {
          // Rating >= 4: send inn direkte
          condition: { field: "ANSWER", operator: "GT", value: 3 },
          action: { type: "SUBMIT" },
        },
        // Ingen match → gå videre til neste spørsmål
      ],
    },
    {
      id: "complaint",
      type: "text",
      prompt: "Hva kan vi forbedre?",
      maxLength: 500,
    },
  ],
};
```

### Hopp til spesifikt spørsmål

```tsx
const survey = {
  type: "custom",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvor fornøyd er du?",
      required: true,
      logic: [
        {
          // Lav score → hopp til klage-spørsmålet
          condition: { field: "ANSWER", operator: "LT", value: 3 },
          action: { type: "JUMP_TO", targetId: "complaint" },
        },
        {
          // Høy score → avslutt
          condition: { field: "ANSWER", operator: "GT", value: 2 },
          action: { type: "SUBMIT" },
        },
      ],
    },
    {
      id: "praise",
      type: "text",
      prompt: "Hva var bra?",
    },
    {
      id: "complaint",
      type: "text",
      prompt: "Hva kan vi forbedre?",
    },
  ],
};
```

### Skip neste spørsmål

`SKIP` hopper over det *neste* spørsmålet i rekkefølgen:

```tsx
{
  id: "task",
  type: "singleChoice",
  prompt: "Hva prøvde du å gjøre?",
  options: [
    { value: "apply", label: "Søke om noe" },
    { value: "status", label: "Sjekke status" },
    { value: "other", label: "Noe annet" },
  ],
  logic: [
    {
      // Hvis ikke "other" → skip fritekst-oppfølgingen
      condition: { field: "ANSWER", operator: "NEQ", value: "other" },
      action: { type: "SKIP" },
    },
  ],
},
{
  id: "otherTask",
  type: "text",
  prompt: "Beskriv hva du prøvde å gjøre",
},
{
  id: "success",
  type: "singleChoice",
  prompt: "Klarte du det?",
  options: [
    { value: "yes", label: "Ja" },
    { value: "no", label: "Nei" },
  ],
},
```

### Top Tasks med branching

`createTopTasksSurvey` bruker `logic` under panseret. Her er et forenklet eksempel av mønsteret:

```tsx
const survey = {
  type: "topTasks",
  questions: [
    {
      id: "task",
      type: "singleChoice",
      prompt: "Hva prøvde du å gjøre?",
      options: [
        { value: "apply", label: "Søke om sykepenger" },
        { value: "status", label: "Sjekke status" },
        { value: "other", label: "Noe annet" },
      ],
      logic: [
        {
          condition: { field: "ANSWER", operator: "NEQ", value: "other" },
          action: { type: "SKIP" }, // Hopp over "otherTask"
        },
      ],
    },
    {
      id: "otherTask",
      type: "text",
      prompt: "Beskriv hva du prøvde å gjøre",
    },
    {
      id: "taskSuccess",
      type: "singleChoice",
      prompt: "Klarte du det?",
      options: [
        { value: "yes", label: "Ja" },
        { value: "partial", label: "Delvis" },
        { value: "no", label: "Nei" },
      ],
      logic: [
        {
          // "Ja" → ingen blocker, send inn
          condition: { field: "ANSWER", operator: "EQ", value: "yes" },
          action: { type: "SUBMIT" },
        },
      ],
    },
    {
      id: "blocker",
      type: "text",
      prompt: "Hva hindret deg?",
      maxLength: 500,
    },
  ],
};
```

## Evaluerings-rekkefølge

1. Brukeren svarer på et spørsmål
2. `logic`-reglene evalueres **i rekkefølge** (array-indeks)
3. **Første match vinner** — videre regler ignoreres
4. Hvis ingen regel matcher → gå til neste spørsmål som normalt

::: warning Rekkefølgen betyr noe
Regler evalueres top-to-bottom. Plasser de mest spesifikke betingelsene først.
:::

## Kombinere `visibleIf` og `logic`

Du kan bruke begge på samme survey. `visibleIf` styrer *om* et spørsmål vises, mens `logic` styrer *hva som skjer etterpå*:

```tsx
{
  id: "details",
  type: "text",
  prompt: "Fortell mer",
  // Vis kun når rating er satt
  visibleIf: { field: "ANSWER", questionId: "rating", operator: "EXISTS" },
  // Etter svar → avslutt
  logic: [
    {
      condition: { field: "ANSWER", operator: "EXISTS" },
      action: { type: "SUBMIT" },
    },
  ],
}
```
