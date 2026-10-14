---
title: API-endepunkter
---

# API-endepunkter

Lumi API kjører som en intern Nais-tjeneste uten offentlig ingress.

## Innsending

Appene kaller disse endepunktene fra sin egen backend.

| Endepunkt | Autentisering | Brukes av |
| :--- | :--- | :--- |
| `POST /api/tokenx/v1/feedback` | TokenX | Apper for sluttbrukere (nav.no) |
| `POST /api/azure/v1/feedback` | Entra ID | Veilederapper, Modia og fagsystemer |

::: info Integrasjonsmønster
Backenden deres veksler token før kallet. Se [Koble til backend](/kom-i-gang/koble-til-backend) for oppsett.
:::

## Autentisering

| App | Token | Endepunkt | Kalleren identifiseres med |
| :--- | :--- | :--- | :--- |
| For sluttbrukere (nav.no) | TokenX | `/api/tokenx/v1/feedback` | `client_id` (`cluster:namespace:app`) |
| Intern (Modia, fagsystemer) | Entra ID | `/api/azure/v1/feedback` | `azp_name` (`cluster:namespace:app`) |

Se [Koble til backend](/kom-i-gang/koble-til-backend) for oppsett av tokenvekslingen.

## Se også

- [Datakontrakt](/referanse/datakontrakt): strukturen på dataene som sendes inn
- [Koble til backend](/kom-i-gang/koble-til-backend): oppsett av tokenveksling og backend
