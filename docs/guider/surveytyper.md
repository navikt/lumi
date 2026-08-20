---
title: Velg hva dere vil måle
---

# Velg hva dere vil måle

Feltet `type` forteller Lumi hvilken analyse surveyen tilhører. Start med det dere vil finne ut — Surveyverkstedet og de ferdige kodemalene setter riktig type og struktur for dere.

`type` bestemmer ikke hvilke sider eller spørsmål dokumentet kan ha. Spørsmålene og ID-ene avgjør hvilke data dashboardet faktisk kan vise.

## Velg et oppsett

| Type | Bruk når | Hva dashboardet viser |
| :--- | :--- | :--- |
| `rating` | Dere vil måle opplevelsen etter en konkret oppgave | Utvikling i vurderinger over tid og fritekstsvar |
| `discovery` | Dere vil forstå hva brukeren kom for å gjøre | Oppgaver i fritekst, om brukeren lyktes og hindringer |
| `topTasks` | Dere kjenner oppgavene og vil måle om brukeren lyktes | Resultat og hindringer per oppgave |
| `taskPriority` | Dere vil prioritere mellom en liste med oppgaver | Hvilke oppgaver som får flest stemmer |
| `custom` | Dere trenger spørsmål eller analyse som ikke passer i rating | Generell oversikt over svarene |

### `rating`

Bruk `rating` til en kort måling etter at brukeren har gjort noe konkret. Start med ett vurderingsspørsmål. Legg til et oppfølgingsspørsmål bare når dere vet hvordan svaret skal brukes.

```typescript
import { createRatingSurveyDocument } from "@navikt/lumi-survey";

const survey = createRatingSurveyDocument({
  ratingPrompt: "Hvordan var det å sende inn søknaden?",
  variant: "emoji",
});
```

Velg `variant: "emoji"`, `"thumbs"`, `"stars"` eller `"nps"`. For NPS kan dere også sette `lowLabel` og `highLabel`, for eksempel «Lite sannsynlig» og «Svært sannsynlig».

### `custom`

Bruk `custom` når ingen av de spesialiserte analysetypene passer. Du kan bruke alle spørsmålstyper, sider og `visibleIf`.

Velg `custom` hvis ingen av de ferdige oppsettene passer. Typeverdien alene gjør ikke et vilkårlig dokument om til en discovery-, top tasks- eller prioriteringsanalyse.

## Ferdige oppsett for oppgaver

Dokumentbyggerne på denne siden krever `@navikt/lumi-survey` 2.1.0 eller nyere.

Velg samme oppsett i Surveyverkstedet, eller bruk en av funksjonene under i kode. Funksjonene returnerer ferdige `SurveyDocumentV1`-dokumenter med sidene og spørsmåls-ID-ene analysen trenger.

### Forstå hva brukeren kom for å gjøre

```typescript
import { createDiscoverySurveyDocument } from "@navikt/lumi-survey";

const survey = createDiscoverySurveyDocument();
```

Bruk discovery når dere ikke vil gi brukeren en oppgaveliste. Brukeren beskriver oppgaven med egne ord og svarer deretter på om hen lyktes. Spørsmålet om hindringer vises bare ved «Delvis» eller «Nei».

### Måle om brukeren lyktes med en kjent oppgave

```typescript
import { createTopTasksSurveyDocument } from "@navikt/lumi-survey";

const survey = createTopTasksSurveyDocument({
  tasks: [
    { value: "soke", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status på søknaden" },
  ],
  includeOtherTask: true,
});
```

Bruk top tasks når dere allerede kjenner de viktigste oppgavene. Hold listen kort nok til at brukeren raskt finner riktig oppgave.

`value` er oppgavens stabile ID (`taskId`) i analyse, filtre og delbare lenker. Behold den når dere bare retter teksten. `label` er teksten brukeren ser, og kan endres uten at historikken splittes. Se [survey-identitet](/guider/survey-identitet) før dere endrer en publisert oppgaveliste.

### Prioritere mellom oppgaver

```typescript
import { createTaskPrioritySurveyDocument } from "@navikt/lumi-survey";

const survey = createTaskPrioritySurveyDocument({
  tasks: [
    { value: "soke", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status på søknaden" },
    { value: "ettersende", label: "Ettersende dokumentasjon" },
  ],
  maxSelections: 2,
});
```

Bruk oppgaveprioritering når dere skal velge hva dere bør forbedre eller bygge først. En reell undersøkelse trenger vanligvis en større og gjennomarbeidet oppgaveliste enn det korte kodeeksemplet.

Også her er `value` den stabile oppgave-ID-en, mens `label` er teksten som kan forbedres senere.

::: warning Behold feltene analysen trenger
Dere kan endre teksten og legge til egne spørsmål. Analysefeltene må være obligatoriske og alltid synlige. Ikke slett dem, bytt spørsmålstype eller endre svarverdiene som malen beskytter. Surveyverkstedet forklarer begrensningene i redigeringen og sjekker oppsettet før overlevering. Widgeten og API-et avviser også et ugyldig oppsett.
:::

## Videre lesing

- [Sider og flyt](/guider/sider-og-flyt) for å velge hva som skal vises sammen
- [Spørsmålstyper](/guider/sporsmalstyper) for alle feltene brukeren kan svare på
- [Vis bare relevante spørsmål](/guider/betinget-synlighet) for oppfølginger med `visibleIf`
