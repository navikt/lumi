---
title: API-endepunkter
---

# API-endepunkter

Referanse for endepunktene du bruker når du integrerer Lumi. API-et kjører som intern NAIS-tjeneste (ingen offentlig ingress).

## Innsending

Disse endepunktene brukes av klientapplikasjoner som sender inn tilbakemeldinger. Kallet er backend-til-backend via token exchange.

| Endepunkt | Auth | Bruk |
| :--- | :--- | :--- |
| `POST /api/tokenx/v1/feedback` | TokenX | Sluttbruker-flater (nav.no) |
| `POST /api/azure/v1/feedback` | Azure AD | Veileder-/Modia-/fagsystem-flater |

::: info Integrasjonsmønster
Token exchange skjer server-side i din backend. Se [Koble til backend](/kom-i-gang/koble-til-backend) for oppsett.
:::

## Autentisering

| Flate | Token | Endepunkt | Caller identity |
| :--- | :--- | :--- | :--- |
| Sluttbruker (nav.no) | TokenX | `/api/tokenx/v1/feedback` | `client_id` (`cluster:namespace:app`) |
| Intern (Modia, fagsystemer) | Azure AD | `/api/azure/v1/feedback` | `azp_name` (`cluster:namespace:app`) |

Se [Koble til backend](/kom-i-gang/koble-til-backend) for oppsett av token exchange.

## Se også

- [Datakontrakt](/referanse/datakontrakt) — payload-struktur for innsending
- [Koble til backend](/kom-i-gang/koble-til-backend) — oppsett av token exchange og backend-integrasjon
