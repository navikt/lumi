# Submission health

Denne runbooken brukes for feil og avvisninger på Lumi sine tre
innsendingskanaler: `tokenx`, `azure` og `internal_proxy` (dev-proxyen).

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
| `rejected` | Autentisert kall ble avvist som 4xx, for eksempel ugyldig payload eller definisjonskonflikt | Finn konsument og valider survey-kontrakten |
| `failed` | Behandlingen eller responsen feilet som 5xx | Stans utrulling og undersøk API, database og avhengigheter |

Ved `409 DefinitionConflict` følger du også
[runbooken for survey-definisjonskonflikter](./survey-definition-conflicts.md).

## Verifikasjon etter retting

1. Kjør `pnpm test:full-chain` lokalt.
2. Kjør den kontrollerte dev-verifikasjonen med en ny syntetisk survey-ID på
   formen `lumi-release-verification-YYYYMMDD-<kort-id>`.
3. Bekreft `created` i metrikken for riktig kanal.
4. Bekreft at svaret er synlig i dev-dashboardet.
5. Observer `failed` og `rejected` i minst 15 minutter før neste migrering.

Syntetiske survey-ID-er skal aldri gjenbrukes med en annen struktur. Dataene
kan arkiveres i dashboardet etter testen; de skal ikke slettes som del av
feilhåndteringen.
