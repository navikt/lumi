---
title: Surveytyper
---

# Surveytyper

Feltet `type` i `LumiSurveyConfig` bestemmer hva surveyen måler og hvordan dataen presenteres i dashboardet. Velg riktig type fra starten — det scoper spørsmålsflyten, validering og visualisering.

## Oversikt

| Surveytype | Når bruke | Hva du får ut | Typiske fallgruver |
| :--- | :--- | :--- | :--- |
| `rating` | «Pulse» etter en konkret oppgave | Trend over tid + årsak i fritekst | For generelt spørsmål, for mange spørsmål |
| `discovery` | Utforske hva brukeren kom for å gjøre | Frie tekstsvar + suksess-rate | For mye tekst, dårlig segmentering |
| `topTasks` | Måle suksess for kjerneoppgaver (McGovern) | Suksess/feil per oppgave + blocker | For mange/få oppgaver, uklare oppgavenavn |
| `taskPriority` | Strategisk: hva er viktigst å prioritere? | Rangering av viktigste oppgaver (top N) | For få tasks, ikke randomisert |
| `custom` | Når du kombinerer eller bruker branching | Skreddersydd spørreflyt | Blir fort «for mye» |

::: tip Start enkelt
Start med `rating` eller `discovery`, og gå videre til `topTasks`/`taskPriority` når dere har en tydelig hypoteseliste.
:::

## Rating

Enkleste typen. Brukeren gir en vurdering (emoji, stjerner, tommel, NPS) og kan utdype i fritekst. Best egnet for løpende puls-målinger på en konkret flate eller oppgave. Dashboardet viser trend over tid og fritekst-oppsummering. Se [`DEFAULT_SURVEY_RATING`](/guider/presets-og-builders#ferdiglagde-presets) og [`createRatingSurvey`](/guider/presets-og-builders#createratingssurvey) for ferdiglagde utgangspunkt.

## Discovery

Kartlegger _hva brukeren kom for å gjøre_ — ikke bare om de likte det. Gir frie tekstsvar og en suksess-rate. Bruk denne når dere trenger å forstå brukerens intensjon før dere optimaliserer flyten. Se [`DEFAULT_SURVEY_DISCOVERY`](/guider/presets-og-builders#ferdiglagde-presets) og [`createDiscoverySurvey`](/guider/presets-og-builders#creatediscoverysurvey) for ferdiglagde utgangspunkt.

## Top tasks

Basert på Gerry McGoverns top-task-metodikk. Brukeren velger hvilken oppgave de forsøkte, og rapporterer om den lyktes eller ikke. Dashboardet viser suksess/feil per oppgave og blocker-tekst. Krever en forhåndsdefinert oppgaveliste. Se [`createTopTasksSurvey`](/guider/presets-og-builders#createtoptaskssurvey) for ferdiglagd builder.

## Task priority

Strategisk prioriteringsundersøkelse. Brukeren rangerer de viktigste oppgavene fra en liste. Resultatet er en rangering av hva brukerne mener er viktigst. Randomiser rekkefølgen for å unngå posisjons-bias. Se [`createTaskPrioritySurvey`](/guider/presets-og-builders#createtaskprioritysurvey) for ferdiglagd builder.

## Custom

Fullt fleksibel — du definerer spørsmålsflyten selv med branching, betinget synlighet og valgfrie spørsmålstyper. Bruk `custom` når ingen av de andre typene passer. Vær bevisst på kompleksitet — jo flere spørsmål, jo lavere svarprosent.

## Videre lesing

- [Presets & builders](/guider/presets-og-builders) — ferdiglagde snarveier for de vanligste surveytypene
- [Spørsmålstyper](/guider/sporsmalstyper) — detaljer om rating, text, singleChoice og multiChoice
- [Konfigurer survey](/kom-i-gang/konfigurer-survey) — steg-for-steg oppsett av en survey
