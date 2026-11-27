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
   Strukturendringer kan deles under samme `surveyId`; en delt revisjon betyr
   ikke at surveyen er tatt i bruk. Kompatibilitetskontrollen for innsamlede
   svar ligger fortsatt i submission-domenet.
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
   surveydokumentet i authoring-revisjonen (presisert 2026-11-23, se
   [Visningsmåte](#visningsmate)). Dagens
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
- tillate endret analytisk struktur under samme `surveyId` uten å endre
  tidligere revisjoner (justert 2026-09-07)
- åpne teamautorisert revisjonslenke med auditdata, diff og inert preview
- eksportere deterministisk JSON, TypeScript og Markdown-lenke

Revisjoner lagres fortsatt utenfor `survey_definitions`; første reelle
innsending registrerer fremdeles produksjonens analytiske definisjon.

## Visningsmåte (lagt til 2026-11-23) {#visningsmate}

Den som lager surveyen, velger om den skal vises som flytende panel eller ved
innholdet, og kan beskrive plasseringen i appen (#805, #806).

- Visningsmåten og plasseringsbeskrivelsen er authoring-metadata, som navn og
  `surveyId`. De ligger i kolonnene `display_mode` og `placement_note` på
  prosjektet og kopieres til revisjonen når den opprettes.
- Plasseringsbeskrivelsen hører til visning ved innholdet. API-et lagrer ingen
  beskrivelse for flytende panel.
- De er ikke en del av `SurveyDocumentV1` og inngår verken i `documentHash`
  eller `definitionHash`. To revisjoner med samme dokument og ulik visning har
  samme `documentHash`.
- En lagring som bare endrer visningen, øker `draft_version`. En revisjon er
  knyttet til en lagret draft-versjon, så endringen kan deles som en ny
  revisjon.
- Valget er en beskjed til utvikleren. Produksjon er fortsatt survey-as-code,
  og appen velger komponent og plassering i koden.
- Prosjekter og revisjoner fra før valget fantes, er flytende panel.
- Forhåndsvisningen bruker komponenten som hører til valget, `LumiSurveyDock`
  eller `LumiSurveyInline`, med inert transport som før. Ved innholdet setter
  den de samme `context.tags` som innbyggingseksempelet på versjonssiden.
- Et API fra før V29 kjenner ikke kolonnene. Kolonnene på revisjonen har
  derfor ingen standardverdi, og en trigger kopierer prosjektets verdier når en
  revisjon opprettes uten dem. Valget fryses dermed riktig også mens gamle og
  nye instanser kjører samtidig, og etter en tilbakerulling av API-et. Er
  utkastet lagret på nytt mens revisjonen opprettes, avviser triggeren den.
- API-et må settes i produksjon før dashboardet. Et dashboard uten feltet kan
  lagre mot et nytt API, som da beholder den lagrede visningen.
- Mens dashboardet rulles ut, kan en server fra før valget svare på en
  lagring. Den utelater visningen i kallet til API-et, som da beholder den
  lagrede. Editoren sjekker derfor visningen i svaret, prøver igjen og sier fra
  når valget ikke ble lagret. En side som var åpen før valget fantes, kan
  fortsatt lagre utkastet.
- Svarer et API fra før V29 når et utkast åpnes, vet ikke editoren hvilken
  visning utkastet har. Den sender da ingen visning, og valget kan ikke endres
  før siden er lastet på nytt, heller ikke når et senere svar sier hvilken
  visning som er lagret.
- Svarer et API fra før V29 på en lagring, er visningen den som var lagret
  fra før. Editoren regner med den, og sier fra når et nytt valg ikke ble
  lagret. Svarer det når en revisjon eller forhåndsvisningen i egen fane
  åpnes, sier siden at visningen ikke kunne hentes, og versjonssiden viser
  ikke eksempelet for appen.

Egne kolonner er valgt framfor et metadataobjekt i `draft`-kolonnen fordi
`draft` er selve `SurveyDocumentV1`, og fordi databasen da kan avvise ukjente
verdier.

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
