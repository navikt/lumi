---
title: "ADR 0007: BigQuery-eksport til teamets eget prosjekt"
status: Akseptert
date: 2026-10-20
---

# ADR 0007: BigQuery-eksport til teamets eget prosjekt

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
fritekst, URL og feilsøkingsdata (debug). Spørringene finner svarene etter
posisjon i JSON-en, så de gir feil tall når en survey endres.

ADR 0006 valgte analyseprodukter som Lumi skulle styre: hvert produkt skulle ha
utkast og godkjente versjoner, og dataene skulle ligge i et eget
BigQuery-datasett per produkt i et Lumi-prosjekt. Etter to måneder er denne
styringen bygget i Lumi, men ingen data er levert. Arbeidet venter på svar fra
NADA på 14 spørsmål, og flere av dem gjelder ting plattformen ikke tilbyr: å
styre dataprodukter på Datamarkedsplassen programmatisk, at NADA autoriserer
views på tvers av datasett, og at prosjektet hører til Lumi mens et annet team
er dataeier. Modellen ville også ha skjult alle svar fra før slutten av august
2026, fordi de ble lagret uten flythash. iSyfo kunne derfor ikke ha erstattet
fortellingen sin.

Plattformen har i mellomtiden vist seg å passe en enklere modell:

- Et dataprodukt består av tabeller eller views i GCP-prosjektet til teamet som
  har ansvaret for dataene. Teamet godkjenner tilgang og beskriver delingen i
  Behandlingskatalogen.
- Metabase gir bare tilgang til personer som har fått tilgang hver for seg.
  Hvert tilgangsbegrenset datasett blir en egen database, og Metabase kan ikke
  koble sammen slike datasett.
- Nav er behandlingsansvarlig, og på vegne av Nav har teamene ansvaret for egne
  surveyer. De bruker sin egen kopi av etterlevelsesmalen E726 og lager PVK ved
  behov.

## Beslutning

### Lumi skriver til et datasett i teamets eget prosjekt

Teamet lager et datasett i sitt eget GCP-prosjekt og gir Lumis tjenestekonto
rollen BigQuery Data Editor på dette datasettet. Datasettet må ligge i
`europe-north1`, ha labelen `lumi-team` med teamets navn og ha
`max_time_travel_hours` på høyst 48. Dashboardet lager SQL-en som gjør dette.
SQL-en kan kjøres på nytt og retter da tilgangen, labelen og time travel.

Rollen gjelder hele datasettet, så datasettet skal bare brukes til Lumi. Lumi
godtar ikke et datasett med tabeller som Lumi ikke har laget, men views går
fint.

Før Lumi lagrer eksportmålet, altså prosjektet og datasettet teamet har valgt,
sjekker Lumi at

- prosjektet er teamets prosjekt i Nais, slått opp i Nais API
- Lumi kan kjøre jobber i sitt eget prosjekt
- datasettet finnes, ligger i `europe-north1` og har teamets label
- `max_time_travel_hours` er høyst 48
- datasettet ikke har andre tabeller enn Lumis egne, bortsett fra views

Før hver kjøring sjekker Lumi prosjektet, jobbtilgangen, regionen, labelen og
time travel igjen, og at tabellene Lumi skal skrive, enten ikke finnes eller har labelene
`lumi-eksport` og `lumi-team` for teamet. Kan Lumi ikke gjøre en sjekk, for
eksempel fordi Nais API ikke svarer, skriver Lumi ingenting.

Ved lagring lager og sletter Lumi i tillegg en kortlivet tabell for å bekrefte
skrivetilgangen. Bare teamet selv kan sette labelen på sitt datasett. Et team kan
derfor ikke få Lumi til å skrive inn i et annet teams datasett. Data Editor gir
ikke rett til å endre tilgang, så Lumi kan ikke gi noen tilgang til dataene.

Hvert team har ett eksportmål. Lumi har ingen tilgang til resten av prosjektet.

### Tabeller

Lumi skriver tre tabeller:

- `svar`: én rad per svarverdi på vurderings- og valgspørsmål. Flervalg gir én
  rad per valgt alternativ.
- `innsendinger`: én rad per innsending, til å telle svar og regne ut andeler.
- `fritekst`: fritekstsvar, bare når fritekst er åpnet for teamet og teamet har
  slått det på.

Hver rad har spørsmålsteksten og svarteksten, fordi Metabase ikke kan koble
sammen tilgangsbegrensede datasett. Teksten er den nyeste for spørsmålet eller
alternativet, slik dashboardet viser den, så en tekstendring endrer også eldre
rader. Tidspunktet er Lumis mottakstid i UTC, rundet ned til hel time, som i
#482. Det holder for analyse og gjør det vanskeligere å koble svarene med andre
logger.
Datoen er i norsk tid, som i dashboardet. Kolonnene er beskrevet i
[BigQuery og Metabase](../dashboard/bigquery.md#kolonner) og i skjemaet i
BigQuery.

`innsending_id` er en HMAC av Lumis interne ID med en nøkkel per eksportmål. Den
er lik i alle tabellene og mellom kjøringer, og den interne ID-en forlater ikke
Lumi. Nøkkelen ligger i Lumis database og slettes når eksporten stoppes. Teamet
får en ny nøkkel når det bytter prosjekt eller datasett, og når det setter opp
eksporten igjen. Da får `innsending_id` nye verdier. Team eSyfo, som drifter
Lumi, har nøkkelen og kan i prinsippet koble `innsending_id` tilbake til svaret
i Lumi. Det er pseudonymisering, ikke anonymisering.

Enhetstypen har en egen kolonne med tre faste verdier. Taggene appen sender med,
er ikke med. Slik #482 slo fast, er en tagg ikke trygg bare fordi den har få
verdier, og en tagg kan bare bli en kolonne gjennom et register der noen har
vurdert den. Kolonner kan legges til senere uten å ødelegge spørringer.

`survey_id`, `sporsmal_id` og `valg_id` maskeres med de samme mønstrene som
fritekst. Et valgt alternativ er bare med når det står i listen over
alternativer som fulgte med svaret. Mangler listen, er ID-en med slik den ble
sendt, maskert. Dette er aldri med: URL, pathname, nettleser (user agent),
skjerm- og vindusstørrelse, feilsøkingsdata (debug), tagger teamet har satt i
dashboardet og svar på datospørsmål.

Lumi kan legge til kolonner, men endrer eller fjerner dem ikke. En endring som
ville ødelagt spørringer, får et nytt tabellnavn.

### Fritekst åpnes per team

Fritekst kan inneholde navn og helseopplysninger. Lumi åpner fritekst for ett og
ett team (`LUMI_BIGQUERY_EXPORT_FREE_TEXT_TEAMS`), og teamet må ha en PVK som
dekker fritekst i BigQuery. I produksjon har ingen team fått det åpnet ennå.
Dashboardet viser ikke valget for team som ikke har fått det åpnet. Stenger Lumi
fritekst for et team igjen, sletter neste kjøring tabellen `fritekst`.

Fritekst er av som standard også for team som har fått det åpnet. Slår teamet
det på, havner tekstene i tabellen `fritekst`, med de samme maskeringsreglene
som dashboardet bruker når det leser tekst. Maskeringen fanger ikke navn.
Tabellen er egen, slik at teamet kan dele views av `svar` uten å dele tekstene,
og den skal ikke deles utenfor teamet. Slår teamet fritekst av, sletter Lumi tabellen.

### Kjøring

Lumi API kjører eksporten. Hver replika sjekker hvert 30. sekund om noe skal
kjøres, og en advisory lock i Postgres sørger for at bare én replika eksporterer
om gangen. Hvert eksportmål kjøres hver natt etter kl. 01 norsk tid, som er
utenfor vedlikeholdsvinduet til Cloud SQL. Lumi starter også en kjøring når
teamet velger **Oppdater tabellene nå** eller lagrer endringer, og når noen
sletter svar i dashboardet. Lumi kjører høyst én gang per fem minutter per team,
også når teamet bytter datasett eller stopper eksporten og setter den opp igjen.
En feilet kjøring prøves igjen etter én time, og ventetiden dobles for hver ny
feil, opp til ett døgn.

En kjøring leser teamets svar fra de siste tolv månedene i ett konsistent
øyeblikksbilde. Lumi bruker samme grense som slettejobben, og tar ikke med svar
slettejobben ennå ikke har rukket å slette. Radene strømmes til BigQuery med
resumable upload.

Manglende tabeller lages først, med labeler og utløpstid. Tabellene oppdateres
deretter én om gangen, den mest følsomme først: `fritekst`, `innsendinger` og
`svar`. En kjøring som feiler halvveis, har da allerede fjernet slettet
fritekst. Hver tabell erstattes i ett steg med `WRITE_TRUNCATE` når lastejobben
er ferdig, men kjøringen som helhet er ikke atomisk. Feiler den underveis, kan
tabellene komme fra ulike kjøringer. Kolonnen `oppdatert_tidspunkt` viser når
Lumi skrev tabellen, og guiden ber konsumentene sjekke den. Er det ingen rader
til en tabell, tømmer Lumi den på stedet med `TRUNCATE TABLE`. Tabellen og
tilgangene på den blir stående. Lumi sletter ikke `svar` og `innsendinger` ved
vanlige kjøringer, bare `fritekst` når fritekst er av eller ikke åpnet for
teamet. Får ikke Lumi slettet `fritekst`, feiler kjøringen.

En jobb i BigQuery kan fullføre etter at Lumi har gitt den opp, for eksempel
når svaret fra BigQuery forsvinner. Lumi lagrer derfor ID-en til hver jobb som
kan erstatte en tabell, før jobben startes, og fjerner den når Lumi har sett
jobben bli ferdig. Neste kjøring venter til BigQuery sier at de lagrede jobbene
er ferdige, så en gammel jobb ikke kan overskrive nyere data eller hente tilbake
slettede svar.

Når teamet stopper eksporten, starter ingen nye kjøringer, og innstillingene kan
ikke endres. Lumi sletter tabellene og innstillingene mens Lumi holder låsen, og
først når de lagrede jobbene er ferdige. Pågår en kjøring, gjør Lumi det når
kjøringen er ferdig. Slik kan verken en kjøring eller en sen jobb skrive
tabellene tilbake etter at teamet har stoppet. Har ikke Lumi lenger tilgang til
datasettet, eller svarer ikke BigQuery på to døgn, gir Lumi opp å slette
tabellene. De forsvinner da av seg selv innen sju dager.

Hver gang Lumi skriver en tabell, settes utløpstiden sju dager fram. Stopper
eksporten av en eller annen grunn, forsvinner kopiene av seg selv.

Lumi kaller BigQuerys REST-API med Ktor og henter token fra metadataserveren i
GKE, slik workload identity i Nais er satt opp. Lastejobbene kjører i Lumis eget
teamprosjekt, der manifestet gir rollen `roles/bigquery.jobUser`.

### Sletting

Når noen sletter svar i dashboardet, starter Lumi en ny kjøring automatisk.
Svaret forsvinner fra BigQuery etter noen minutter når kjøringen lykkes. Feiler
kjøringen, prøver Lumi igjen som beskrevet over. Svar som blir eldre enn tolv
måneder, forsvinner ved neste vellykkede kjøring. BigQuery tar vare på slettede
rader i 48 timer (time travel), og Google i sju dager til (fail-safe). Kopier
teamet lager selv, har teamet ansvaret for.

### Ansvar og tilgang

Nav er behandlingsansvarlig. På vegne av Nav har teamet ansvaret for kopien i
sitt prosjekt: hvem som får tilgang på Datamarkedsplassen, hva dataene brukes
til, og at behandlingen i Behandlingskatalogen dekker delingen. Lumi oppdaterer
kopien etter beste evne. Team eSyfo drifter Lumi uten avtalt tjenestenivå
(SLA). Dette følger ansvarsmodellen der teamene har det juridiske ansvaret for
egne surveyer.

Teamet deler views som er filtrert på app og survey, ikke Lumis tabeller
direkte. Tilgang på Datamarkedsplassen gis per tabell eller view, og
Datamarkedsplassen autoriserer automatisk et view som bygger på tabeller i samme
datasett. Tilgang kan gis til en bruker, en gruppe eller en service account.

### Pilot

Eksporten prøves først i dev mot ekte BigQuery, slik runbooken beskriver.
Deretter slås den på i produksjon (`LUMI_BIGQUERY_EXPORT_ENABLED`), først for
team eSyfo og iSyfo (`LUMI_BIGQUERY_EXPORT_PILOT_TEAMS`). Andre team ser at
eksporten er i pilot. Fritekst er ikke åpnet for noen av dem.

1. eSyfo setter opp eksporten i sitt prosjekt og deler et view med bare
   `bro-frontend` og surveyen `bro-kartleggingssporsmal` på Datamarkedsplassen.
2. iSyfo setter opp eksporten for `syfomodiaperson` i sitt prosjekt og søker om
   tilgang til eSyfos view.
3. iSyfo bytter spørringene i `isyfo-analyse` til tabellene og viewet og kjører
   gammel og ny versjon side om side i to uker. Tallene sammenlignes uke for
   uke, og alle forskjeller skal være forklart. Noen forskjeller er ventet.
   Dagens spørringer finner svarene etter posisjon (`answers->0`), og
   posisjonen forskyves når et spørsmål hoppes over. Den gamle spørringen for
   `bro-frontend` filtrerer ikke på survey, og eksporten kutter ved nøyaktig
   tolv måneder.
4. Når iSyfo har flyttet, slettes BigQuery-tilkoblingen `lumi`, og rollen
   `esyfo-analyse` fjernes med en egen migrering.

Pilotlisten fjernes når piloten er godkjent. Før det tas disse avgjørelsene på
nytt:

- om tabellene fortsatt skal utløpe sju dager etter at Lumi sist skrev dem,
  siden Datamarkedsplassen fjerner et datasett når tabellen har manglet i sju
  dager
- om eksporten skal flyttes til en egen workload uten ingress, så skrivetilgangen
  til teamenes datasett ikke ligger i podden som tar imot svar
- om `feedback` trenger en indeks på `(team, opprettet, id)`, og om Lumi skal
  lagre hvem som har slått fritekst av og på

### Forholdet til #482

#482 beskrev analyseproduktene fra ADR 0006 i detalj. Disse beslutningene
derfra gjelder fortsatt:

- Lumis interne ID forlater aldri Lumi, og `innsending_id` er en pseudonym ID
  med egen nøkkel.
- Rå `feedback_json`, JSON-kolonner, tagger fra appen, URL, pathname,
  nettleser, skjermstørrelse og feilsøkingsdata er aldri med.
- Tidspunktet er rundet ned til hel time, og datoen er i norsk tid.
- Datamarkedsplassen forvalter tilgangen. Lumi gir ingen tilgang og bygger
  ingen godkjenning.
- Fritekst og datosvar er ikke med i produksjon. Fritekst kan åpnes for ett
  team når en PVK dekker det.
- `esyfo-analyse` fjernes etter en kontrollert overgang.

Dette er endret:

- Dataene ligger i teamets eget prosjekt, ikke i et datasett per produkt i et
  Lumi-prosjekt. Hvert team har ett eksportmål med alle surveyene sine, og
  teamet deler views.
- Det finnes ingen utkast, releaser, forhåndsvisning eller manifest. Tabellene
  har en fast kontrakt der kolonner bare legges til.
- Lumi lager ingen brede views per survey. `svar` har én rad per svarverdi, og
  `innsendinger` én rad per innsending.
- Spørsmåls- og svartekst er den nyeste teksten i innsendingene, maskert, slik
  dashboardet viser den. #482 ville bare bruke tekst fra registrert metadata,
  fordi tekstene i innsendingen kommer fra klienten. Lumi har ennå ikke et slikt
  register for surveyer som er definert i appens kode. En innsending med
  manipulerte tekster kan derfor endre teksten i tabellene, til neste ekte
  innsending kommer.
- Enhetstypen er alltid med, siden den bare har tre faste verdier.
- Lumi API skriver selv til teamenes datasett, i stedet for egne identiteter for
  hvert steg. Det er vurdert under negative konsekvenser.
- Lumi bruker lastejobber via REST, ikke planlagt federated query, og hver
  tabell erstattes for seg.
- Tabellene viser ikke om respondenten fikk se spørsmålet.

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
- iSyfo beholder historikken og kan erstatte spørringene mot
  produksjonsdatabasen.
- Tabellene kan brukes i Metabase uten SQL og uten å koble sammen tabeller.
- Den brede databaserollen `esyfo-analyse` kan fjernes.

### Negativt og residualrisiko

- Hvert team må kjøre SQL-en fra dashboardet i sitt prosjekt og registrere
  dataproduktet på Datamarkedsplassen selv.
- Lumis tjenestekonto kan lese, endre og slette alle tabeller i datasettene
  teamene kobler til, også views teamet har lagt der. Lumi rører bare tabeller
  med Lumis labeler, men et angrep på Lumi API kan nå alle tabellene i disse
  datasettene. Derfor skal datasettet bare brukes til Lumi. Lumi kan ikke gi
  noen tilgang eller endre noe annet i prosjektet. Lumi kan også endre SQL-en i
  views i datasettet. Et angrep på Lumi API kan derfor få et delt view til å vise
  alle tabellene i datasettet, også `fritekst`, til alle som har tilgang til
  viewet.
- Tabellene oppdateres én om gangen. Feiler en kjøring underveis, kan tabellene
  komme fra ulike kjøringer, og konsumentene må sjekke `oppdatert_tidspunkt`.
- Tilganger gitt på Datamarkedsplassen ligger på tabellen eller viewet. De
  forsvinner når en tabell slettes eller utløper, også ved **Stopp eksporten**
  og når teamet bytter datasett. Mangler en tabell eller et view i sju dager,
  fjerner Datamarkedsplassen datasettet fra dataproduktet og databasen fra
  Metabase.
- Fritekst er stengt i produksjon til et team har en PVK som dekker fritekst i
  BigQuery.
- Sletting i BigQuery skjer når neste kjøring lykkes, ikke umiddelbart.
- Tidspunkt, app, enhetstype og svar kan sammen gjøre det mulig å kjenne igjen
  hvem som svarte i små grupper. Tabellene skal derfor registreres som
  personopplysninger.
- Lumi skriver mot BigQuerys REST-API selv. Protokollen for resumable upload og
  lastejobber er dekket av tester mot et simulert API, men må verifiseres i dev.

## Vurderte alternativer

### Fortsette med ADR 0006

Forkastet. Modellen er avhengig av plattformfunksjoner som ikke finnes, legger
dataene i et prosjekt som ikke hører til teamet, og skjuler historikken.

### Datastream fra Lumis database

Forkastet. Datastream kopierer rådata med fritekst til BigQuery og krever logisk
replikering i produksjonsdatabasen og views per team. Det er mer infrastruktur
enn datamengden trenger.

### Planlagt federated query

Forkastet. JSON-parsingen måtte skrives på nytt i SQL, og spørringene ville
ligget i GCP-konsollen uten kodegjennomgang.

### API som teamene henter fra

Forkastet. Hvert team måtte skrevet og driftet sin egen jobb.

### Googles klientbibliotek for BigQuery

Forkastet. Biblioteket drar med seg gRPC, Arrow og Storage API, som eksporten
ikke bruker. Noen få REST-kall mot datasett, tabeller og jobber dekker behovet.

## Kilder

- [NADA: registrere dataprodukt](https://docs.knada.io/dataprodukter/dele/dataprodukt/)
- [NADA: tilgangsstyring](https://docs.knada.io/dataprodukter/tilgangsstyring/)
- [NADA: Metabase](https://docs.knada.io/analyse/metabase/)
- [NADA: datafortellinger](https://docs.knada.io/analyse/datafortellinger/)
- [NADA: spilleregler](https://docs.knada.io/juridisk/spilleregler/)
- [NADA: jobben som fjerner datasett når tabellen mangler](https://github.com/navikt/nada-markedsplassen/blob/main/pkg/syncers/bigquery_datasource_missing/bigquery_datasource_missing.go)
- [Nais: tilganger til GCP-ressurser](https://doc.nais.io/workloads/application/reference/application-spec/#gcppermissions)
- [Google Cloud: tilgang til datasett med GRANT](https://cloud.google.com/bigquery/docs/control-access-to-resources-iam)
- [Google Cloud: time travel og fail-safe](https://cloud.google.com/bigquery/docs/time-travel)
- [Google Cloud: laste JSON-data](https://cloud.google.com/bigquery/docs/loading-data-cloud-storage-json)
- [Runbook for BigQuery-eksporten](https://github.com/navikt/lumi/blob/main/apps/lumi-api/docs/runbooks/bigquery-export.md)
