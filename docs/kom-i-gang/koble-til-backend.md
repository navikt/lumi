---
title: Koble til backend
---

# Koble til backend

Denne siden viser deg hvordan du setter opp backend-delen: token exchange, videresending til Lumi API, og NAIS access policies.

## Oversikt

Flyten ser slik ut:

1. Widgeten sender `submission.transportPayload` til **ditt** server-side endepunkt
2. Din backend gjør **token exchange** (TokenX eller AzureAD)
3. Din backend videresender payloaden til **Lumi API** med det nye tokenet

::: info Hvorfor token exchange?
Widgeten kjører i brukerens nettleser og har ikke tilgang til maskin-til-maskin-tokens. Din backend gjør token exchange slik at Lumi API kan verifisere at kallet er autentisert og autorisert.
:::

## 1. Velg riktig endepunkt

Hvilket endepunkt du bruker avhenger av hvem brukeren er:

| Flate | Auth-mekanisme | Endepunkt |
| :--- | :--- | :--- |
| **Sluttbruker** (nav.no, arbeidsgiver, privatperson) | TokenX | `POST /api/tokenx/v1/feedback` |
| **Intern** (Modia, veiledersystemer, fagsystemer) | AzureAD (OBO) | `POST /api/azure/v1/feedback` |

## 2. Sett miljøvariabler i NAIS

### TokenX (sluttbrukerflater)

**Produksjon:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "prod-gcp:team-esyfo:lumi-api"
```

**Dev:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "dev-gcp:team-esyfo:lumi-api"
```

### AzureAD (interne flater)

**Produksjon:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "api://prod-gcp.team-esyfo.lumi-api/.default"
```

**Dev:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-submission-proxy.team-esyfo
    - name: LUMI_AUDIENCE
      value: "api://dev-gcp.team-esyfo.lumi-submission-proxy/.default"
```

::: warning Tenant-mismatch i dev
Lumi API bruker Azure-tenant `nav.no`. Hvis appen din bruker tenant `trygdeetaten.no` i dev (f.eks. Modia-apper), kan ikke AzureAD OBO-tokens krysse tenantgrensen. I dev må du derfor rute trafikken via `lumi-submission-proxy` — en proxyapp som brokerer mellom tenantene.

I **prod** bruker alle apper `nav.no`-tenant, og du kan kalle `lumi-api` direkte.
:::

## 3. Send inn svar til Lumi API

Widgeten gir deg en `transportPayload` som du sender videre til Lumi API fra server-side. Her er et eksempel med [`@navikt/oasis`](https://github.com/navikt/oasis) for token exchange:

```ts
import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import { requestOboToken } from "@navikt/oasis";

export async function submitFeedback(
  token: string,
  payload: LumiSurveyTransportPayload,
) {
  const obo = await requestOboToken(token, process.env.LUMI_AUDIENCE);
  if (!obo.ok) throw new Error("Token exchange feilet");

  const response = await fetch(
    `${process.env.LUMI_API_HOST}/api/tokenx/v1/feedback`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${obo.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Lumi API svarte med ${response.status}`);
  }
}
```

## 4. Konfigurer access policies

Begge parter må konfigurere tilgangspolicyer (Zero Trust).

### Din app (outbound)

Legg til i ditt NAIS-manifest:

```yaml
spec:
  accessPolicy:
    outbound:
      rules:
        - application: lumi-api
          namespace: team-esyfo
```

### Lumi API (inbound)

Team eSyfo må legge til din app som inbound. [**Opprett en issue**](https://github.com/navikt/lumi/issues/new?template=access-request.yml) med app-navn, namespace og auth-type, så ordner vi resten:

```yaml
spec:
  accessPolicy:
    inbound:
      rules:
        - application: din-app
          namespace: ditt-team
```

## 5. Storage-strategi

Widgeten kan huske at brukeren har lukket surveyen, slik at den ikke dukker opp igjen på en gitt periode (cooldown). Velg strategi basert på flate:

| Flate | Strategi | Merknad |
| :--- | :--- | :--- |
| Sluttbruker (nav.no) | `consent` (default) | Bruker Nav consent API — ingen ekstra oppsett |
| Intern (Modia, fagsystemer) | `localStorage` | Ingen ekstra avhengigheter |
| Ingen persistering | `none` | Surveyen vises hver gang |

::: warning Interne flater
Default er `consent`, som kun fungerer på sluttbrukerflater på nav.no. For interne flater, sett `storageStrategy: "localStorage"`:

```tsx
<LumiSurveyDock behavior={{ storageStrategy: "localStorage" }} />
```
:::

Se [Lagring](/guider/lagring) for detaljer om cooldown og dismissal-logikk.

## Komplett sjekkliste

Før du deployer, verifiser at du har:

- [ ] Importert `@navikt/ds-css` og `@navikt/lumi-survey/styles.css`
- [ ] Implementert `transport.submit` som sender `submission.transportPayload` til din backend
- [ ] Token exchange i ditt endepunkt (TokenX eller AzureAD)
- [ ] Riktig endepunkt (`/api/tokenx/v1/feedback` eller `/api/azure/v1/feedback`)
- [ ] `LUMI_API_HOST` og `LUMI_AUDIENCE` satt i NAIS-manifest
- [ ] Outbound access policy mot `lumi-api` i `team-esyfo`
- [ ] Inbound access policy i Lumi API ([opprett issue](https://github.com/navikt/lumi/issues/new?template=access-request.yml))
- [ ] Riktig `storageStrategy` (`consent` / `localStorage` / `none`)
- [ ] Testet i dev — innsending → data synlig i dashboardet

## Test i dev

Deploy appen din til dev-gcp og verifiser at surveyen fungerer ende-til-ende:

1. Åpne appen din i dev og send inn et survey-svar
2. Sjekk at svaret dukker opp i [dashboardet (dev)](https://lumi-dashboard.ansatt.dev.nav.no)

Hvis innsendingen feiler, sjekk [Feilsøking](/guider/feilsoking) for vanlige problemer.

## Videre lesing

Du er i gang! 🎉 Her er noen nyttige guider for å tilpasse Lumi videre:

- [Surveytyper](/guider/surveytyper) — velg riktig type for ditt bruksområde
- [Spørsmålstyper](/guider/sporsmalstyper) — rating, tekst, radio og flervalg
- [Betinget synlighet](/guider/betinget-synlighet) — vis spørsmål basert på tidligere svar
- [Context og tags](/guider/context-og-tags) — legg til metadata for filtrering i dashboardet
