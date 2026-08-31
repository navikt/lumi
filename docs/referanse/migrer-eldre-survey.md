---
title: Migrer en eldre survey
search: false
---

# Migrer en eldre survey

Eldre surveyer fortsetter å virke i `@navikt/lumi-survey` 2.x. Når et team
tar en survey videre i den nye løsningen, skal det likevel bruke 2.2.0 eller
nyere og flytte den til `SurveyDocumentV1`. Surveyer som skal stoppes, skal
skrus av i stedet for å bli migrert bare for å standardisere kode.

En oppgradering fra 0.x påvirker alle Lumi-widgeter som deler pakkeversjon i
appen: 1.0.0 og nyere sender `schemaVersion: 2` med definisjon og
dedupliseringsnøkkel. Kartlegg derfor alle eksisterende surveys i appen før
pakkeoppgraderingen merges, også dersom bare én av dem skal være første canary.

## Ansvarsgrense

Lumi-teamet gjør pakken, API-et, dev-proxyen, dashboardet og veiledningen klar.
Konsumentteamet eier endringene i sitt eget repository, valg av aktive surveys,
dev-deploy, canary og produksjonssetting. Lumi-teamet skal ikke endre eller
sende prober gjennom en annen app på teamets vegne.

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
| Bakoverrettet eller syklisk `JUMP_TO` | Ikke en støttet migrering | Redesign flyten før migrering, eller la surveyen stå urørt i eksisterende deploy. Ikke bruk den som canary |
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

En survey som faktisk må hoppe bakover eller gå i en sirkel, er ikke klar for
denne migreringen. Redesign flyten før den flyttes til `SurveyDocumentV1`,
eller la den stå urørt i eksisterende deploy. Ikke bruk den som første canary,
og ikke bygg nye surveyer på dette mønsteret.

## Behold eller bytt `surveyId`

En ren flytting fra spørsmål til sider endrer ikke dataformatet som sendes inn. Du kan beholde `surveyId` når spørsmåls-ID-er, typer, svaralternativer og betydning er uendret.

Velg en ny `surveyId` når migreringen også endrer det dere måler. Se [Survey-identitet og endringer](/guider/survey-identitet).

## Sjekk etter migrering

- Bekreft eier og om hver eksisterende survey skal beholdes, stoppes eller
  fortsatt avklares.
- Oppgrader til `@navikt/lumi-survey@^2.2.0` og behold én pakkeversjon i appen.
- Gå gjennom alle synlige veier i surveyen.
- Sjekk at oppfølginger ikke vises før spørsmålet de avhenger av er besvart.
- Sjekk fremdrift, tilbakeknapp og `onStepChange` hvis appen bruker dem.
- Sammenlign innsendingsdataene før og etter når du beholder samme `surveyId`.
- Prøv surveyen med tastatur og på liten skjerm.
- Deploy først til dev uten auto-merge. En app i `trygdeetaten.no` skal bruke
  `lumi-submission-proxy` i dev og kalle `lumi-api` direkte i produksjon.
- Send en syntetisk startprobe, kontroller eksakt receipt i Lumi-dashboardet,
  vent minst 15 minutter og gjenta før produksjonssetting.

## Støtte i 2.x

Disse eldre API-ene blir værende av hensyn til eksisterende surveyer:

- `LumiSurveyConfig` med flat `questions[]`
- presets og builder-funksjoner
- `questionLayout: "steps"` med ett spørsmål per steg
- `logic` med `JUMP_TO`, `SKIP` og tidlig `SUBMIT`

De får ikke nye funksjoner og er ikke dokumentert som løsninger for nye surveyer. En eventuell fjerning blir en egen, versjonert beslutning med tydelig varsel.
