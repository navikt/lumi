---
title: Koble til backend
---

# Koble til backend

Denne siden viser deg hvordan du setter opp backend-delen: token exchange, videresending til Lumi API, og NAIS access policies.

## Oversikt

Flyten ser slik ut:

1. Widgeten sender `submission.transportPayload` til **din** API-route
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

Legg til disse miljøvariablene i NAIS-manifestet til appen din:

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
```

::: tip AzureAD (OBO)
Bruker du AzureAD trenger du i tillegg `LUMI_API_AAD_APP_CLIENT_ID` — dette er Lumi API sin client ID som brukes som scope/audience ved token exchange:

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_API_AAD_APP_CLIENT_ID
      value: "<cluster>.team-esyfo.lumi-api"   # f.eks. dev-gcp.team-esyfo.lumi-api
```
:::

## 3. Aktiver auth i NAIS

Appen din trenger riktig auth-mekanisme aktivert. Legg til én av disse i NAIS-manifestet:

**Sluttbrukerflate (TokenX):**

```yaml
spec:
  tokenx:
    enabled: true
```

**Intern flate (AzureAD):**

```yaml
spec:
  azure:
    application:
      enabled: true
```

## 4. Implementer API-routen

Her er et eksempel for hver flate. Begge følger samme mønster: motta payload, gjør token exchange, videresend til Lumi API.

### Sluttbrukerflate (TokenX)

```ts
// API-route i din app (f.eks. /api/lumi/feedback)
export async function POST(req: Request) {
  const payload = await req.json();
  const token = await tokenxExchangeFor("lumi-api");

  const response = await fetch(
    `${process.env.LUMI_API_HOST}/api/tokenx/v1/feedback`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Lumi API svarte med ${response.status}`);
  }

  return new Response(null, { status: 204 });
}
```

### Intern flate (AzureAD / Modia)

```ts
// API-route i din app (f.eks. /api/lumi/feedback)
export async function POST(req: Request) {
  const payload = await req.json();
  const token = await azureOboFor("lumi-api");

  const response = await fetch(
    `${process.env.LUMI_API_HOST}/api/azure/v1/feedback`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Lumi API svarte med ${response.status}`);
  }

  return new Response(null, { status: 204 });
}
```

::: warning Token exchange-funksjoner
`tokenxExchangeFor` og `azureOboFor` i eksemplene over er pseudokode. Den faktiske implementasjonen avhenger av hvilket rammeverk du bruker. Sjekk [NAIS-dokumentasjonen for token exchange](https://docs.nais.io/auth/) for detaljer.
:::

## 5. Konfigurer access policies

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

Lumi-teamet må legge til din app som inbound. **Opprett en issue i [Lumi-repoet](https://github.com/navikt/lumi)** eller lag en PR som legger til din app:

```yaml
spec:
  accessPolicy:
    inbound:
      rules:
        - application: din-app
          namespace: ditt-team
```

## 6. Storage-strategi

Widgeten kan huske at brukeren har lukket surveyen. Velg strategi basert på flate:

| Flate | Strategi | Merknad |
| :--- | :--- | :--- |
| Sluttbruker (nav.no) | `consent` (default) | Bruker Nav consent API — ingen ekstra oppsett |
| Intern (Modia, fagsystemer) | `localStorage` | Ingen ekstra avhengigheter |
| Ingen persistering | `none` | Surveyen vises hver gang |

::: warning Interne flater
Default er `consent`, som krever Nav consent API (`window.webStorageController`). Uten dette vil widgeten ikke huske at brukeren lukket surveyen. Sett `storageStrategy: "localStorage"`:

```tsx
<LumiSurveyDock behavior={{ storageStrategy: "localStorage" }} />
```
:::

Se [Lagring](/bruk/lagring) for detaljer om cooldown og dismissal-logikk.

## Komplett sjekkliste

Før du deployer, verifiser at du har:

- [ ] Importert `@navikt/ds-css` og `@navikt/lumi-survey/styles.css`
- [ ] Implementert `transport.submit` som sender `submission.transportPayload` til din backend
- [ ] Token exchange i din API-route (TokenX eller AzureAD)
- [ ] Riktig endepunkt (`/api/tokenx/v1/feedback` eller `/api/azure/v1/feedback`)
- [ ] `LUMI_API_HOST` satt i NAIS-manifest
- [ ] Auth aktivert i NAIS (`tokenx.enabled` eller `azure.application.enabled`)
- [ ] Outbound access policy mot `lumi-api` i `team-esyfo`
- [ ] Inbound access policy i Lumi API (opprett issue/PR)
- [ ] Riktig `storageStrategy` (`consent` / `localStorage` / `none`)
- [ ] Testet ende-til-ende: innsending → data synlig i dashboard
