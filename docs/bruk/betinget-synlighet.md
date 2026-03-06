---
title: Betinget synlighet
---

# Betinget synlighet

Med `visibleIf` kan du vise oppfølgingsspørsmål kun når det er relevant — såkalt progressiv disclosure. Det gir kortere surveyer og bedre svarprosent.

## Grunnleggende bruk

Legg `visibleIf` på spørsmålet som skal skjules til en betingelse er oppfylt:

```tsx
const survey = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var opplevelsen din?",
      required: true,
    },
    {
      id: "feedback",
      type: "text",
      prompt: "Har du andre tilbakemeldinger?",
      maxLength: 1000,
      visibleIf: {
        field: "ANSWER",
        questionId: "rating",
        operator: "EXISTS",
      },
    },
  ],
};
```

Her vises tekstfeltet først etter at brukeren har valgt en emoji. Ingen ekstra kode — widgeten håndterer alt.

## Operatorer

| Operator | Beskrivelse | Eksempel |
| :--- | :--- | :--- |
| `EXISTS` | Svaret eksisterer (ikke `undefined`) | Vis fritekst etter rating er valgt |
| `EQ` | Lik en verdi | Vis kun når bruker valgte «Nei» |
| `NEQ` | Ulik en verdi | Vis når bruker *ikke* valgte «Ja» |
| `GT` | Større enn | Vis kun for rating > 3 |
| `LT` | Mindre enn | Vis oppfølging for rating < 3 |
| `CONTAINS` | Inneholder verdi (for multi-choice) | Vis når «Annet» er blant valgene |

## Eksempler

### Vis kun for lav score

```tsx
{
  id: "complaint",
  type: "text",
  prompt: "Hva gikk galt?",
  visibleIf: {
    field: "ANSWER",
    questionId: "rating",
    operator: "LT",
    value: 3,
  },
}
```

### Vis basert på et spesifikt valg

```tsx
{
  id: "other-reason",
  type: "text",
  prompt: "Beskriv hva du prøvde å gjøre",
  visibleIf: {
    field: "ANSWER",
    questionId: "reason",
    operator: "EQ",
    value: "other",
  },
}
```

### Vis når svaret *ikke* er «Ja»

```tsx
{
  id: "blocker",
  type: "text",
  prompt: "Hva hindret deg?",
  visibleIf: {
    field: "ANSWER",
    questionId: "taskSuccess",
    operator: "NEQ",
    value: "yes",
  },
}
```

## Condition-struktur

Alle `visibleIf`-betingelser følger samme form:

```ts
interface LogicCondition {
  /** Hva sammenlignes — "ANSWER" eller "METADATA" */
  field?: "ANSWER" | "METADATA";

  /** Hvilket spørsmål svaret hentes fra (påkrevd for ANSWER med kryssreferanse) */
  questionId?: string;

  /** Sammenligningsoperator */
  operator: "EXISTS" | "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS";

  /** Verdi å sammenligne med (ikke nødvendig for EXISTS) */
  value?: string | number | boolean;
}
```

::: tip Bruk `questionId` for kryss-referanser
`questionId` refererer til `id`-en til spørsmålet du vil sjekke svaret på. Uten `questionId` evalueres betingelsen mot det *gjeldende* spørsmålets svar.
:::

## Metadata-betingelser

Du kan også vise spørsmål basert på metadata (kontekst-verdier) i stedet for svar:

```tsx
{
  id: "internal-feedback",
  type: "text",
  prompt: "Tilbakemelding for internt bruk",
  visibleIf: {
    field: "METADATA",
    key: "rolle",
    operator: "EQ",
    value: "veileder",
  },
}
```

## Når trenger du noe mer?

`visibleIf` er perfekt for progressiv disclosure — vis/skjul oppfølgingsspørsmål basert på tidligere svar. Men noen ganger trenger du å faktisk *endre flyten*: hoppe til et annet spørsmål, skippe neste steg, eller avslutte surveyen tidlig.

Da bruker du `logic` i stedet. Se [Avansert branching](/tilpasning/avansert) for full dokumentasjon.

::: info Tommelfingerregel
- **Vis/skjul spørsmål** → `visibleIf`
- **Endre rekkefølge / hoppe / avslutte** → `logic`
:::
