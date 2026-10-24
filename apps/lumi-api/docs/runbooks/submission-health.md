# Submission health

Denne runbooken brukes for feil og avvisninger på Lumi sine tre
innsendingskanaler: `tokenx`, `azure` og `internal_proxy` (dev-proxyen). Den
brukes også når `lumi-api` eller `lumi-dashboard` ikke har tilgjengelige
replikaer, og når serverfunksjonene i `lumi-dashboard` feiler.

## Metrikken

`lumi_submissions_total` har kun to avgrensede labels:

- `channel`: `tokenx`, `azure` eller `internal_proxy`
- `outcome`: `created`, `duplicate`, `rejected` eller `failed`

Survey-ID, team og app finnes bevisst ikke i metrikken. Bruk strukturerte
logger for å finne den konkrete konsumenten etter at kanalen er identifisert.

## Første vurdering

1. Stans nye migreringer og behold eksisterende widgets uendret.
2. Finn kanalen og utfallet i Grafana:

   ```promql
   sum by (channel, outcome) (
     increase(lumi_submissions_total{app="lumi-api"}[15m])
   )
   ```

3. Sjekk om problemet startet samtidig med en Lumi-deploy eller en
   konsumentdeploy.
4. Søk i `lumi-api`-loggene på tidspunktet og kanalen. Loggene for vellykkede
   kall inneholder team, app og survey-ID; feilresponsen og exceptiontypen
   viser hvorfor et kall ble avvist eller feilet.

## Tolkning

| Utfall | Betydning | Tiltak |
| --- | --- | --- |
| `created` | Ny respons er lagret og svar er sendt til konsumenten | Ingen |
| `duplicate` | En retry traff samme dedupliseringsnøkkel; ingen ekstra rad ble opprettet | Forventet ved nettverksretry; undersøk kun ved kraftig økning |
| `rejected` | Autentisert kall ble avvist som 4xx, for eksempel rate limit, ugyldig payload eller definisjonskonflikt | Finn konsument og valider survey-kontrakten |
| `failed` | Behandlingen eller responsen traff en uventet intern feil | Stans utrulling og undersøk API, database og avhengigheter |

Ved `409 DefinitionConflict` følger du også
[runbooken for survey-definisjonskonflikter](./survey-definition-conflicts.md).

### 503 «Databasen svarer ikke akkurat nå»

API-et svarer 503 når et kall ikke fikk en databasetilkobling i tide, eller når
én spørring brukte lengre tid enn grensen. Ved innsending telles det som
`failed`. Får poolet ikke tilkobling fordi databasen er nede, gir det samme
svar.

| Pool | Brukes av | Tilkoblinger per pod | Venter på tilkobling | Grense per spørring |
| --- | --- | --- | --- | --- |
| `lumi-api-submission-pool` | Innsending | 4 (dev: 2) | 3 s | 3 s |
| `lumi-api-readiness-pool` | `/internal/isReady` | 1 | 0,5 s | Ingen |
| `lumi-api-pool` | Dashboard, Surveyverksted og analyse | 8 (dev: 4) | 5 s | 15 s |

Dev har den minste Cloud SQL-instansen, som tillater 25 tilkoblinger, og
setter mindre pooler med `LUMI_DB_MAIN_POOL_SIZE` og
`LUMI_DB_SUBMISSION_POOL_SIZE`. `DatabasePoolEnvTest` sjekker at alle poolene
i maks antall podder pluss én ekstra pod under utrulling holder seg under
grensen i både dev og prod. Øker dere antall replikaer eller poolstørrelsen,
eller bytter dere tier, må testen fortsatt passere.

Flyway og slettejobben bruker også `lumi-api-pool`, men uten grense per
spørring. Grensen gjelder hver spørring for seg, så et kall med flere
spørringer kan holde en tilkobling lenger enn grensen.

Poolene hindrer at tunge kall fra dashboardet tar alle tilkoblingene, men de
deler fortsatt databasens CPU. Innsendinger til samme survey venter dessuten
på hverandre, fordi de oppdaterer samme rad i `survey_definitions`. Kommer
503 ved innsending:

1. Står det `Readiness check failed: database not reachable` i loggene til
   `lumi-api`, er databasen nede. Følg da avsnittet under.
2. Ellers er databasen presset. Sjekk CPU og antall tilkoblinger for
   instansen i Cloud SQL, og se etter tunge spørringer i Query Insights.

## Ingen tilgjengelige replikaer

`LumiApiNoAvailableReplicas` og `LumiDashboardNoAvailableReplicas` går når
`kube_deployment_status_replicas_available` har vært 0 i fem minutter.
Metrikken kommer fra Kubernetes, så alarmen går også når ingen kall kommer
fram til appen og `LumiSubmissionFailure` ikke kan gå.

- `lumi-api`: Innsendinger bufres ikke, så svar som sendes mens alarmen står,
  blir ikke lagret. `/internal/isReady` krever en databasetilkobling, så et
  databaseutfall gjør alle podene utilgjengelige samtidig.
- `lumi-dashboard`: Teamene kommer ikke inn i dashboardet. Innsendinger går
  direkte til `lumi-api` og påvirkes ikke.

Databasen har vedlikeholdsvindu søndag kl. 01–02 UTC, det vil si kl. 03 om
sommeren og kl. 02 om vinteren norsk tid. Vinduet er satt med `maintenance` i
`apps/lumi-api/nais/app/prod.yaml`. Databasen har ikke HA, så vedlikeholdet kan
gi et kort utfall der readiness feiler for alle podene i `lumi-api`. Alarmen går
bare hvis utfallet varer i fem minutter.

1. Stans videre utrulling og nye migreringer.
2. Se på podene i Nais Console eller med
   `kubectl get pods -n team-esyfo -l app=<app>` og `kubectl describe pod <pod>`.
   Se etter `CrashLoopBackOff`, `ImagePullBackOff`, `OOMKilled` og feilende
   readiness.
3. Står det `Readiness check failed: database not reachable` i loggene til
   `lumi-api`, sjekker du om utfallet startet i vedlikeholdsvinduet. Varer det
   lenger enn vinduet, eller startet det utenfor, følger du
   [runbooken for database recovery](./database-recovery.md).
4. Startet utfallet med en deploy, kjører du `deploy-api.yaml` eller
   `deploy-dashboard.yaml` manuelt mot `prod` med forrige fungerende commit som
   `ref`. Flyway-migreringer rulles ikke tilbake. Hver app har én deploykø per
   miljø med plass til én ventende deploy, og den som havner i køen sist,
   erstatter den som venter. En tilbakerulling som venter, kan derfor bli erstattet av et nytt
   push-deploy. Stans merging til `main` til tilbakerullingen er ferdig, og
   kontroller i GitHub Actions at prod-jobben i den manuelle kjøringen er
   fullført.
5. Når replikaene er tilbake, kontrollerer du `LumiSubmissionFailure` og
   `LumiSubmissionRejectionSpike`. Gjaldt alarmen `lumi-api`, noterer du når
   utfallet startet og sluttet, siden svar fra perioden mangler.

## Feil i serverfunksjonene til dashboardet

`LumiDashboardServerFunctionFailures` går når flere enn 20 kall til
serverfunksjonene i `lumi-dashboard` har feilet med 5xx de siste 15 minuttene,
og det har vart i to minutter. En sidevisning som feiler, gir seks til åtte
feilede kall, så alarmen krever omtrent tre slike sidevisninger. Teamene ser
feilmeldinger der dashboardet skulle vist data, og lagring kan feile.
Innsendinger går direkte til `lumi-api` og påvirkes ikke.

Alarmen bruker `lumi_dashboard_server_fn_5xx_failures_total`, som ikke har
labels. `lumi_dashboard_server_fn_failures_total` teller alle feilene, også
4xx, med to labels:

- `fn`: navnet på serverfunksjonen, for eksempel `fetchStatsServerFn`
- `status`: statusen feilen står for

Finn funksjonene og statusene i Grafana:

```promql
sum by (fn, status) (
  increase(lumi_dashboard_server_fn_failures_total{app="lumi-dashboard"}[15m])
)
```

Hver feil gir én linje i loggene til `lumi-dashboard` med meldingen
`Server function failed` og feltene `serverFn`, `status`, `errorName`,
`apiErrorType`, `durationMs` og `httpCall`. Feilmeldinger og input logges ikke.
Med `httpCall: true` er `status` HTTP-statusen kallet fikk. Med
`httpCall: false` kalte en side serverfunksjonen under serverrendering. Da er
`status` bare statusen feilen står for, og siden beholder sin egen.

| Status | Betydning | Tiltak |
| --- | --- | --- |
| 502 | `errorName: TypeError`: dashboardet nådde ikke `lumi-api`. `errorName: BadGatewayError`: `lumi-api` svarte med en feil uten Lumi API-ets feilformat, svarte 5xx om analyseprodukter eller BigQuery-eksport, eller sendte et svar som bryter kontrakten. `errorName: HttpStatusError`: token-utvekslingen (OBO) feilet, og loggen har også linjen `OBO token exchange failed` | Sjekk podene og loggene til `lumi-api`. Bryter svarene kontrakten, sjekk om en deploy av `lumi-api` eller dashboardet endret den |
| 503 | `lumi-api` svarte 503 med Lumi API-ets feilformat. Med `apiErrorType: DATABASE_UNAVAILABLE` svarte ikke databasen i tide | Følg avsnittet om 503 over |
| 500 | Med `errorName: ApiErrorException` svarte `lumi-api` 500 med Lumi API-ets feilformat. Med andre `errorName` oppsto feilen i dashboardet | Sjekk loggene til `lumi-api` eller dashboardet på tidspunktet, og om feilene startet med en deploy |

Alarmen teller ikke 4xx. De gjelder som regel én bruker eller én forespørsel,
for eksempel manglende tilgang eller ugyldig input.

Startet feilene med en deploy av dashboardet, ruller du tilbake slik punkt 4
under «Ingen tilgjengelige replikaer» beskriver.

## Verifikasjon etter retting

1. Kjør `pnpm test:full-chain` lokalt.
2. Kjør `/release-verification` i dev. Den oppretter en ny syntetisk survey-ID
   på formen `lumi-release-verification-YYYYMMDD-<kort-id>`.
3. Bekreft team-preflighten og send startproben. Dashboardet leser den eksakte
   receipt-raden tilbake fra Postgres via analytics-API-et.
4. Etter 15 minutter sender du sluttproben. Del rapportlenken eller last ned
   JSON-beviset når den kontrollerte dev-kjeden er `passed`.
5. Global feilrate og alarmer vurderes separat ved en faktisk hendelse. De er
   ikke del av den databaseforankrede release-rapporten, som eksplisitt viser
   `globalAzureHealth: not-assessed`.

Syntetiske survey-ID-er skal aldri gjenbrukes med en annen struktur. Dataene
kan arkiveres i dashboardet etter testen; de skal ikke slettes som del av
feilhåndteringen.
