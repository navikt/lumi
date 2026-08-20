---
title: Migrer en eldre survey
search: false
---

# Migrer en eldre survey

Eldre surveyer fortsetter å virke i `@navikt/lumi-survey` 2.x. Du trenger ikke migrere bare for å oppgradere pakken. Når du først endrer en survey, anbefaler vi å flytte den til `SurveyDocumentV1` slik at nye og eksisterende surveyer bruker samme modell.

`SurveyDocumentV1` krever versjon 2.0.0 eller nyere.

## Dette er den nye modellen

| Eldre bruk | Bruk dette i `SurveyDocumentV1` | Merknad |
| :--- | :--- | :--- |
| Flat `questions[]` på én flate | Én side med alle spørsmålene | Bevarer samlet visning |
| `questionLayout: "steps"` | Én side per spørsmål og standardverdien `auto` | Ett spørsmål om gangen uten egen visningsmekanisme |
| `questionLayout: "auto"` som blir stegvis på grunn av `logic` eller verdiavhengig `visibleIf` | Én side per spørsmål som var et steg | Bevarer den synlige navigasjonen mens flytreglene migreres |
| `visibleIf` | Samme betingelse på et senere spørsmål | Svarbetingelser må vise til et tidligere spørsmål |
| `logic: SKIP` | `visibleIf` på spørsmålet som skulle hoppes over | Siden hoppes over når ingen spørsmål er synlige |
| `logic: SUBMIT` | Skjul senere spørsmål med `visibleIf` | Den siste synlige siden får send-knapp. Brukeren bekrefter innsendingen selv |
| Framoverrettet `JUMP_TO` | `visibleIf` på innholdet som skal hoppes over | Test alle grener og tilbakeknappen |
| Bakoverrettet eller syklisk `JUMP_TO` | Behold eldre konfigurasjon foreløpig | Dokumentformatet har med vilje ingen direkte erstatning |
| `intro`-prop med vanlig tekst | `document.intro` | Behold prop-en for rik eller appspesifikk overstyring |
| `success.title` og `success.body` | `document.success` | Knapp og automatisk lukking forblir props |
| Preset eller builder | Lag tilsvarende dokument i Surveyverksted eller kode | Eksisterende oppsett kan fortsette å kjøre |
| Spørsmålsbasert `onStepChange` | Sidebasert `onStepChange` | Oppdater forventningene i eventuell måling |

## Fra flat liste til sider

```typescript
import type {
  LumiSurveyConfig,
  SurveyDocumentV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";

const ratingQuestion = {
  id: "opplevelse",
  type: "rating",
  variant: "emoji",
  prompt: "Hvordan var opplevelsen din?",
  required: true,
} satisfies SurveyQuestionV1;

const commentQuestion = {
  id: "kommentar",
  type: "text",
  prompt: "Hva kan vi gjøre bedre?",
} satisfies SurveyQuestionV1;
```

Eldre konfigurasjon:

```typescript
const survey = {
  type: "rating",
  questions: [ratingQuestion, commentQuestion],
} satisfies LumiSurveyConfig;
```

Ny konfigurasjon med ett spørsmål om gangen:

```typescript
const survey = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    { id: "vurdering", questions: [ratingQuestion] },
    { id: "kommentar", questions: [commentQuestion] },
  ],
} satisfies SurveyDocumentV1;
```

Hvis begge spørsmålene skal vises sammen, legger du dem på samme side:

```typescript
pages: [
  {
    id: "tilbakemelding",
    questions: [ratingQuestion, commentQuestion],
  },
]
```

## Erstatt hopp med synlighet

I dokumentformatet ligger sidene alltid i en forutsigbar rekkefølge. Bruk `visibleIf` til å avgjøre hvilke spørsmål og sider som er relevante.

```typescript
{
  id: "oppfolging",
  questions: [
    {
      id: "hva-manglet",
      type: "text",
      prompt: "Hva manglet?",
      visibleIf: {
        all: [
          { questionId: "resultat", operator: "EXISTS" },
          { questionId: "resultat", operator: "NEQ", value: "ja" },
        ],
      },
    },
  ],
}
```

Behold den eldre konfigurasjonen hvis surveyen faktisk må hoppe bakover eller gå i en sirkel. Ikke bygg nye surveyer på dette mønsteret.

## Behold eller bytt `surveyId`

En ren flytting fra spørsmål til sider endrer ikke dataformatet som sendes inn. Du kan beholde `surveyId` når spørsmåls-ID-er, typer, svaralternativer og betydning er uendret.

Velg en ny `surveyId` når migreringen også endrer det dere måler. Se [Survey-identitet og endringer](/guider/survey-identitet).

## Sjekk etter migrering

- Gå gjennom alle synlige veier i surveyen.
- Sjekk at oppfølginger ikke vises før spørsmålet de avhenger av er besvart.
- Sjekk fremdrift, tilbakeknapp og `onStepChange` hvis appen bruker dem.
- Sammenlign innsendingsdataene før og etter når du beholder samme `surveyId`.
- Prøv surveyen med tastatur og på liten skjerm.

## Støtte i 2.x

Disse eldre API-ene blir værende av hensyn til eksisterende surveyer:

- `LumiSurveyConfig` med flat `questions[]`
- presets og builder-funksjoner
- `questionLayout: "steps"` med ett spørsmål per steg
- `logic` med `JUMP_TO`, `SKIP` og tidlig `SUBMIT`

De får ikke nye funksjoner og er ikke dokumentert som løsninger for nye surveyer. En eventuell fjerning blir en egen, versjonert beslutning med tydelig varsel.
