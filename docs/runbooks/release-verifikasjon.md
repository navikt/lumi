# Release-verifikasjon av Lumi

Release-verifikasjonen sender syntetiske svar gjennom Lumi og leser dem tilbake
fra databasen. Den aktiverer, migrerer eller sender ikke data fra en ekte
survey. Lumi endrer, deployer eller sender ikke prober gjennom andre teams
apper.

## Kjør verifikasjonen i dev

1. Hold fullkjedetesten, pakkekonsumenttesten, lint, typecheck og tester grønne.
2. Deploy Lumi-endringene til dev etter ordinær review.
3. Åpne `/release-verification` i dev. Ikke send noe dersom team-preflighten
   feiler.
4. Send startproben med de syntetiske valgene. Velg **Send med app-token**.
   Send sluttproben når holdetiden på 15 minutter er over.
5. Del rapportlenken eller last ned JSON-beviset. For den kontrollerte kjeden
   skal `outcome` og `coverage.controlledRoundTrip` være `passed`. I dev skal
   også `coverage.appTokenRoundTrip` være `passed`. CI-profilen
   krever i tillegg `coverage.legacyCompatibility: passed`.
6. Lagre rapportlenken eller JSON-beviset sammen med release-evidensen.

Rapporten er avgrenset: `globalAzureHealth` er `not-assessed`,
`trygdeetatenProxy` er `not-tested`, og `navWideRelease` forblir `pending`.
Feltene beskriver det rapporten selv har observert. Rapporten kan ikke bevise
at en annen apps deployede trygdeetaten-proxy virker. Det må teamet som har
ansvaret for appen, kontrollere i egen app.

## Hva rapporten bekrefter

Start- og sluttproben går fra widgeten til Lumi API via det innloggede
dashboardet. Dashboardet bruker kvitterings-ID-ene i lenken til å lese begge
svarene fra databasen når dere åpner rapporten igjen. Hvis innsendingen feiler
før dashboardet mottar en kvittering, forsvinner feilmeldingen ved omlasting.
Dere kan prøve igjen i samme kjøring. Hvis dashboardet allerede har mottatt
en kvittering og mangler tilgang til å lese den, kontroller innlogging og
teamtilgang. Velg deretter **Prøv readback igjen**.

### Innsending med app-token

Under **Innsending med app-token** kontrollerer dashboardet at `azp_name` er
`dev-gcp:team-esyfo:lumi-dashboard`, at `idtyp` er `app` og at `roles`
inneholder `access_as_application`. Det sender ett syntetisk svar direkte til
Lumi API med app-tokenet. Med den innloggedes OBO-token leser dashboardet
tilbake kvitteringen for `team-esyfo` og kontrollerer blant annet app,
survey-ID og kontrollkode. Flere forsøk i samme kjøring bruker samme
dedupliseringsnøkkel. Lokalt viser steget **Ikke testet**.

Avviker et av de tre feltene, sender dashboardet ingenting. Feilmeldingen,
for eksempel «idtyp mangler», vises ved knappen og står ikke i rapporten.
Noter den før dere laster siden på nytt. Et slikt avvik går ikke over ved
nytt forsøk.

Et grønt app-steg viser ikke alene at Lumi API behandlet innsendingen som et
app-kall. Finn `callId=<survey-ID>-app-token` i detaljteksten på det beståtte
app-steget. Søk etter samme ID i loggen for `lumi-api` og bekreft at
`AzureSubmissionAuthPlugin` skrev `perUserLimit=false` for akkurat det kallet.
Det viser at API-et behandlet innsendingen uten en egen grense per bruker.

### Lokalt og i CI

Den lokale profilen bruker den samme rapportmodellen med null minutters hold.
CI laster opp `apps/lumi-dashboard/test-results/full-chain` som
`full-chain-release-verification-<run-id>`, også når testen feiler. Dette gjør
resultatet lesbart for CI, en agent eller et menneske uten Grafana, Nais Console
eller direkte loggtilgang.

## Automatisk kontraktsmatrise

Fullkjedetesten oppdager scenarioene som den lokale testbenken faktisk viser og
feiler dersom den kjente matrisen driver fra disse. Hvert scenario går gjennom
den publiserte widgeten, lokal submission-proxy, Lumi API, Postgres og
dashboardets feedback- og typevisning. V2-definisjonen og alle svar
sammenlignes før transport; den utvidede feedbackraden sammenlignes etter
lagring.

Matrisen dekker:

- surveytypene `rating`, `discovery`, `topTasks`, `taskPriority` og `custom`
- ratingvariantene emoji, tommel, stjerner og NPS
- tekst, enkeltvalg, flervalg med avkryssing og flervalg med komboboks
- `SurveyDocumentV1` med flere sider, flere spørsmål per side og `visibleIf`
- eksisterende flat `LumiSurveyConfig`: først en representativ
  `schemaVersion: 1` uten `definition` eller `deduplicationKey`, deretter en
  kompatibel `schemaVersion: 2` fra dagens widget på samme survey-ID

Legacy-sporet krever `201` og ulike receipt-ID-er for begge innsendingene. Det
finner deretter hver feedbackrad ved eksakt receipt-ID og kontrollerer survey,
app og egne svar i dashboardet. Resultatet lagres separat under
`automation.legacyCompatibility`, slik at en grønn generell matrise ikke kan
skjule et brudd i overgangsformatet.

`DATE` finnes i den bredere API-kontrakten for lagrede svar, men er ikke en
spørsmålstype som `@navikt/lumi-survey` kan authorere eller rendre. Den er derfor
ikke del av widgetens støttede kontraktsmatrise. Hvis dato skal bli en offentlig
widgetfunksjon, må renderer, authoring, transport og fullkjedescenario legges til
samlet.

## Stoppkriterier

Stans neste deploy hvis ett av disse inntreffer:

- `LumiSubmissionFailure` fyrer
- `LumiSubmissionRejectionSpike` fyrer
- testsvar er akseptert, men mangler i dashboardet
- definisjonskonflikt (`409`) oppstår
- surveyen dukker opp med feil team, app eller tidsperiode

Rull tilbake endringen. Ikke slett legacy-data eller endre survey-ID for å omgå
en konflikt. Se også
[submission health-runbooken](https://github.com/navikt/lumi/blob/main/apps/lumi-api/docs/runbooks/submission-health.md)
og [survey-identitet](/guider/survey-identitet).
