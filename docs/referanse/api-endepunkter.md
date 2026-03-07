---
title: API-endepunkter
---

# API-endepunkter

Komplett referanse for Lumi API-et. API-et er bygget med Ktor og kjører som intern NAIS-tjeneste (ingen offentlig ingress).

## Innsending

Disse endepunktene brukes av klientapplikasjoner som sender inn tilbakemeldinger. Kallet er backend-til-backend via token exchange.

| Endepunkt | Auth | Bruk |
| :--- | :--- | :--- |
| `POST /api/tokenx/v1/feedback` | TokenX | Sluttbruker-flater (nav.no) |
| `POST /api/azure/v1/feedback` | Azure AD | Veileder-/Modia-/fagsystem-flater |

::: info Integrasjonsmønster
Token exchange skjer server-side i din backend. Se [Koble til backend](/kom-i-gang/koble-til-backend) for oppsett.
:::

### Eksempel: Send inn tilbakemelding

```bash
curl -X POST https://lumi-api.intern.nav.no/api/azure/v1/feedback \
  -H "Authorization: Bearer $OBO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "surveyId": "sykepenger-rating",
    "surveyType": "rating",
    "context": {
      "app": "sykepenger-frontend",
      "pathname": "/sykepenger"
    },
    "answers": [
      {
        "fieldId": "rating",
        "fieldType": "RATING",
        "question": { "label": "Hvordan var opplevelsen din?" },
        "value": { "type": "rating", "rating": 4 }
      }
    ]
  }'
```

Se [datakontrakten](/referanse/datakontrakt) for full payload-struktur.

## Analyse & dashboard {#analyse}

Alle endepunkter under `/api/v1/intern/*` krever Azure AD-token og er scopet til brukerens team.

### Tilbakemeldinger

| Endepunkt | Metode | Beskrivelse |
| :--- | :--- | :--- |
| `/api/v1/intern/feedback` | `GET` | Liste over tilbakemeldinger med filtre |
| `/api/v1/intern/feedback/{id}` | `GET` | Hent én tilbakemelding |
| `/api/v1/intern/feedback/{id}` | `DELETE` | Slett tilbakemelding permanent |
| `/api/v1/intern/feedback/{id}/tags` | `POST` | Legg til tag |
| `/api/v1/intern/feedback/{id}/tags?tag=X` | `DELETE` | Fjern tag |
| `/api/v1/intern/feedback/tags` | `GET` | List alle tags |

### Team og apper

| Endepunkt | Metode | Beskrivelse |
| :--- | :--- | :--- |
| `/api/v1/intern/teams` | `GET` | List autoriserte team og apper |
| `/api/v1/intern/feedback/teams` | `GET` | List apper for valgt team |

### Statistikk

| Endepunkt | Metode | Beskrivelse |
| :--- | :--- | :--- |
| `/api/v1/intern/stats/dashboard` | `GET` | Dashboard-oversiktsstatistikk |
| `/api/v1/intern/stats/ratings` | `GET` | Fordeling av rating |
| `/api/v1/intern/stats/timeline` | `GET` | Tidslinjedata |

### Administrasjon

| Endepunkt | Metode | Beskrivelse |
| :--- | :--- | :--- |
| `/api/v1/intern/surveys/{surveyId}` | `DELETE` | Slett alle tilbakemeldinger for en survey |

### Eksport

| Endepunkt | Metode | Beskrivelse |
| :--- | :--- | :--- |
| `/api/v1/intern/export?format=csv\|json\|excel` | `GET` | Eksportér data i valgt format |

### Eksempel: Hent dashboard-statistikk

```bash
curl "https://lumi-api.intern.nav.no/api/v1/intern/stats/dashboard?team=flex&app=spinnsyn&fromDate=2026-01-01&toDate=2026-01-31" \
  -H "Authorization: Bearer $OBO_TOKEN"
```

### Eksempel: Hent tilbakemeldinger med filtre

```bash
curl "https://lumi-api.intern.nav.no/api/v1/intern/feedback?team=flex&app=spinnsyn&hasText=true&lowRating=true&page=0&size=20" \
  -H "Authorization: Bearer $OBO_TOKEN"
```

### Eksempel: Eksportér som CSV

```bash
curl "https://lumi-api.intern.nav.no/api/v1/intern/export?format=csv&team=flex&fromDate=2026-01-01&toDate=2026-01-31" \
  -H "Authorization: Bearer $OBO_TOKEN" \
  -o tilbakemeldinger.csv
```

## Query-parametre {#query-parametre}

Alle analyse-endepunkter støtter følgende query-parametre:

| Parameter | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `team` | `string` | _(velges av backend)_ | Team-scope. Utelatt → standardteam. Ugyldig → **403**. |
| `app` | `string` | — | Filtrer på app |
| `fromDate` | `YYYY-MM-DD` | — | Startdato (Europe/Oslo, inklusiv) |
| `toDate` | `YYYY-MM-DD` | — | Sluttdato (Europe/Oslo, inklusiv) |
| `surveyId` | `string` | — | Filtrer på survey-ID |
| `hasText` | `boolean` | `false` | Kun tilbakemeldinger med fritekst |
| `lowRating` | `boolean` | `false` | Kun lave ratinger (1–2) |
| `tag` | `string[]` | — | Gjentatt `tag=foo&tag=bar` (aksepterer også kommaseparert) |
| `query` | `string` | — | Fulltekstsøk |
| `page` | `int` | `0` | Side (0-indeksert) |
| `size` | `int` | `10` | Sidestørrelse |
| `deviceType` | `string` | — | `mobile`, `tablet` eller `desktop` |
| `segment` | `string[]` | — | Gjentatt `segment=key:value` |
| `task` | `string` | — | Top Tasks drill-down filter |

::: tip Team-parameteren
Hvis du utelater `team`, velger backend automatisk standardteamet for brukeren. Sender du et team brukeren ikke har tilgang til, får du **403 Forbidden**.
:::

## Autentisering og autorisasjon

### Innsending

| Flate | Token | Endepunkt | Caller identity |
| :--- | :--- | :--- | :--- |
| Sluttbruker (nav.no) | TokenX | `/api/tokenx/v1/feedback` | `client_id` (`cluster:namespace:app`) |
| Intern (Modia, fagsystemer) | Azure AD | `/api/azure/v1/feedback` | `azp_name` (`cluster:namespace:app`) |

### Analyse

Analyse-endepunktene krever tre autorisasjonslag:

1. **Azure AD-autentisering** — gyldig token
2. **Client-autorisasjon** — kun dashboardet har tilgang
3. **Team-autorisasjon** — brukerens NAIS-teammedlemskap verifiseres

Se [tilgang](/dashboard/tilgang) og [sikkerhetsarkitektur](/referanse/sikkerhet) for mer detaljer.

## Se også

- [Datakontrakt](/referanse/datakontrakt) — payload-struktur for innsending
- [Filtrering](/dashboard/filtrering) — hvordan filtrene brukes i dashboardet
- [Eksport](/dashboard/eksport) — eksportformater
