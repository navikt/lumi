---
name: access-management
description: Gi nye apper tilgang til Lumi feedback — ruter Azure via proxy og TokenX direkte til API
---

# Tilgangsstyring for Lumi

Bruk denne skillen når en ny applikasjon trenger tilgang til å sende inn feedback til Lumi. Forespørsler kommer typisk inn som GitHub Issues med label `access-policy` eller `access-request`.

## Relatert dokumentasjon

- **Onboarding-guide** (ekstern): `docs/kom-i-gang/koble-til-backend.md` — steg-for-steg for team som integrerer
- **Issue-template**: `apps/lumi-api/.github/ISSUE_TEMPLATE/access-request.md` — mal for tilgangsforespørsler
- **Feilsøking**: `docs/guider/feilsoking.md` — 403-feil og access policy-debugging

Onboarding-guiden instruerer team om å opprette en issue med app-navn, namespace, cluster og **auth-type** (TokenX / AzureAD). Bruk auth-type fra issuet til å bestemme riktig rute nedenfor.

## Arkitektur

Lumi har to innsendingsveier avhengig av auth-type:

```
TokenX-app (sluttbruker)    →  lumi-api       POST /api/tokenx/v1/feedback
Azure-app (internt verktøy) →  lumi-proxy     POST /api/azure/v1/feedback  →  lumi-api (internt)
```

Dashboard-/analysetilgang (lese feedback, statistikk, eksport) håndteres separat med Azure + team-autorisasjon direkte mot lumi-api.

## Rutingstabell

| Auth-type | Rute | Endepunkt kaller bruker | NAIS-manifest å endre |
|---|---|---|---|
| **TokenX** | Direkte til `lumi-api` | `POST /api/tokenx/v1/feedback` | `apps/lumi-api/nais/app/{env}.yaml` |
| **Azure AD** | Via `lumi-submission-proxy` | `POST /api/azure/v1/feedback` | `apps/lumi-submission-proxy/nais/dev.yaml` |

## Fremgangsmåte

### 1. Identifiser auth-type fra issue

Tilgangsforespørsler inneholder typisk:
- **App-navn** og **namespace** (alltid oppgitt)
- **Auth-type**: TokenX eller AzureAD (sjekk issue-body, feltet «Auth»)
- **Cluster**: dev-gcp og/eller prod-gcp

Hvis auth-type mangler i issuet: sjekk om appen bruker TokenX (sluttbrukerflater som nav.no) eller Azure AD (interne verktøy som Modia/veiledersystemer). Spør om uklart.

### 2a. TokenX-app → Direkte til lumi-api

Legg til i `apps/lumi-api/nais/app/dev.yaml` under `spec.accessPolicy.inbound.rules`:

```yaml
        - application: {app-name}
          namespace: {team-namespace}  # utelat hvis samme namespace (team-esyfo)
```

Legg til i `prod.yaml` også hvis issuet ber om prod-tilgang.

**Appen kaller**: `POST /api/tokenx/v1/feedback` med TokenX bearer token.

### 2b. Azure-app → Via submission proxy

Legg til i `apps/lumi-submission-proxy/nais/dev.yaml` under `spec.accessPolicy.inbound.rules`:

```yaml
        - application: {app-name}
          namespace: {team-namespace}
```

**Appen kaller**: `POST /api/azure/v1/feedback` på proxyen med Azure AD bearer token.

Proxyen validerer tokenet via Texas (Entra ID), henter `azp_name`-claim, og videresender til lumi-api internt.

> **NB**: Proxy finnes kun i dev (`apps/lumi-submission-proxy/nais/dev.yaml`). Hvis prod-tilgang trengs, må proxy deployes til prod først — se ⚠️ Ask First.

### 3. Commit og issue-håndtering

Commit med semantisk melding:
```
feat(nais): grant {app-name} access to lumi feedback submission
```

Hvis issuet har et nummer, inkluder `Closes #{nummer}` i commit eller PR-beskrivelsen.

## Manifestfiler

| Fil | Formål |
|---|---|
| `apps/lumi-api/nais/app/dev.yaml` | TokenX-klienter (dev) + analytikk-klienter |
| `apps/lumi-api/nais/app/prod.yaml` | TokenX-klienter (prod) + analytikk-klienter |
| `apps/lumi-submission-proxy/nais/dev.yaml` | Azure-klienter via proxy (kun dev) |

## Rate limiting

Alle innsendingsendepunkter har rate limiting:
- **Per app**: 100 requests/minutt (basert på `client_id`/`azp_name`)
- **Per bruker**: 15 requests/minutt (basert på hashet `sub`-claim)

## Boundaries

### ✅ Always
- Identifiser auth-type (TokenX vs Azure) fra issuet før du endrer manifester
- Rut Azure-klienter via `lumi-submission-proxy`
- Rut TokenX-klienter direkte til `lumi-api`
- Legg til i dev først, verifiser, deretter prod
- Koble commit/PR til issuet med `Closes #nummer`

### ⚠️ Ask First
- Gi tilgang i prod
- Deploye proxy til prod (finnes kun i dev)
- Gi direkte `lumi-api`-tilgang til en Azure-klient (bruk proxy i stedet)

### 🚫 Never
- Gi tilgang uten å kjenne auth-type
- Legg til i prod uten dev-verifisering først
- Endre proxy-logikk uten å forstå intern submission-flyten
