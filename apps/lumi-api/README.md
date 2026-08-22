# Lumi API

Backend for Lumi survey analytics, bygget med Ktor.

> 📖 **Bruker Lumi?** Se [Lumi-dokumentasjonen](https://navikt.github.io/lumi/) for integrasjonsguide og API-referanse.

## Kjør lokalt

```bash
# Forutsetninger: JDK 21, Docker

docker run -d --name lumi-db \
  -e POSTGRES_USER=lumi -e POSTGRES_PASSWORD=lumi -e POSTGRES_DB=lumi \
  -p 5432:5432 postgres:17

./gradlew run
# API tilgjengelig på http://localhost:8080
```

## API-endepunkter

### Innsending

| Endepunkt | Auth | Beskrivelse |
| :--- | :--- | :--- |
| `POST /api/tokenx/v1/feedback` | TokenX | Sluttbruker-flater (nav.no) |
| `POST /api/azure/v1/feedback` | AzureAD | Veileder-/Modia-/fagsystem-flater |

Kallene er backend-til-backend (token exchange server-side). Integrasjonsmønsteret er beskrevet i [Koble til backend](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend).

### Analyse & Dashboard

Alle endepunkter under `/api/v1/intern/*` er team-scope'et og krever Azure AD-token.

| Endepunkt | Beskrivelse |
| :--- | :--- |
| `GET /api/v1/intern/feedback` | Liste over tilbakemeldinger med filtre |
| `GET /api/v1/intern/feedback/{id}` | Hent én tilbakemelding |
| `DELETE /api/v1/intern/feedback/{id}` | Slett tilbakemelding permanent |
| `POST /api/v1/intern/feedback/{id}/tags` | Legg til tag |
| `DELETE /api/v1/intern/feedback/{id}/tags?tag=X` | Fjern tag |
| `GET /api/v1/intern/feedback/tags` | List alle tags |
| `GET /api/v1/intern/teams` | List autoriserte team og apper |
| `GET /api/v1/intern/feedback/teams` | List apper for valgt team |
| `DELETE /api/v1/intern/surveys/{surveyId}` | Slett alle tilbakemeldinger for en survey |
| `GET /api/v1/intern/stats/dashboard` | Hent dashboard-statistikk |
| `GET /api/v1/intern/stats/ratings` | Fordeling av rating |
| `GET /api/v1/intern/stats/timeline` | Tidslinjedata |
| `GET /api/v1/intern/export?format=csv\|json\|excel` | Eksportér data |

## Query-parametre

- `team` er valgfri. Utelatt → backend velger standardteam. Ugyldig → **403**.
- Route handlers bruker alltid `call.authorizedTeam` (validert av `TeamAuthorizationPlugin`).

| Parameter | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `team` | string | (velges av backend) | Team-scope for forespørselen |
| `app` | string | - | Filtrer på app |
| `fromDate` | `YYYY-MM-DD` | - | Startdato (Europe/Oslo, inklusiv) |
| `toDate` | `YYYY-MM-DD` | - | Sluttdato (Europe/Oslo, inklusiv) |
| `surveyId` | string | - | Filtrer på survey-id |
| `hasText` | boolean | `false` | Kun tilbakemeldinger med fritekst |
| `lowRating` | boolean | `false` | Kun lave ratinger (1-2) |
| `tag` | string[] | - | Gjentatt `tag=foo&tag=bar` (aksepterer også kommaseparert) |
| `query` | string | - | Fulltekstsøk |
| `page` | int | `0` | Side (0-indeksert) |
| `size` | int | `10` | Sidestørrelse |
| `deviceType` | string | - | `mobile`, `tablet`, `desktop` |
| `segment` | string[] | - | Gjentatt `segment=key:value` |
| `task` | string | - | Top Tasks drill-down filter |

Eksempel:

```http
GET /api/v1/intern/stats/dashboard?team=flex&app=spinnsyn&fromDate=2026-01-01&toDate=2026-01-31
```

## Rensing av sensitive data

API-et maskerer automatisk PII i fritekst:

| Mønster | Eksempel | Erstatning |
| :--- | :--- | :--- |
| Fødselsnummer | 12345678901 | `[FØDSELSNUMMER FJERNET]` |
| NAVident | A123456 | `[NAVIDENT FJERNET]` |
| E-post | test@nav.no | `[E-POST FJERNET]` |
| Telefon | 12345678 | `[TELEFON FJERNET]` |
| Kortnummer | 1234 5678 9012 3456 | `[KORTNUMMER FJERNET]` |
| Kontonummer | 1234.56.12345 | `[KONTONUMMER FJERNET]` |
| Hemmelig adresse | "hemmelig adresse" | `[HEMMELIG ADRESSE]` |

## Tilgang

Begge parter må konfigurere NAIS-tilgangspolicyer (Zero Trust).

Mottakeren avhenger av auth, miljø og Azure-tenant:

| Auth | Miljø | Azure-tenant i din app | Mottaker |
| :--- | :--- | :--- | :--- |
| TokenX | dev-gcp / prod-gcp | – | `lumi-api` |
| AzureAD | dev-gcp | `nav.no` | `lumi-api` |
| AzureAD | dev-gcp | `trygdeetaten.no` | `lumi-submission-proxy` |
| AzureAD | prod-gcp | `nav.no` | `lumi-api` |

Proxyen finnes bare i dev-gcp. Se
[integrasjonsguiden](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend)
for riktige host- og audience-verdier.

**Din app** (outbound ved direkte kall til `lumi-api`):

```yaml
spec:
  accessPolicy:
    outbound:
      rules:
        - application: lumi-api
          namespace: team-esyfo
```

**Din app** (outbound via proxy for AzureAD fra `trygdeetaten.no` i dev):

```yaml
spec:
  accessPolicy:
    outbound:
      rules:
        - application: lumi-submission-proxy
          namespace: team-esyfo
```

**Valgt mottaker** (inbound) — opprett en issue i dette repoet eller lag en PR:

```yaml
spec:
  accessPolicy:
    inbound:
      rules:
        - application: din-app
          namespace: ditt-team
```

Når appen går via proxyen, trenger den ikke en egen inbound-regel i
`lumi-api`; proxyen har tilgang videre.

Innsending er splittet på issuer:

| Flate | Token | Endepunkt | Caller identity claim |
| :--- | :--- | :--- | :--- |
| Sluttbruker (nav.no) | TokenX | `/api/tokenx/v1/feedback` | `client_id` (`cluster:namespace:app`) |
| Intern (Modia, fagsystemer) | AzureAD | `/api/azure/v1/feedback` | `azp_name` (`cluster:namespace:app`) |

<details>
<summary><strong>Dashboard-autorisasjon (NAIS team-oppslag)</strong></summary>

Backenden autoriserer dashboard-tilgang ved å slå opp teammedlemskap via NAIS Console GraphQL API, basert på brukerens e-post fra Azure-token claims.

Hvis NAIS team-oppslag ikke er konfigurert, feiler API-et lukket med **503** (`TEAM_LOOKUP_NOT_CONFIGURED`).

**Lokal testing:**

```bash
# Alt 1: Via NAIS CLI proxy (anbefalt)
nais login -n
nais alpha api proxy  # lytter på localhost:4242

export NAIS_API_GRAPHQL_URL='http://localhost:4242/graphql'
export NAIS_API_KEY='dummy'
./gradlew run

# Alt 2: Direkte med API-nøkkel
export NAIS_API_GRAPHQL_URL='https://console.nav.cloud.nais.io/graphql'
export NAIS_API_KEY='<dev-api-key>'
./gradlew run
```

**Observability (Prometheus-metrikker):**

| Metrikk | Beskrivelse |
| :--- | :--- |
| `nais_api_calls_total` | Antall NAIS API-kall |
| `nais_api_errors_total` | Antall NAIS API-feil |
| `nais_api_call_duration_seconds` | Varighet på NAIS API-kall |
| `nais_api_cache_hits_total` | Cache-treff |
| `nais_api_cache_misses_total` | Cache-miss |

</details>

<details>
<summary><strong>Utvikling</strong></summary>

### Bygg

```bash
./gradlew build
```

### Tester

```bash
./gradlew test
```

### Deploy

Deployes til NAIS via GitHub Actions.

</details>

<details>
<summary><strong>Teknologistack</strong></summary>

- **Ktor** - Kotlin web-rammeverk
- **PostgreSQL** - Database
- **Flyway** - Databasemigreringer
- **HikariCP** - Connection pooling
- **kotlinx.serialization** - JSON-serialisering
- **Apache POI** - Excel-eksport

</details>

## Se også

- [Lumi-dokumentasjon](https://navikt.github.io/lumi/)
- [Survey-widget — konfigurasjon og presets](../../packages/lumi-survey/README.md)
