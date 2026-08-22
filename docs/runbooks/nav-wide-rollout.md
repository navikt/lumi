# NAV-wide utrulling av Lumi-widgeten

Denne runbooken skiller teknisk release-readiness fra beslutningen om hvilke
surveys som faktisk skal være aktive. Migrering eller reaktivering skal ikke
brukes som en måte å ta produktbeslutningen på.

## Nå-status

| Område | Status | Bevis |
| --- | --- | --- |
| Historiske surveys i dashboardet | Klar | Automatisk periode velges fra surveyens faktiske datointervall; eksplisitt valgt periode beholdes |
| Pakket `@navikt/lumi-survey` | Automatisert | `pnpm run verify:lumi-survey-consumer` installerer tarballen i en ren konsument og kjører typecheck + Vite-build |
| Widget → proxy → API → Postgres → dashboard | Automatisert | `pnpm run test:full-chain` kjører to Playwright-scenarier mot en isolert Compose-stack |
| Ekte Azure OBO i dev | Klar til kjøring | `/release-verification` i dev-dashboardet bruker en ny syntetisk survey-ID per kjøring |
| Innsendingshelse | Instrumentert | `lumi_submissions_total` skiller kanal og utfall; prod varsler på serverfeil og rejection-spike |
| Hvilke eksisterende surveys som skal fortsette | Avventer | Må avklares før migrering; surveys som skal stoppes migreres ikke |
| Ekte trygdeetaten-proxy fra konsument i dev | Avventer canary | Verifiseres i første avklarte interne konsument før bredere migrering |

Det skal ikke settes auto-merge på canary- eller migrerings-PR-er. Legacy-data
beholdes og skal fortsatt være lesbare selv om en survey skrus av.

## Det som kan gjøres før surveylisten er avklart

1. Hold fullkjedetesten, pakkekonsumenttesten, lint, typecheck og tester grønne.
2. Deploy Lumi-endringene til dev etter ordinær review.
3. Kjør `/release-verification` i dev og finn sporingsmerknaden i dashboardet.
4. Bekreft `created` på `azure`-kanalen og fravær av `failed`/`rejected` i minst
   15 minutter.
5. Review canary-PR-en uten å merge den.

Dette gir release-evidens uten å aktivere, migrere eller sende data fra en ekte
survey.

## Beslutningstabell for neste uke

Lag én rad per eksisterende survey før kode endres:

| Survey | Eier | I bruk nå? | Behold / stopp / avklar | Samme måling etter migrering? | Behold survey-ID? | Canary-app |
| --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … |

Regler:

- `stopp`: skru av widgeten; ikke migrer den bare for å standardisere kode
- `avklar`: ingen merge før eier har bestemt seg
- `behold` + uendret måling: samme survey-ID kan beholdes
- `behold` + endret spørsmål, alternativer eller betydning: ny survey-ID

## Kontrollert migreringsrekkefølge

1. Velg én avklart survey med tydelig eier og en fungerende dev-flate.
2. Sammenlign gammel og ny definisjon: felt-ID, felttype, ratingvariant,
   option-ID og betydning.
3. Deploy til dev uten auto-merge.
4. Send ett gjenkjennelig testsvar gjennom den faktiske konsumenten. For en
   trygdeetaten-app skal dette gå gjennom `lumi-submission-proxy`.
5. Finn svaret i dashboardet med automatisk periode og kontroller kanalmetrikken.
6. Vent minst 15 minutter uten `failed` eller rejection-spike.
7. Merge én liten produksjonsbatch, observer, og utvid først etter grønn holdetid.

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
