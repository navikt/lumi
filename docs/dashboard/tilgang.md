---
title: Tilgang
---

# Tilgang

Lumi-dashboardet er tilgjengelig for NAV-ansatte som er medlem av et NAIS-team som har data i Lumi.

## Autentisering

Dashboardet bruker **Wonderwall + Microsoft Entra ID (Azure AD)** for innlogging:

1. Du åpner dashboardet i nettleseren.
2. Wonderwall (NAIS-sidecar) oppdager at du ikke har en gyldig sesjon og sender deg til Azure AD-innlogging.
3. Etter innlogging legger Wonderwall et token på alle forespørsler.
4. Dashboardet bytter til et OBO-token (On-Behalf-Of) for å kalle backend-API-et på vegne av deg.

::: info Ingen manuell konfigurasjon
Du trenger ikke sette opp noe selv — innlogging skjer automatisk første gang du åpner dashboardet.
:::

## Autorisasjon (team-tilgang)

Dashboardet viser kun data som tilhører teamene dine. Autorisasjon fungerer slik:

1. Backend leser e-posten din fra Azure AD-tokenet.
2. E-posten slås opp mot **NAIS Console GraphQL API** for å finne hvilke team du er medlem av.
3. Kun data tilhørende dine team er tilgjengelig — alle database-spørringer er scopet til det valgte teamet.

Hvis du ikke er medlem av et NAIS-team som har data i Lumi, får du en feilmelding.

::: tip Mangler du tilgang?
Sjekk at du er lagt til som medlem i riktig NAIS-team via [NAIS Console](https://console.nav.cloud.nais.io). Teammedlemskap caches i opptil 1 time, så det kan ta litt tid før endringer trer i kraft.
:::

### Fail closed

Dersom NAIS Console API er utilgjengelig, returnerer backend **503** — ingen data lekker. Systemet er designet for å feile lukket fremfor å gi utilsiktet tilgang.

## Dashboard-URLer

| Miljø | URL |
| :--- | :--- |
| Dev | https://lumi-dashboard.ansatt.dev.nav.no |
| Prod | https://lumi-dashboard.ansatt.nav.no |

Begge krever Nav-innlogging (Azure AD). Dev-miljøet bruker Nav sitt dev-AD-tenant.

## Se også

- [Sikkerhetsarkitektur](/sikkerhet/arkitektur) — detaljer om autorisasjonslagene
- [API-endepunkter](/referanse/api-endepunkter) — teknisk referanse for backend-API-et
