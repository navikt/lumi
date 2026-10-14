---
title: Migrer en eldre survey
---

# Migrer en eldre survey

Eldre surveyer virker fortsatt i `@navikt/lumi-survey` 2.x. Skal dere bruke en
survey videre, oppgraderer dere til 2.2.1 eller nyere og flytter den til
`SurveyDocumentV1`. Surveyer som skal stoppes, skrur dere av.
Ikke migrer dem bare for å standardisere koden.

Kartlegg alle Lumi-surveyer i appen før dere merger pakkeoppgraderingen.
Oppgraderingen gjelder alle widgetene som bruker samme pakkeversjon i appen,
også surveyene dere ikke skal migrere.

## Oppgrader pakken

Bruk `@navikt/lumi-survey@^2.2.1`. Dokumentformatet krever minst 2.0.0, men
2.2.1 retter hvilke oppfølgingsspørsmål som vises når brukeren endrer et svar,
og framdriften i surveyer med betingede spørsmål. Versjonssiden i
Surveyverksted anbefaler samme versjon.

### Hvis appen bruker 0.x

Versjon 1.0.0 og nyere sender `schemaVersion: 2` med hele surveydefinisjonen
og en dedupliseringsnøkkel. Lumi API godtar at den første innsendingen med
`schemaVersion: 2` har med spørsmål som manglet i de eldre innsendingene. Et
spørsmål som er fjernet eller endret, gir 409.

### Hvis appen bruker 1.x

Disse endringene i 2.x kan påvirke en survey som virker i 1.x:

- En flat survey med `visibleIf` som sammenligner svarverdier med `EQ`, `NEQ`,
  `GT`, `LT` eller `CONTAINS`, viser ett spørsmål om gangen når
  `questionLayout` er `auto`. I 1.x ga bare `logic` steg automatisk. Sett
  `questionLayout: "singlePage"` i `behavior` hvis spørsmålene fortsatt skal
  vises samlet. `EXISTS` alene gir ikke steg.
- `logic` med `condition.questionId` bruker nå svaret på spørsmålet som
  betingelsen viser til. I 1.x ble svaret på det gjeldende spørsmålet brukt.
  Gå gjennom alle grenene hvis surveyen har slike regler.
- Svar på spørsmål som er skjult av `visibleIf` når brukeren sender inn, blir
  ikke sendt.
- `question.visibleIf` har typen `VisibleIfCondition`, som også kan være en
  gruppe med `any` eller `all`. Kode som leser `visibleIf.operator`, må først
  sjekke typen med `isConditionGroup` eller `isLeafCondition`.
- Et `SurveyDocumentV1` uten `type` sendes som `custom`. Hadde den gamle
  surveyen en annen type, for eksempel `rating` fra en preset, gir det 409.
  Sett samme `type` som før.
- De anbefalte builderne bruker ikke alltid de samme spørsmåls-ID-ene som de
  eldre. Se [Behold eller bytt `surveyId`](#behold-eller-bytt-surveyid).

## Eldre bruk og ny modell

| Eldre bruk | Bruk dette i `SurveyDocumentV1` | Merknad |
| :--- | :--- | :--- |
| Flat `questions[]` som vises samlet | Én side med alle spørsmålene | Bevarer samlet visning |
| `questionLayout: "steps"` | Én side per spørsmål og standardverdien `auto` | Ett spørsmål om gangen uten egen visningsmekanisme |
| `questionLayout: "auto"` som blir stegvis på grunn av `logic` eller verdiavhengig `visibleIf` | Én side per spørsmål som var et steg | Bevarer den synlige navigasjonen mens flytreglene migreres |
| `visibleIf` | Samme betingelse på et senere spørsmål | Svarbetingelser må vise til et tidligere spørsmål |
| `logic: SKIP` | `visibleIf` på spørsmålet som skulle hoppes over | Siden hoppes over når ingen spørsmål er synlige |
| `logic: SUBMIT` | Skjul senere spørsmål med `visibleIf` | Den siste synlige siden får send-knapp. Brukeren bekrefter innsendingen selv |
| Framoverrettet `JUMP_TO` | `visibleIf` på innholdet som skal hoppes over | Test alle grener og tilbakeknappen |
| Bakoverrettet eller syklisk `JUMP_TO` | Ikke en støttet migrering | Redesign flyten før migrering, eller la surveyen stå urørt slik den er i appen i dag |
| `intro`-prop med vanlig tekst | `document.intro` | Behold prop-en for rik eller appspesifikk overstyring |
| `success.title` og `success.body` | `document.success` | Knapp og automatisk lukking forblir props |
| Preset eller builder | Lag tilsvarende dokument i Surveyverksted eller kode | Eksisterende oppsett kan fortsette å kjøre. Spørsmåls-ID-ene kan bli andre, se [Behold eller bytt `surveyId`](#behold-eller-bytt-surveyid) |
| Spørsmålsbasert `onStepChange` | Sidebasert `onStepChange` | Oppdater forventningene i eventuell måling |

## Flytt spørsmålene til sider

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

Hvis begge spørsmålene skal vises sammen, legger dere dem på samme side:

```typescript
pages: [
  {
    id: "tilbakemelding",
    questions: [ratingQuestion, commentQuestion],
  },
]
```

## Erstatt hopp med synlighet

I dokumentformatet har sidene alltid fast rekkefølge. Bruk `visibleIf` til å avgjøre hvilke spørsmål og sider som er relevante.

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

En survey som må hoppe bakover eller gå i en sirkel, er ikke klar for
denne migreringen. Redesign flyten før den flyttes til `SurveyDocumentV1`,
eller la den stå urørt slik den er i appen i dag. Ikke bygg nye surveyer på
dette mønsteret.

## Behold eller bytt `surveyId`

En ren flytting fra spørsmål til sider endrer ikke dataformatet som sendes inn.
Dere kan beholde `surveyId` når `type`, spørsmåls-ID-er, spørsmålstyper,
ratingvariant og skala, svaralternativer, grenser for antall valg og betydning
er uendret.

De anbefalte builderne som ender på `SurveyDocument`, bruker andre
spørsmåls-ID-er enn flere av de eldre:

- I Discovery er `discoveredTask` blitt `task`, og `taskSuccess` er blitt
  `success`.
- I Top Tasks er `taskSuccess` blitt `success`.
- I Task Priority er `priorities` blitt `priority`.
- `createRatingSurveyDocument` kaller alltid vurderingen `rating`.
  `DEFAULT_SURVEY_THUMBS`, `DEFAULT_SURVEY_STARS` og `DEFAULT_SURVEY_NPS`
  bruker `helpful`, `stars` og `nps`.

Bytter dere til en builder med andre ID-er og beholder samme `surveyId`, svarer
Lumi API med 409. `DEFAULT_SURVEY_RATING` og `DEFAULT_RATING_SURVEY_DOCUMENT`
har de samme ID-ene. [Eldre presets og builders](/guider/presets-og-builders#bytte-til-en-anbefalt-builder)
viser hvilke par som kan byttes, og hvilke ID-er hver preset bruker.

Skal surveyen beholde `surveyId`, skriver dere dokumentet i kode med de gamle
spørsmåls-ID-ene. Se [Behold ID-ene i dokumentformatet](/guider/presets-og-builders#behold-id-ene-i-dokumentformatet).

Velg en ny `surveyId` når migreringen også endrer det dere måler. Se [Survey-identitet og endringer](/guider/survey-identitet).

## Gjenskap en survey i Surveyverksted

Surveyverksted kan ikke importere en survey fra kode. Dere lager surveyen på
nytt fra et av valgene under **Hva vil dere finne ut?**. Spørsmåls-ID-ene kommer
fra valget eller lages automatisk, for eksempel `text-1a2b3c4d`, og de kan ikke
endres i Surveyverksted. Valget **Hvordan opplevde brukeren tjenesten?** gir for
eksempel `rating` og `kommentar`, mens `DEFAULT_SURVEY_RATING` bruker `rating`
og `feedback`.

En survey som gjenskapes i Surveyverksted, trenger derfor en ny `surveyId`. Med
samme `surveyId` svarer Lumi API med 409, fordi spørsmåls-ID-ene ikke stemmer
med definisjonen som er lagret.

Den nye `surveyId`-en blir en ny analyseserie. Svarene under den gamle ID-en
blir liggende, men Lumi kobler ikke de to seriene sammen. Dashboardet viser dem
som to surveyer, og trenden for den nye ID-en starter med det første svaret den
får. Se [Slik tar dere i bruk en strukturell endring](/guider/survey-identitet#slik-tar-dere-i-bruk-en-strukturell-endring).

## Sjekk etter migrering

- Bekreft hvem som har ansvaret for hver eksisterende survey, og om den skal
  beholdes, stoppes eller avklares videre.
- Oppgrader til `@navikt/lumi-survey@^2.2.1` og behold én pakkeversjon i appen.
- Sammenlign `type`, spørsmåls-ID-er, spørsmålstyper, ratingvariant og skala,
  svaralternativer og grenser for antall valg med surveyen i produksjon når dere beholder samme
  `surveyId`.
- Gå gjennom alle synlige veier i surveyen.
- Sjekk at oppfølginger ikke vises før spørsmålet de avhenger av er besvart.
- Sjekk framdrift, tilbakeknapp og `onStepChange` hvis appen bruker dem.
- Sammenlign innsendingsdataene før og etter når dere beholder samme `surveyId`.
- Prøv surveyen med tastatur og på liten skjerm.
- Deploy først til dev uten auto-merge. Bruker appen Entra ID-tenanten
  `trygdeetaten.no` i dev, går innsendingene via `lumi-submission-proxy` i dev
  og direkte til `lumi-api` i produksjon.
- Send et testsvar gjennom appen i dev, for eksempel med dagens dato i et
  tekstsvar, slik at dere kjenner det igjen. Finn svaret i
  [dashboardet i dev](https://lumi-dashboard.ansatt.dev.nav.no), og sjekk at
  team, app og `surveyId` stemmer. Vent minst 15 minutter, send ett testsvar
  til og sjekk at også det vises før dere setter appen i produksjon.
- Husk at et testsvar i dev ikke viser at prod godtar definisjonen. Dev og prod
  har hver sin Lumi API. Se
  [Survey-identitet og endringer](/guider/survey-identitet#hva-identifiserer-surveyid).

## Støtte i 2.x

Disse eldre API-ene blir værende av hensyn til eksisterende surveyer:

- `LumiSurveyConfig` med flat `questions[]`
- presets og builder-funksjoner
- `questionLayout: "steps"` med ett spørsmål per steg
- `logic` med `JUMP_TO`, `SKIP` og tidlig `SUBMIT`

De får ikke nye funksjoner og er ikke dokumentert som løsninger for nye surveyer. En eventuell fjerning blir en egen, versjonert beslutning med tydelig varsel.
