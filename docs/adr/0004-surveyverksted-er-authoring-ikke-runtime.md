---
title: "ADR 0004: Surveyverkstedet lagrer authoring-revisjoner, ikke runtime-konfigurasjon"
status: Akseptert
date: 2026-08-16
---

# ADR 0004: Surveyverkstedet lagrer authoring-revisjoner, ikke runtime-konfigurasjon

- **Status:** Akseptert
- **Dato:** 2026-08-16
- **Berører:** #338 (Surveyverksted), ADR 0002, ADR 0003

## Kontekst

Designere og produktfolk trenger å kunne arbeide med en survey over flere
økter, prøve den i den ekte widgeten og dele et stabilt resultat med en
utvikler. En ren kodegenerator uten lagring mister arbeidet mellom økter.

Samtidig er Lumi i dag survey-as-code: konsumentappen eier
produksjonskonfigurasjonen, widgeten gjør ingen config-henting, og
`survey_definitions` er en immutable kompatibilitetsguard for innsendinger.
Hvis dashboardet blir runtime-kilde, innfører vi ny tilgjengelighet, caching,
signering, rollback, klientversjonering og zero-trust-proxying hos alle
konsumenter.

## Beslutning

1. **Surveyverkstedet er et team-scopet authoring-domene.** En
   `AuthoringProject` har én muterbar draft med optimistic locking. Draften
   lagres separat fra `survey_definitions` og `survey_metadata`.
2. **Draften er ikke en statusmaskin.** Den kan være under arbeid og autosaves.
   UI-et bruker ikke «publisert», «live» eller «overlevert», fordi ingen av
   disse tilstandene kan håndheves av Lumi.
3. **En eksplisitt authoring-revisjon er immutable.** Revisjoner opprettes fra
   en gyldig, lagret draft. En revisjonslenke kan deles i GitHub,
   Trello eller Jira og viser preview, diff og deterministisk kodeeksport.
4. **Produksjon forblir survey-as-code.** Utvikleren tar den eksporterte
   `SurveyDocumentV1` inn i konsumentappen og deployer på vanlig måte. Widgeten
   får ingen nye nettverkskall.
5. **Preview bruker ekte widget med inert transport.** Preview kan aldri sende
   data. Lokal full-chain-demo er fortsatt stedet for å teste faktisk
   innsending og dashboardkjeden.
6. **Miljøene synkroniseres ikke.** Produksjon er kanonisk authoring-store;
   utviklingsmiljøets drafts er disposable. Delbare produksjonsrevisjoner er
   teamautoriserte.
7. **Authoring og analytics har ulike hasher.** `documentHash` identifiserer
   hele authoring-revisjonen. Dagens
   `definitionHash` beskriver bare svarenes analytiske struktur og endres ikke
   av page-titler eller layout.

## Første vertikale snitt

- opprette og liste team-scopede prosjekter
- redigere et `SurveyDocumentV1` med pages og spørsmål
- autosave med versjonskonfliktvern og gjenåpning
- validere gjennom widgetens offentlige `validateSurveyDocumentV1`
- åpne en separat, inert forhåndsvisning i den ekte `LumiSurveyDock`

## Andre vertikale snitt

- opprette en revisjon som et atomisk snapshot av lagret draft-versjon
- validere `SurveyDocumentV1` og beregne dokument- og definisjonshash i API-et
- blokkere endret analytisk struktur under samme `surveyId`
- åpne teamautorisert revisjonslenke med auditdata, diff og inert preview
- eksportere deterministisk JSON, TypeScript og Markdown-lenke

Revisjoner lagres fortsatt utenfor `survey_definitions`; første reelle
innsending registrerer fremdeles produksjonens analytiske definisjon.

## Konsekvenser

### Positivt

- Arbeid kan fortsette over flere økter uten at draften blir produksjonssannhet.
- En designer kan samarbeide før en utvikler tar eierskap til deployen.
- Widget- og submission-arkitekturen er uendret.
- En senere full runtime-tjeneste kan vurderes separat hvis det oppstår et
  dokumentert behov for deploy-uavhengig publisering, kill-switch eller
  målretting.

### Kostnad

- «Eksportert» betyr ikke «deployet»; handoff må fortsatt følges opp i teamets
  valgte oppgaveverktøy.
- Draft, authoring-revisjon og analytics-definisjon er tre bevisst forskjellige
  begreper som må navngis presist.
- Produksjonsauthoring krever egen lagring, teamautorisasjon, audit og
  revisjonshåndtering selv om runtime forblir statisk.

## Forkastede alternativer

### Bruk-og-kast-playground

Forkastet fordi reelt designarbeid skjer i flere korte økter og ofte
finjusteres sammen med produktleder senere.

### Dashboardet som runtime-kilde fra dag én

Forkastet fordi det snur eierskapsmodellen og krever et distribuert
kontrollplan med vesentlig større sikkerhets- og driftskostnad. Det behovet er
ikke dokumentert nå.

### Egen «overlevert»-status

Forkastet fordi Lumi ikke kjenner tilstanden i GitHub, Trello, Jira eller
konsumentens deploy. Den delbare immutable revisjonen er artefaktet; statusen
bor i teamets faktiske arbeidsflyt.
