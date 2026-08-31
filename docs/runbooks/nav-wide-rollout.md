# NAV-wide utrulling av Lumi-widgeten

Denne runbooken skiller teknisk release-readiness fra beslutningen om hvilke
surveys som faktisk skal være aktive. Migrering eller reaktivering skal ikke
brukes som en måte å ta produktbeslutningen på.

Den skiller også Lumi-teamets leveranse fra konsumentteamets utrulling. Lumi
endrer, deployer eller sender ikke prober gjennom andre teams apper. Når
plattformgatene nedenfor er grønne, er Lumi klar for konsumentmigrering; hvert
konsumentteam eier deretter sin kodeendring, dev-canary og produksjonssetting.

## Nå-status

| Område | Status | Bevis |
| --- | --- | --- |
| Historiske surveys i dashboardet | Klar | Automatisk periode velges fra surveyens faktiske datointervall; eksplisitt valgt periode beholdes |
| Pakket `@navikt/lumi-survey` | Klar for 2.2.0-release | `pnpm run verify:lumi-survey-consumer` installerer tarballen i en ren konsument og kjører typecheck + Vite-build |
| Widget → proxy → API → Postgres → dashboard | Automatisert | `pnpm run test:full-chain` kjører alle elleve stabile survey- og feltvarianter mot en isolert Compose-stack, inkludert legacy v1 → kompatibel widget-v2 på samme survey-ID, og CI laster opp én aggregert terminalrapport med receipt per innsending |
| Ekte Azure OBO i dev | Selvbetjent | `/release-verification` kjører team-preflight, startprobe, 15 minutters hold og sluttprobe med eksakt receipt-readback |
| Innsendingshelse | Instrumentert | `lumi_submissions_total` skiller kanal og utfall; prod varsler på serverfeil og rejection-spike |
| Hvilke eksisterende surveys som skal fortsette | Konsumenteid | Må avklares av data- og produkteier før migrering; surveys som skal stoppes migreres ikke |
| Ekte trygdeetaten-proxy fra konsument i dev | Klar for konsumentverifikasjon | Proxyen og onboardingoppskriften leveres av Lumi; hver konsument verifiserer sin egen deployede OBO-flyt |

Det skal ikke settes auto-merge på canary- eller migrerings-PR-er. Legacy-data
beholdes og skal fortsatt være lesbare selv om en survey skrus av.

## Ansvar ved handoff

Lumi-teamet eier:

- publisering og verifikasjon av `@navikt/lumi-survey`
- Lumi API, `lumi-submission-proxy`, dashboard og inbound allowlisting
- kontraktsmatrise, lokal fullkjede, release-verifikasjon og driftsalarmer
- dokumentasjon av migreringsrekkefølge og stoppkriterier

Konsumentteamet eier:

- beslutningen om hvilke surveys som skal beholdes eller stoppes
- oppgradering til `@navikt/lumi-survey@^2.2.0` og bruk av
  `SurveyDocumentV1` for surveys som migreres
- kode, outbound-policy, dev- og produksjonsdeploy i egen app
- syntetiske canary-svar og kontroll av egne receipts i dashboardet
- rollback dersom stoppkriteriene slår inn

## Lumi-side release-verifikasjon

1. Hold fullkjedetesten, pakkekonsumenttesten, lint, typecheck og tester grønne.
2. Deploy Lumi-endringene til dev etter ordinær review.
3. Åpne `/release-verification` i dev. Ikke send noe dersom team-preflighten
   feiler.
4. Send startproben med de syntetiske valgene. Vent til siden låser opp
   sluttproben etter 15 minutter, og send den.
5. Del rapportlenken eller last ned JSON-beviset. For den kontrollerte kjeden
   skal `outcome` og `coverage.controlledRoundTrip` være `passed`. CI-profilen
   krever i tillegg `coverage.legacyCompatibility: passed`.
6. Lagre rapportlenken eller JSON-beviset sammen med release-evidensen.

Dette gir release-evidens uten å aktivere, migrere eller sende data fra en ekte
survey. Rapporten er bevisst avgrenset: `globalAzureHealth` er
`not-assessed`, `trygdeetatenProxy` er `not-tested`, og `navWideRelease`
forblir `pending`. Feltene beskriver det rapporten selv har observert; de betyr
ikke at Lumi-teamet skal kjøre en annen apps canary. Konsumentens egen canary
er fortsatt gate for den appens produksjonssetting.

### Hva rapporten faktisk beviser

Dev-profilen går gjennom den publiserte widgeten, dashboardets innloggede
Azure OBO-flyt, Lumi API, Postgres og det eksakte analytics-readbacket. Siden
kan lukkes og åpnes igjen; receipt-ID-ene i URL-en rekonstruerer rapporten fra
lagrede data i stedet for nettleserstate.

Den lokale profilen bruker den samme rapportmodellen med null minutters hold.
CI laster opp `apps/lumi-dashboard/test-results/full-chain` som
`full-chain-release-verification-<run-id>`, også når testen feiler. Dette gjør
resultatet lesbart for CI, en agent eller et menneske uten Grafana, NAIS-konsoll
eller direkte loggtilgang.

### Automatisk kontraktsmatrise

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

## Beslutningstabell før konsumentmigrering

Lag én rad per eksisterende survey før kode endres:

| Survey | Eier | I bruk nå? | Behold / stopp / avklar | Samme måling etter migrering? | Behold survey-ID? | Canary-app |
| --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … |

Regler:

- `stopp`: skru av widgeten; ikke migrer den bare for å standardisere kode
- `avklar`: ingen merge før eier har bestemt seg
- `behold` + uendret måling: samme survey-ID kan beholdes
- `behold` + endret spørsmål, alternativer eller betydning: ny survey-ID

## Konsumenteid migreringsrekkefølge

Konsumentteamet gjennomfører denne rekkefølgen i eget repository og miljø:

1. Kartlegg alle Lumi-surveys i appen, og velg én avklart survey med tydelig
   eier og en fungerende dev-flate.
2. Sammenlign gammel og ny definisjon: felt-ID, felttype, ratingvariant,
   option-ID og betydning.
3. Oppgrader til `@navikt/lumi-survey@^2.2.0`, migrer surveyen til
   `SurveyDocumentV1` og deploy til dev uten auto-merge.
4. Send ett gjenkjennelig testsvar gjennom den faktiske konsumenten. For en
   trygdeetaten-app skal dette gå gjennom `lumi-submission-proxy`.
5. Finn receipt/svaret i dashboardet med automatisk periode og kontroller team,
   app, survey-ID og forventede syntetiske svar. Dette tester den faktiske
   konsumentens proxy-integrasjon uten eksterne driftsverktøy.
6. Vent minst 15 minutter og send en ny syntetisk probe gjennom den samme
   canary-flaten. Kontroller også denne eksakte raden i dashboardet.
7. Merge én liten produksjonsbatch, observer, og utvid først etter grønn holdetid.

Lumi sin `/release-verification` kan ikke bevise en annen apps deployede
trygdeetaten-proxy. Det beviset må produseres av konsumentteamet i egen app.
Global kanalhelse og alarmer er supplerende operasjonell overvåking, ikke en
skjult forutsetning for å produsere den selvbetjente rapporten.

## Lukkekriterium for Lumi-sporet

Lumi er klar for konsumentmigrering når:

1. anbefalt pakkeversjon er publisert og den pakkede konsumenttesten er grønn
2. lokal fullkjede og dev release-verifikasjon er tilgjengelig
3. API, proxy, dashboard, allowlisting og driftsalarmer er dokumentert
4. migreringsrekkefølge, ansvarsgrense og stoppkriterier er tydelige

Dette lukkekriteriet påstår ikke at en bestemt konsument er migrert. En
konsument-canary er en release-gate for den konsumentens app, ikke en handling
Lumi-teamet utfører på teamets vegne.

## Før aktivering for flere team

I tillegg til en grønn canary må disse varige gatene være lukket:

1. Retensjonsperiode, slettemodell og dataeier er besluttet og dokumentert.
2. Teamtilgang feiler lukket, og maksimal tid for tilbakekalling av tilgang er
   avtalt og verifisert.
3. Eventuell lesetilgang på tvers av team har navngitt eier, dokumentert formål
   og minste nødvendige databasetilganger.
4. Ansvar og forventet behandlingstid for onboarding av nye konsumentapper er
   dokumentert.
5. Surveylisten og målingskontinuiteten er avklart etter beslutningstabellen
   over.
6. Kapasitets- og recovery-valget følger
   [ADR 0005](../adr/0005-database-recovery-og-kapasitet.md): dagens database
   beholdes med eksplisitt RPO/RTO og målte stoppterskler. HA, PITR og
   oppskalering skal ikke innføres som skjulte standardvalg.

## Stoppkriterier

Stans neste deploy eller migrering hvis ett av disse inntreffer:

- `LumiSubmissionFailure` fyrer
- `LumiSubmissionRejectionSpike` fyrer
- testsvar er akseptert, men mangler i dashboardet
- definisjonskonflikt (`409`) oppstår
- surveyen dukker opp med feil team, app eller tidsperiode
- eier eller ønsket aktiv status er uklar

Ved feil beholdes gammel widget aktiv dersom den allerede er i produksjon.
Rull tilbake konsumentendringen; ikke slett legacy-data eller endre survey-ID
for å omgå en konflikt. Se også
[submission health-runbooken](https://github.com/navikt/lumi/blob/main/apps/lumi-api/docs/runbooks/submission-health.md)
og [survey-identitet](/guider/survey-identitet).
