# Lumi API

Backend-API for Lumi survey analytics, bygget med Ktor.

## Kom i gang (kort)

```bash
# Forutsetninger: JDK 21, Docker

docker run -d --name lumi-db \
  -e POSTGRES_USER=lumi -e POSTGRES_PASSWORD=lumi -e POSTGRES_DB=lumi \
  -p 5432:5432 postgres:17

./gradlew run
```

<details>
<summary><strong>Kom i gang (full)</strong></summary>

## Kom i gang

```bash
# Forutsetninger: JDK 21, Docker

# 1. Start PostgreSQL
docker run -d --name lumi-db \
  -e POSTGRES_USER=lumi -e POSTGRES_PASSWORD=lumi -e POSTGRES_DB=lumi \
  -p 5432:5432 postgres:17

# 2. Kjør API-et
./gradlew run
# API tilgjengelig på http://localhost:8080
```

</details>

## Når skal du bruke dette API-et?

- Du bygger en app som skal sende `submission.transportPayload` videre til Lumi.
- Du integrerer med dashboardet og trenger analyse-endepunkter.

Se også:
- Survey-widget og integrasjon: https://github.com/navikt/lumi/tree/main/packages/lumi-survey/README.md
- Oversikt i repoet: https://github.com/navikt/lumi
- OpenAPI (utkast): `docs/openapi/lumi-api.yaml` (fra repo-root)
- Pentest kickoff-underlag: `docs/security/pentest-kickoff.md` (fra repo-root)

Merk: OpenAPI-specen er en statisk fil i repoet og eksponeres ikke automatisk som Swagger-endepunkt i kjørende API.

## Egenskaper

- 📊 **Analyse-endepunkter** - Statistikk, aggregeringer og tidslinjedata
- 🔒 **Rensing av sensitive data** - Automatisk maskering av PII (fødselsnummer, e-post, telefon osv.)
- 📤 **Eksport** - CSV-, JSON- og Excel-eksport
- 📅 **Datofiltrering** - Filtrer tilbakemeldinger på tidsperiode
- 🏷️ **Tag-håndtering** - Legg til / fjern tags på tilbakemeldinger
- 🔐 **Autentisering (Azure AD)** - Sikker tilgang via NAIS Texas

## API-endepunkter

### Analyse & Dashboard (Internt)

| Endepunkt | Beskrivelse |
|----------|-------------|
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

### Query-parametre

Alle endepunkter under `/api/v1/intern/*` er **team-scope'et**.

- `team` er en **valgfri** query-parameter.
- Hvis `team` utelates, velger backenden et stabilt standardteam som brukeren har tilgang til.
- Hvis `team` er satt, men ikke autorisert, returnerer backenden **403**.
- Route handlers bruker alltid `call.authorizedTeam` (validert av `TeamAuthorizationPlugin`).

| Parameter | Type | Standard | Beskrivelse |
|-----------|------|---------|-------------|
| `team` | string | (velges av backend) | Team-scope for forespørselen |
| `app` | string | - | Filtrer på app |
| `fromDate` | `YYYY-MM-DD` | - | Startdato (Europe/Oslo, inklusiv) |
| `toDate` | `YYYY-MM-DD` | - | Sluttdato (Europe/Oslo, inklusiv) |
| `surveyId` | string | - | Filtrer på survey-id |
| `hasText` | boolean | `false` | Kun tilbakemeldinger med fritekst |
| `lowRating` | boolean | `false` | Kun lave ratinger (1-2) |
| `tag` | string[] | - | Gjentatt `tag=foo&tag=bar` (aksepterer også komma-separerte verdier per entry) |
| `query` | string | - | Fulltekstsøk |
| `page` | int | `0` | Side (0-indeksert) |
| `size` | int | `10` | Sidestørrelse |
| `deviceType` | string | - | `mobile`, `tablet`, `desktop` |
| `segment` | string[] | - | Gjentatt `segment=key:value` |
| `task` | string | - | Top Tasks drill-down filter (matcher option label) |

Eksempel:

```http
GET /api/v1/intern/stats/dashboard?team=flex&app=spinnsyn&fromDate=2026-01-01&toDate=2026-01-31
```

### Innsending (Public)

| Endepunkt | Beskrivelse |
|----------|-------------|
| `POST /api/tokenx/v1/feedback` | Innsending fra sluttbruker-flater (TokenX, schemaVersion=1) |
| `POST /api/azure/v1/feedback` | Innsending fra veileder-/Modia-/fagsystem-flater (AzureAD, schemaVersion=1) |

Merk: Survey-widgeten skal ikke kalle disse endepunktene direkte fra browser. Kall forventes å være backend-til-backend (token exchange server-side).

Integrasjonsmønsteret (widget → din backend → token exchange → lumi-api) er beskrevet i repoets rot-README og `packages/lumi-survey/README.md`.

Eksempel på innsendingskall:

```bash
curl -X POST "$LUMI_API_HOST/api/tokenx/v1/feedback" \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d @payload.json
```

## Token exchange (backend)

Dette gjøres server-side i din app. Hvilken flow du bruker avhenger av flaten:

### TokenX (sluttbruker-flater)

1) Motta `submission.transportPayload` fra widgeten
2) Kall TokenX for OBO-token mot `lumi-api`
3) POST payload til `/api/tokenx/v1/feedback`

```ts
// Pseudokode (Node/Next)
const payload = await req.json();
const token = await tokenxExchangeFor("lumi-api");

const res = await fetch(`${process.env.LUMI_API_HOST}/api/tokenx/v1/feedback`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!res.ok) throw new Error("Failed to submit feedback");
```

### AzureAD (veileder-/Modia-/fagsystem)

1) Motta `submission.transportPayload`
2) Kall AzureAD for OBO-token mot `lumi-api`
3) POST payload til `/api/azure/v1/feedback`

```ts
// Pseudokode (Node/Next)
const payload = await req.json();
const token = await azureOboFor("lumi-api");

const res = await fetch(`${process.env.LUMI_API_HOST}/api/azure/v1/feedback`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(payload),
});
```

<details>
<summary><strong>🔐 Sikkerhet og tilgang</strong></summary>

## 🔐 Sikkerhet og tilgang

Dette API-et følger NAIS Zero Trust-prinsipper. Begge parter må konfigurere tilgangspolicyer.

### For team som vil sende inn tilbakemeldinger

For å sende inn tilbakemeldinger fra din applikasjon trenger du:

#### 1. Be om tilgang (vår side)

Opprett en issue i dette repoet med templaten **"Request API Access"**, eller lag en PR som legger appen din til i vår NAIS-konfig:

```yaml
# In nais/app/dev.yaml and nais/app/prod.yaml
spec:
  azure:
    application:
      accessPolicy:
        inbound:
          rules:
            - application: your-app-name
              namespace: your-team
```

#### 2. Konfigurer outbound (din side)

Legg til `lumi-api` i appens outbound-tilgangspolicy:

```yaml
# In your app's nais.yaml
spec:
  accessPolicy:
    outbound:
      rules:
        - application: lumi-api
          namespace: team-esyfo
```

#### 3. Hent token (TokenX / AzureAD)

Innsending er splittet på issuer. Bruk endepunktet som matcher autentiseringsmodellen din:

**TokenX (sluttbruker-flater)**

- Endepunkt: `POST /api/tokenx/v1/feedback`
- Token: TokenX-token som har audience mot `lumi-api`
- Caller identity claim: `client_id` (format `cluster:namespace:app`)

**AzureAD (veileder/Modia/fagsystem)**

- Endepunkt: `POST /api/azure/v1/feedback`
- Token: Azure AD-token som har audience mot `lumi-api`
- Caller identity claim: `azp_name` (format `cluster:namespace:app`)

Alle kall må inkludere:

```
Authorization: Bearer <token>
```

Merk: Innsending-endepunktene lagrer ikke NAVident.

### Tilgang til analyse-endepunkter

Denne seksjonen gjelder tilgang til analyse-endepunktene (dashboard).

Backenden autoriserer dashboard-tilgang ved å slå opp teammedlemskap via NAIS Console GraphQL API, basert på brukerens e-post fra Azure-token claims (f.eks. `preferred_username`).

Hvis NAIS team-oppslag ikke er konfigurert, feiler API-et lukket med **503** (`TEAM_LOOKUP_NOT_CONFIGURED`).

**Lokal testing:**

For å teste NAIS team-oppslag lokalt trenger du normalt en gyldig `NAIS_API_KEY` (eller `TEAMS_TOKEN`).
Klienten autentiserer mot NAIS Console GraphQL med `Authorization: Bearer <token>`.

Hvis du er logget inn med NAIS CLI kan du også bruke lokal NAIS API-proxy for å kalle GraphQL-endepunktet uten en ekte nøkkel:

```bash
nais login -n
nais alpha api proxy  # listens on localhost:4242

# Proxy videresender til https://console.nav.cloud.nais.io/graphql
export NAIS_API_GRAPHQL_URL='http://localhost:4242/graphql'

# Må være ikke-tom for å aktivere integrasjonen i denne appen.
# Proxyen aksepterer forespørsler selv om dette ikke er en ekte nøkkel.
export NAIS_API_KEY='dummy'

./gradlew run
```

```bash
export NAIS_API_GRAPHQL_URL='https://console.nav.cloud.nais.io/graphql'
export NAIS_API_KEY='<dev-api-key>'

./gradlew run
```

**Slik fungerer det:**

1. Når en bruker logger inn, henter backenden ut e-post fra Azure-tokenet
2. NAIS Console API spørres om brukerens teammedlemskap
3. Resultater caches for å redusere last (separate TTL-er for "har team" vs "har ingen team")
4. Hvis API-kallet feiler, gis ikke tilgang (fail closed)

**Observability:**

NAIS API-integrasjonen eksponerer Prometheus-metrikker på `/internal/prometheus`:

| Metrikk | Beskrivelse |
|--------|-------------|
| `nais_api_calls_total` | Antall NAIS API-kall |
| `nais_api_errors_total` | Antall NAIS API-feil |
| `nais_api_call_duration_seconds` | Varighet på NAIS API-kall |
| `nais_api_cache_hits_total` | Antall cache-treff |
| `nais_api_cache_misses_total` | Antall cache-miss |
| `nais_api_viewer_user_type_total` | Antall ganger `me`-query ga `User` (bør normalt være 0 med service account-token) |
| `team_authorization_viewer_fallback_total{reason=\"missing_email_claim\"}` | Fallback til viewer pga manglende e-postclaim i bruker-token |
| `team_authorization_viewer_fallback_total{reason=\"empty_user_lookup\"}` | Fallback til viewer etter tomt `user(email)`-oppslag |

**Notater:**

- Team-identifikatorer i query-parametre er NAIS namespace-slugs (f.eks. `team-esyfo`).
- API-et returnerer **403** (`NO_TEAM_ACCESS`) hvis NAIS ikke finner noen team for brukeren.

</details>


## Rensing av sensitive data

API-et maskerer automatisk sensitive data i fritekst:

| Mønster | Eksempel | Erstatning |
|---------|---------|-------------|
| Fødselsnummer | 12345678901 | `[FØDSELSNUMMER FJERNET]` |
| NAVident | A123456 | `[NAVIDENT FJERNET]` |
| E-post | test@nav.no | `[E-POST FJERNET]` |
| Telefon | 12345678 | `[TELEFON FJERNET]` |
| Kortnummer | 1234 5678 9012 3456 | `[KORTNUMMER FJERNET]` |
| Kontonummer | 1234.56.12345 | `[KONTONUMMER FJERNET]` |
| Hemmelig adresse | "hemmelig adresse" | `[HEMMELIG ADRESSE]` |

<details>
<summary><strong>Utvikling</strong></summary>

## Utvikling

### Forutsetninger

- JDK 21
- Docker (for PostgreSQL)

### Kjør lokalt

```bash
# Start PostgreSQL
docker run -d --name lumi-db \
  -e POSTGRES_USER=lumi \
  -e POSTGRES_PASSWORD=lumi \
  -e POSTGRES_DB=lumi \
  -p 5432:5432 \
  postgres:17

# Kjør applikasjonen
./gradlew run
```

### Bygg

```bash
./gradlew build
```

### Tester

```bash
./gradlew test
```

</details>

<details>
<summary><strong>Deploy</strong></summary>

## Deploy

Deployes til NAIS via GitHub Actions.

```bash
# Dev
kubectl apply -f nais/app/dev.yaml

# Prod
kubectl apply -f nais/app/naiserator.yaml
```

</details>

<details>
<summary><strong>Teknologstack</strong></summary>

## Teknologistack

- **Ktor** - Kotlin web-rammeverk
- **PostgreSQL** - Database
- **Flyway** - Databasemigreringer
- **HikariCP** - Connection pooling
- **kotlinx.serialization** - JSON-serialisering
- **Apache POI** - Excel-eksport
- **nav-token-support** - Validering av Azure AD / TokenX

</details>
