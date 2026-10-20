---
title: "ADR 0007: Teameid BigQuery-eksport"
status: Akseptert
date: 2026-10-20
---

# ADR 0007: Teameid BigQuery-eksport

- **Status:** Akseptert
- **Dato:** 2026-10-20
- **Erstatter:** [ADR 0006](./0006-teamavgrensede-analyseprodukter.md)
- **Berører:** #482

## Kontekst

Team som bruker Lumi, vil analysere svarene sine i BigQuery, dele dem på
Datamarkedsplassen og bruke dem i Metabase og datafortellinger. Team iSyfo gjør
det allerede: en Airflow-jobb i Knada leser Lumis produksjonsdatabase hver natt
med `EXTERNAL_QUERY`, via rollen `esyfo-analyse`, og publiserer fortellingen
«syfo – kartleggingsspørsmål». Rollen kan lese alle tabellene i `public`, også
fritekst, URL og debug. Spørringene finner svarene etter posisjon i JSON-en, så de
gir feil tall når en survey endres.

ADR 0006 valgte analyseprodukter som Lumi eier: et kontrollplan med utkast,
låste releaser, flythasher og et eget BigQuery-datasett per produkt i et
Lumi-prosjekt. Etter to måneder er kontrollplanet bygget, men ingen data er
levert. Gate B venter på 14 avklaringer med NADA, og flere av dem gjelder ting
plattformen ikke tilbyr: livsløp på Datamarkedsplassen som kan styres
programmatisk, en binder som NADA eier, og at Lumi eier prosjektet mens et annet
team er dataeier. Modellen ville også ha skjult svarverdier uten pinnet flyt, som
er alle svar fra før slutten av august 2026. iSyfo kunne derfor ikke ha erstattet
fortellingen sin.

Plattformen har i mellomtiden vist seg å passe en enklere modell:

- Et dataprodukt består av tabeller i eierteamets eget GCP-prosjekt. Eieren
  godkjenner tilgang, og produsenten beskriver delingen i Behandlingskatalogen.
- Metabase gir bare tilgang til personer som har fått tilgang hver for seg.
  Hvert tilgangsbegrenset datasett blir en egen database, og join mellom slike
  datasett går ikke.
- Teamene har det juridiske ansvaret for egne surveyer. De bruker sin egen kopi
  av etterlevelsesmalen E726 og lager PVK ved behov.

## Beslutning

### Lumi skriver til et datasett i teamets eget prosjekt

Teamet lager et datasett i sitt eget GCP-prosjekt og gir Lumis tjenestekonto
rollen BigQuery Data Editor på dette datasettet. Datasettet må ligge i
`europe-north1` og ha labelen `lumi-team` med teamets navn. Dashboardet lager
SQL-en som gjør dette.

Før Lumi lagrer et eksportmål og før hver kjøring sjekker Lumi at

- prosjektet er teamets prosjekt i Nais, slått opp i Nais API
- datasettet finnes, ligger i `europe-north1` og har teamets label
- tabellene Lumi skal skrive, enten ikke finnes eller har Lumis egen label
  `lumi-eksport`

Ved lagring lager og sletter Lumi i tillegg en kortlivet tabell for å bekrefte
skrivetilgangen. Bare teamet selv kan sette labelen på sitt datasett. Et team kan
derfor ikke få Lumi til å skrive inn i et annet teams datasett. Data Editor gir
ikke rett til å endre tilgang, så Lumi kan aldri gi personer tilgang til dataene.

Hvert team har ett eksportmål. Lumi har ingen tilgang til resten av prosjektet.

### Tabeller

Lumi skriver tre tabeller:

- `svar`: én rad per svarverdi på vurderings- og valgspørsmål. Flervalg gir én
  rad per valgt alternativ.
- `innsendinger`: én rad per innsending, til totaler og nevnere.
- `fritekst`: fritekstsvar, bare når teamet har slått det på.

Hver rad har spørsmålsteksten og svarteksten, fordi Metabase ikke kan joine
tilgangsbegrensede datasett. Teksten er den nyeste for spørsmålet eller
alternativet, slik dashboardet viser. Tidspunktet er Lumis mottakstid, og datoen
er norsk tid, som i dashboardet. Kolonnene er beskrevet i
[BigQuery og Metabase](../dashboard/bigquery.md#kolonner) og i skjemaet i BigQuery.

`innsending_id` er en HMAC av Lumis interne ID med en nøkkel per eksportmål.
Den er lik i alle tabellene og mellom kjøringer, men intern ID forlater ikke
Lumi. Nøkkelen ligger i Lumis database og slettes når eksporten stoppes.

Segmenteringstagsene appen sender, er med som et JSON-objekt i kolonnen
`kontekst`, sammen med enhetstypen. Følgende er aldri med: URL, pathname, user
agent, skjerm- og vindusstørrelse, debug, tags teamet har satt i dashboardet og
datospørsmål. Kolonner kan bare legges til. En endring
som ville ødelagt eksisterende spørringer, får et nytt tabellnavn.

### Fritekst er et valg teamet tar

Fritekst er av som standard. Slår teamet det på, havner tekstene i tabellen
`fritekst`, med de samme maskeringsreglene som dashboardet bruker når det leser
tekst. Maskeringen fanger ikke navn. Tabellen er egen, slik at teamet kan dele
`svar` uten å dele tekstene. Slår teamet fritekst av, sletter Lumi tabellen.

### Kjøring

Lumi API kjører eksporten. Hver replika sjekker hvert 30. sekund om noe skal
kjøres, og en advisory lock i Postgres sørger for at bare én replika eksporterer
om gangen. Hvert eksportmål kjøres hver natt etter kl. 01 norsk tid, som er
utenfor vedlikeholdsvinduet til Cloud SQL, og når teamet velger
**Oppdater nå**. En feilet kjøring prøves igjen etter én time, og ventetiden
dobles for hver ny feil, opp til ett døgn.

En kjøring leser teamets svar fra de siste 12 månedene i ett konsistent
øyeblikksbilde. Lumi bruker samme grense som slettejobben, og tar ikke med svar
slettejobben ennå ikke har rukket å slette. Radene strømmes til BigQuery med
resumable upload, og hver tabell erstattes med `WRITE_TRUNCATE` når lastejobben er
ferdig. Feiler en kjøring, står forrige versjon av tabellene urørt.

Hver vellykket kjøring setter utløpstid på tabellene sju dager fram. Stopper
eksporten av en eller annen grunn, forsvinner kopiene av seg selv.

Lumi kaller BigQuery sitt REST-API med Ktor og henter token fra metadataserveren
i GKE, slik workload identity i Nais er satt opp. Lastejobbene kjører i Lumis eget
teamprosjekt, der manifestet gir rollen `roles/bigquery.jobUser`.

### Sletting

Svar som slettes i dashboardet eller blir eldre enn 12 måneder, forsvinner fra
BigQuery ved neste kjøring, senest neste natt. Teamet kan velge **Oppdater nå**
for å fjerne dem med en gang. BigQuery tar vare på slettede rader i 48 timer i
datasett laget med SQL-en fra dashboardet, og Google i sju dager til. Kopier
teamet lager selv, har teamet ansvaret for.

### Ansvar og tilgang

Teamet har ansvaret for kopien i sitt prosjekt: hvem som får tilgang på
Datamarkedsplassen, hva dataene brukes til, og at behandlingen i
Behandlingskatalogen dekker delingen. Lumi har ansvaret for at kopien er riktig
og blir oppdatert. Dette følger ansvarsmodellen der teamene har det juridiske
ansvaret for egne surveyer.

### Pilot

I produksjon er eksporten først åpen for team eSyfo og iSyfo
(`LUMI_BIGQUERY_EXPORT_PILOT_TEAMS`). Andre team ser at eksporten er i pilot.

1. eSyfo setter opp eksporten for `bro-frontend` i sitt prosjekt.
2. iSyfo setter opp eksporten for `syfomodiaperson` i sitt prosjekt og søker om
   tilgang til eSyfos tabell `svar` på Datamarkedsplassen.
3. iSyfo bytter spørringene i `isyfo-analyse` til tabellene og kjører gammel og ny
   versjon side om side i to uker. Antall svar per uke, fordeling og snitt skal
   være like.
4. Når iSyfo har flyttet, slettes BigQuery-tilkoblingen `lumi`, og rollen
   `esyfo-analyse` fjernes med en egen migrering.

Pilotlisten fjernes når piloten er godkjent.

### Analyseproduktene fra ADR 0006

Siden for analyseprodukter får en merknad om at den er erstattet, og lenken fra
eksportsiden fjernes. API, tabeller og flythash ved innsending blir stående.
Flythashen kan senere gi en kolonne som viser om respondenten fikk se et
spørsmål. Hva som skal fjernes, avgjøres etter piloten.

## Konsekvenser

### Positivt

- Teamene får data i BigQuery uten at Lumi trenger avklaringer eller ny
  plattformfunksjonalitet fra NADA.
- Dataproduktet ligger hos teamet som har ansvaret for dataene, og teamet
  godkjenner tilgang selv.
- iSyfo beholder historikken og kan erstatte spørringene mot prod-databasen.
- Tabellene kan brukes i Metabase uten SQL og uten join.
- Den brede databaserollen `esyfo-analyse` kan fjernes.

### Negativt og residualrisiko

- Hvert team må kjøre én SQL-setning i sitt prosjekt og registrere dataproduktet
  på Datamarkedsplassen selv.
- Lumis tjenestekonto får skrivetilgang til et datasett i mange prosjekter. En
  feil i Lumi kan overskrive Lumis tabeller der, men ikke andre tabeller eller
  tilganger.
- Sletting i BigQuery skjer ved neste kjøring, ikke umiddelbart.
- Tidspunkt, app og svar kan sammen gjøre det mulig å kjenne igjen hvem som
  svarte i små grupper. Tabellene skal derfor registreres som personopplysninger.
- Lumi skriver mot BigQuery sitt REST-API selv. Protokollen for resumable upload
  og lastejobber er dekket av tester mot et simulert API, men må verifiseres i dev.

## Vurderte alternativer

### Fortsette med ADR 0006

Forkastet. Modellen er avhengig av plattformfunksjoner som ikke finnes, plasserer
dataene i et prosjekt teamet ikke eier og skjuler historikken.

### Datastream fra Lumis database

Forkastet. Datastream kopierer rådata med fritekst til BigQuery, krever logisk
replikering i prod-databasen og views per team. Det er mer enn noen titusen rader
trenger.

### Planlagt federated query

Forkastet. JSON-parsingen måtte skrives på nytt i SQL, og spørringene ville
ligget i GCP-konsollet uten code review.

### API som teamene henter fra

Forkastet. Hvert team måtte skrevet og driftet sin egen jobb.

### Google sitt klientbibliotek for BigQuery

Forkastet. Biblioteket drar med seg gRPC, Arrow og Storage API, som eksporten
ikke bruker. Fire REST-kall dekker behovet.

## Kilder

- [NADA: registrere dataprodukt](https://docs.knada.io/dataprodukter/dele/dataprodukt/)
- [NADA: tilgangsstyring](https://docs.knada.io/dataprodukter/tilgangsstyring/)
- [NADA: Metabase](https://docs.knada.io/analyse/metabase/)
- [NADA: datafortellinger](https://docs.knada.io/analyse/datafortellinger/)
- [NADA: spilleregler](https://docs.knada.io/juridisk/spilleregler/)
- [Nais: tilganger til GCP-ressurser](https://doc.nais.io/workloads/application/reference/application-spec/#gcppermissions)
- [Google Cloud: tilgang til datasett med GRANT](https://cloud.google.com/bigquery/docs/control-access-to-resources-iam)
- [Google Cloud: laste JSON-data](https://cloud.google.com/bigquery/docs/loading-data-cloud-storage-json)
- [Runbook for BigQuery-eksporten](https://github.com/navikt/lumi/blob/main/apps/lumi-api/docs/runbooks/bigquery-export.md)
