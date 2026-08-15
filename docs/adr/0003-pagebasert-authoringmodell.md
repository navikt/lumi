---
title: "ADR 0003: Pagebasert authoringmodell for surveys"
status: Akseptert
date: 2026-08-15
---

# ADR 0003: Pagebasert authoringmodell for surveys

- **Status:** Akseptert
- **Dato:** 2026-08-15
- **Berører:** #336 (flere spørsmål per steg), #338 (Survey Builder UI), ADR 0001

## Kontekst

`LumiSurveyConfig` er en flat, ordnet liste med spørsmål. I stegmodus er hvert
spørsmål også en navigasjonsenhet. Det gjør det umulig å vise flere relaterte
spørsmål sammen på ett steg uten å endre den offentlige kontrakten.

En framtidig Survey Builder trenger en serialiserbar authoringmodell. Den må
holdes adskilt fra dagens submission-`definition`, som er en strukturell guard
for svarenes analytiske betydning og ikke et lager for presentasjon eller
drafts.

Vi vurderte også `sections`, inspirert av Oppfølgingsplanens versjonerte
`FormSnapshot`. Der er sections semantiske dokumentkapitler som brukes i
historisk visning og PDF. Lumi er en kort feedback-widget og har foreløpig ingen
konsument av section-identitet eller flere navngitte grupper på samme steg.

## Beslutning

### Ny, versjonert dokumentform

```ts
export type SurveyQuestionV1 =
  RemoveLegacyLogic<LumiSurveyQuestion>;

export interface SurveyPageV1 {
  id: string;
  title?: string;
  description?: string;
  questions: [SurveyQuestionV1, ...SurveyQuestionV1[]];
}

export interface SurveyDocumentV1 {
  authoringSchemaVersion: 1;
  type?: SurveyType;
  pages: [SurveyPageV1, ...SurveyPageV1[]];
}
```

`RemoveLegacyLogic` er en privat hjelpe-type. Det offentlige navnet beskriver
hva typen er, ikke hva som er fjernet.

En authored page er en navigasjonsenhet. Et runtime-steg er en page som er
synlig i den aktuelle svar- og metadatatilstanden.

### Flyt og synlighet

- `visibleIf` finnes bare på spørsmål i V1.
- En page er synlig når minst ett av spørsmålene er synlig.
- Pages uten synlige spørsmål hoppes over.
- Svarbasert `visibleIf` kan bare referere til tidligere spørsmål i
  dokumentrekkefølgen. Metadata-betingelser fungerer som før.
- Den nye dokumentformen avviser `logic`, `JUMP_TO`, `SKIP` og tidlig
  `SUBMIT`. Den kanoniske flyten er ordnet pages, filtrert av question-level
  `visibleIf`.

Dette innsnevrer builder-beslutningen i ADR 0001: en ny builder skal ikke
generere `logic`. Legacy-støtten beholdes midlertidig for eksisterende
konsumenter.

### Layout

- `steps` navigerer mellom synlige pages.
- `singlePage` flater ut navigasjonen, men beholder page-tittel og description
  som visuell og semantisk struktur.
- `auto` bruker stegmodus for et V1-dokument med mer enn én authored page.
  Valget er statisk og endres ikke når synlighet endres.
- Flat legacy-config beholder dagens `auto`-policy, der branching eller
  verdiavhengig synlighet aktiverer stegmodus.

### Validering og tilgjengelighet

- Alle synlige obligatoriske spørsmål på aktiv page valideres samlet.
- Ved flere feil vises Aksel `ErrorSummary` med lenker til spørsmålene.
- Etter eksplisitt page-navigasjon flyttes fokus til page-tittelen, eller det
  første synlige spørsmålet dersom tittelen mangler.
- Svarstyrte synlighetsendringer skal ikke stjele fokus.
- Fremdrift, tilbakehistorikk og `onStepChange` er page-baserte for den nye
  modellen. Intro og success teller ikke som pages.

### Kompatibilitet og persistens

- `LumiSurveyConfig` med flat `questions[]` beholdes som kompatibilitetsinput.
- Canonicalizer markerer kilden og normaliserer legacy til én intern page per
  spørsmål, uten å endre legacy-layout eller `logic`-semantikk.
- Submission, answers og `definition.fields` forblir flate og question-baserte.
- Page-ID, title og description sendes ikke i dagens payload og inngår ikke i
  definition-hashen.
- `authoringSchemaVersion` er versjonen av dokumentformatet, ikke
  submission-`schemaVersion`.
- En framtidig dashboard-store må lagre egne immutable authoring-revisjoner.
  Dagens `survey_definitions` skal ikke gjenbrukes som configlager.

## Konsekvenser

### Positivt

- Flere spørsmål kan valideres og vises som ett steg.
- Den offentlige modellen er ren JSON og egner seg for framtidig builder/codegen.
- Legacy-konsumenter trenger ingen migrering.
- Presentasjonsendringer skaper ikke nye 409-konflikter i API-et.
- `logic` utvides ikke inn i en ny og tvetydig page-semantikk.

### Kostnad

- Legacy- og dokumentflyt har ulik `auto`-policy og må bære kildeinformasjon i
  den interne canonical-modellen.
- Fremdriftsestimatet ved betingede pages er fortsatt et estimat, som ved annen
  branching.
- En senere serverstyrt builder trenger eksplisitt versjons- og
  minimumsklienthåndtering.

## Vurderte alternativer

### Obligatoriske sections

Forkastet i V1. Det gir et ekstra nivå og boilerplate uten en konkret
Lumi-konsument.

### Valgfrie sections

Forkastet i V1. Det gir to permanente authoringgrammatikker på hver page og
mer kompleks validering, rendering og builder-state. Dersom behovet oppstår,
kan V1 migreres deterministisk til V2 ved å pakke hver page inn i én section.

### Page-level `visibleIf`

Forkastet i V1. Question-level synlighet er tilstrekkelig og holder ett
betingelsesnivå. Feltet kan legges til additivt senere dersom repetisjon blir et
dokumentert problem.

### Pages i submission-definitionen

Forkastet. Page-layout endrer ikke svarenes strukturelle betydning og skal ikke
utløse 409 ved en ren presentasjonsendring.

## Når `Section` skal revurderes

`Section` innføres først når minst én reell survey trenger flere navngitte
grupper på samme runtime-page, eller når builder, oppsummering, historikk eller
PDF faktisk bruker gruppeidentiteten. Da skal en ny authoring-schema-versjon ha
én entydig modell (`page → sections → questions`), ikke valgfrie sections ved
siden av direkte spørsmål.
