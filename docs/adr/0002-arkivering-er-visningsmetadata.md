---
title: "ADR 0002: Arkivering av surveys er visningsmetadata — dashboard-styrt intake-kontroll utsettes"
status: Foreslått
date: 2026-08-09
---

# ADR 0002: Arkivering av surveys er visningsmetadata — dashboard-styrt intake-kontroll utsettes

- **Status:** Foreslått
- **Dato:** 2026-08-09
- **Berører:** #339 (arkivering, spec), #394/#395 (implementasjon), #338 (Survey Builder UI), #337 (409-synliggjøring/lineage), #253 (tomme surveys)

## Kontekst

Team har fått mange surveys i prod, og det er vanskelig å se hvilke som er aktive. Det åpenbare svaret — «marker dem som arkivert i dashboardet» — reiser et større arkitekturspørsmål: bør dashboardet også kunne *stoppe* en survey, slik klassiske survey-verktøy kan?

To arkitekturfakta avgjør saken:

1. **Widgeten gjør null nettverkskall selv.** `@navikt/lumi-survey` definerer bare et `LumiSurveyTransport`-interface; konsumentteamets egen backend gjør token-utveksling og POST-er til lumi-api. Det finnes ingen config-henting, ingen bootstrap, ingen polling. En dashboard-styrt kill-switch ville krevd (a) ny widget-kapabilitet, (b) et nytt publikt lese-endepunkt, og (c) at hver konsuments backend proxyer config-hentingen. Det er en arkitekturendring som berører alle konsumentteam — ikke en feature.
2. **Survey-listen er avledet, ikke et register.** Dashboardet kjenner en survey via `DISTINCT feedback_json->>'surveyId'` fra innsendte data. `survey_definitions`-tabellen er en immutability-guard i submission-stien og leses ikke av dashboardet. Det finnes altså ikke noe sted en «stopp»-beslutning kunne bodd som widgeten ville sett.

Uten intake-kontroll er faren at arkivering *misforstås* som stopp: en PO arkiverer en survey og tror datainnsamlingen er avsluttet, mens frontendene fortsetter å sende inn.

## Beslutning

1. **Arkivering er per-team visningsmetadata.** Et `archived_at`-felt i en ny `survey_metadata`-tabell (team + surveyId unik), satt fra dashboardet, som kun påvirker hva dashboardet viser. Data, stats, eksport og intake er uberørt. Design og produktvalg er specet i #339.

2. **Misforståelsesfaren håndteres med ærlighet, ikke mekanikk.** Arkiver-dialogen sier eksplisitt at arkivering ikke stopper innsendinger, og en arkivert survey som fortsatt mottar data merkes med badge (utledet av `lastSubmissionAt > archived_at` — ingen nye flagg eller jobber).

3. **Dashboard-styrt intake-kontroll utsettes bevisst.** Vi bygger den ikke nå, og vi lover den ikke. Kostnaden (punkt 1 i kontekst: widget-kapabilitet + publikt endepunkt + endring i hver konsuments backend) står ikke i forhold til gevinsten så lenge det reelle behovet er *oversikt*, ikke *fjernstyring*. Beslutningen revurderes hvis konsumentteam faktisk etterspør fjernstopp — ikke før.

4. **Døra holdes åpen strukturelt.** `survey_definitions.source` har allerede enum-verdiene `'dashboard'` og `'import'` reservert, og `survey_metadata`-tabellen er frøet til survey-registeret som Survey Builder (#338) uansett trenger. Skulle intake-kontroll bli aktuelt, bygges det på dette registeret — det krever ingen riving av arkiveringsløsningen.

## Konsekvenser

**Positivt**

- Arkivering leveres som to små slices (#394, #395) uten å røre widget, datakontrakt eller konsumentteam.
- Survey-metadata får endelig et hjem på dashboard-siden — det delte åpne spørsmålet fra #338/#339 om hvor survey-identitet bor, er besvart.
- Ingen falske løfter: UI-et sier eksplisitt hva arkivering *ikke* gjør.

**Negativt / kostnad**

- Lumi kan fortsatt ikke stoppe en survey sentralt — avvikling krever fortsatt endring i konsumentens frontend. Dette er en reell begrensning vi aksepterer og dokumenterer.
- «Mottar fortsatt innsendinger»-badgen er et symptomvarsel, ikke en løsning; oppfølgingen (be teamet fjerne widgeten) er manuell.
- To «survey finnes»-begreper består (avledet liste + definisjonstabell), nå med en tredje tabell ved siden av. Konsolidering til ett register er bevisst skjøvet til #338.

## Vurderte alternativer

- **A. Kun arkivert-flagg, uten register-tanke.** Forkastet: løser dagens smerte, men etterlater #338 med samme «hvor bor metadata»-spørsmål og gir ingen vei videre.
- **B. Full dashboard-styring nå (widget henter config).** Forkastet: arkitekturendring som berører alle konsumentteam, for et behov (fjernstopp) ingen har etterspurt. Scope-eksplosjon i forhold til problemet «vanskelig å se hvilke som er aktive».
- **C. (valgt) Visningsmetadata + ærlig UI + strukturell åpen dør.** Løser oversiktsproblemet nå, koster nesten ingenting, og maler oss ikke inn i et hjørne.

## Oppfølging

- [ ] #394: arkiver/gjenopprett ende-til-ende.
- [ ] #395: recency-signal + badge.
- [ ] Vurder oversiktsside (tabell med alle surveys + recency) som v2 hvis oppryddingsflyten i FilterBar/Toolbar viser seg tungvint — eller når #338 uansett trenger en administrasjonsflate.
- [ ] Ved ev. fremtidig etterspørsel etter fjernstopp: design intake-kontroll oppå survey-registeret (`source='dashboard'`-sporet), som egen ADR.
