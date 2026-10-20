---
title: Koble til backend
---

# Koble til backend

::: tip Be om tilgang først
Svarene kommer ikke fram før Team eSyfo har lagt appen deres inn som inbound
hos mottakeren i Lumi. Det er det eneste steget der dere må vente på andre.
Send [en PR eller en tilgangsforespørsel](#mottakeren-inbound) før dere gjør
resten.
:::

Svaret går fra widgeten via appens backend til Lumi API:

1. Widgeten sender `submission.transportPayload` til et endepunkt i appens backend.
2. Backenden bytter brukerens token mot et nytt token for Lumi API med TokenX
   eller Entra ID. Dette kalles tokenveksling.
3. Backenden sender payloaden videre til Lumi API med det nye tokenet.

::: info Hvorfor tokenveksling?
Widgeten kjører i brukerens nettleser og kan ikke selv hente et token til Lumi
API. Tokenet backenden får fra innloggingen, gjelder bare for appen deres. Etter
tokenvekslingen har backenden et token med Lumi API som mottaker (audience). Fra
det leser Lumi API hvilket team og hvilken app som sendte svaret.
:::

## 1. Velg riktig endepunkt

Endepunktet avhenger av hvem som bruker appen:

| App | Tokenveksling | Endepunkt |
| :--- | :--- | :--- |
| For sluttbrukere (nav.no, arbeidsgiver, privatperson) | TokenX | `POST /api/tokenx/v1/feedback` |
| Intern (Modia, veiledersystemer, fagsystemer) | Entra ID (OBO) | `POST /api/azure/v1/feedback` |

### Interne apper og Modia {#interne-apper}

Interne apper veksler token med Entra ID. Der heter tokenvekslingen
on-behalf-of (OBO). I prod kaller alle interne apper `lumi-api` direkte. I dev
avhenger det av hvilken Entra ID-tenant appen bruker:

- `nav.no`: appen kaller `lumi-api` direkte, som i prod
- `trygdeetaten.no`, slik Modia-apper gjør: appen sender svarene til `lumi-submission-proxy`

Lumi API ligger i tenanten `nav.no`, og et OBO-token gjelder bare innenfor én
tenant. Proxyen ligger i `trygdeetaten.no`, sjekker tokenet og sender svaret
videre til Lumi API. Den finnes bare i dev-gcp.

Tenanten står i `spec.azure.application.tenant` i Nais-manifestet. Hvis feltet
mangler, ser dere på brukeren dere logger inn med i dev: en bruker på
`@trygdeetaten.no` betyr tenanten `trygdeetaten.no`, og den vanlige Nav-brukeren
betyr `nav.no`. Er dere
fortsatt usikre, skriv det i tilgangsforespørselen.

Fra tokenet lagrer Lumi API bare team og app sammen med svaret. Nav-identen som
kan ligge i OBO-tokenet, blir verken brukt eller lagret. For å begrense antall
innsendinger per bruker holder Lumi API en hash av brukerens ID i minnet. Legg heller ikke Nav-ident eller andre personopplysninger i `context`.

## 2. Sett miljøvariabler i Nais {#_2-sett-miljøvariabler-i-nais}

Velg blokken som passer tokenvekslingen, miljøet og tenanten. Alle tre verdiene
må komme fra samme blokk.

### TokenX (apper for sluttbrukere)

**Produksjon:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "prod-gcp:team-esyfo:lumi-api"
    - name: LUMI_FEEDBACK_PATH
      value: /api/tokenx/v1/feedback
```

**Dev:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "dev-gcp:team-esyfo:lumi-api"
    - name: LUMI_FEEDBACK_PATH
      value: /api/tokenx/v1/feedback
```

### Entra ID (interne apper)

Hvilken dev-blokk dere skal bruke, står i [Interne apper og Modia](#interne-apper).

**Produksjon:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "api://prod-gcp.team-esyfo.lumi-api/.default"
    - name: LUMI_FEEDBACK_PATH
      value: /api/azure/v1/feedback
```

**Dev med `trygdeetaten.no`-tenant:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-submission-proxy.team-esyfo
    - name: LUMI_AUDIENCE
      value: "api://dev-gcp.team-esyfo.lumi-submission-proxy/.default"
    - name: LUMI_FEEDBACK_PATH
      value: /api/azure/v1/feedback
```

**Dev med `nav.no`-tenant:**

```yaml
spec:
  env:
    - name: LUMI_API_HOST
      value: http://lumi-api.team-esyfo
    - name: LUMI_AUDIENCE
      value: "api://dev-gcp.team-esyfo.lumi-api/.default"
    - name: LUMI_FEEDBACK_PATH
      value: /api/azure/v1/feedback
```

## 3. Send inn svar til Lumi API {#_3-send-inn-svar-til-lumi-api}

Backenden henter, validerer og veksler token med
[`@navikt/oasis`](https://github.com/navikt/oasis):

```sh
pnpm add @navikt/oasis
```

`@navikt/oasis` ligger i GitHub Package Registry og ikke på npmjs. Appen
trenger derfor disse linjene i `.npmrc`, der `NPM_AUTH_TOKEN` er et GitHub-token
med `read:packages`. Tokenet må også være tilgjengelig når appen bygges i CI.

```ini
@navikt:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

### Next.js App Router med TokenX

Lag ruten `app/api/lumi/feedback/route.ts`. Den tar imot `transportPayload` fra
widgeten, sjekker brukerens token, veksler det og sender svaret videre:

```ts
import {
  getToken,
  requestTokenxOboToken,
  validateIdportenToken,
} from "@navikt/oasis";

export async function POST(request: Request) {
  const host = process.env.LUMI_API_HOST;
  const audience = process.env.LUMI_AUDIENCE;
  const feedbackPath = process.env.LUMI_FEEDBACK_PATH;
  if (!host || !audience || !feedbackPath) {
    console.error("Lumi-konfigurasjon mangler");
    return new Response(null, { status: 500 });
  }

  const token = getToken(request);
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const validation = await validateIdportenToken(token);
  if (!validation.ok) {
    return new Response(null, { status: 401 });
  }

  const obo = await requestTokenxOboToken(token, audience);
  if (!obo.ok) {
    console.error("Tokenveksling feilet:", obo.error.message);
    return new Response(null, { status: 500 });
  }

  // transportPayload fra widgeten, sendt videre uendret
  const body = await request.text();

  let response: Response;
  let errorText = "";
  try {
    response = await fetch(`${host}${feedbackPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${obo.token}`,
        "Content-Type": "application/json",
      },
      body,
      // Gi opp før widgeten, som venter i ti sekunder
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      errorText = await response.text();
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("Lumi API svarte ikke:", error);
    return new Response(null, { status: timedOut ? 504 : 502 });
  }

  if (!response.ok) {
    console.error(`Lumi API svarte med ${response.status}: ${errorText}`);
  }

  const headers = new Headers();
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    headers.set("Retry-After", retryAfter);
  }
  return new Response(null, { status: response.status, headers });
}
```

Slik virker ruten:

- Innloggingen i Nais legger brukerens token i `Authorization`-headeren på alle
  kall til backenden. Med ID-porten slår dere den på med
  `idporten.enabled: true` og `idporten.sidecar.enabled: true`. `getToken(request)` henter tokenet fra
  headeren.
- `validateIdportenToken` sjekker at tokenet er gyldig og laget for appen deres.
- `requestTokenxOboToken` veksler tokenet til et token for Lumi API. Appen må ha
  `tokenx.enabled: true` i Nais-manifestet.
- Ruten sender statuskoden fra Lumi API videre til nettleseren, så dere ser den
  i nettverksfanen. Feilmeldingen fra Lumi API står i loggen.
- `Retry-After` sendes videre, så widgeten kan vente så lenge Lumi API ber om
  før den prøver igjen. Se
  [Tidsgrense og nytt forsøk](/kom-i-gang/konfigurer-survey#tidsgrense-og-nytt-forsok).
- Svarer ikke Lumi API innen åtte sekunder, gir ruten opp, logger
  `Lumi API svarte ikke` og svarer 504. Widgeten venter i ti sekunder på hele
  kallet til backenden. Bruker tokenvekslingen mer enn to sekunder, gir
  widgeten opp først.

Har appen `basePath` i `next.config`, ligger ruten under den stien. Se
[Next.js App Router](/kom-i-gang/konfigurer-survey#next-js) for hvordan
`transport` kaller den.

::: warning `requestOboToken` med både TokenX og Entra ID
`@navikt/oasis` har også `requestOboToken`, som velger TokenX eller Entra ID ut
fra miljøvariablene i Nais. Har appen begge slått på, returnerer den alltid en
feil. Bruk derfor `requestTokenxOboToken` eller `requestAzureOboToken`.
`validateToken` har samme begrensning når appen har både ID-porten og Entra ID.
:::

### Express med TokenX {#express}

I en Express-backend er ruten den samme, men `getToken` får `req` fra Express.
Sett grensen i `express.json()` til 1 MB, som er grensen i Lumi API. Standarden
i Express er 100 kB.

```ts
import express from "express";
import {
  getToken,
  requestTokenxOboToken,
  validateIdportenToken,
} from "@navikt/oasis";

const app = express();

app.post(
  "/api/lumi/feedback",
  express.json({ limit: "1mb" }),
  async (req, res) => {
    try {
      const token = getToken(req);
      if (!token) {
        res.sendStatus(401);
        return;
      }

      const validation = await validateIdportenToken(token);
      if (!validation.ok) {
        res.sendStatus(401);
        return;
      }

      const obo = await requestTokenxOboToken(
        token,
        process.env.LUMI_AUDIENCE ?? "",
      );
      if (!obo.ok) {
        console.error("Tokenveksling feilet:", obo.error.message);
        res.sendStatus(500);
        return;
      }

      const response = await fetch(
        `${process.env.LUMI_API_HOST}${process.env.LUMI_FEEDBACK_PATH}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${obo.token}`,
            "Content-Type": "application/json",
          },
          // transportPayload fra widgeten, sendt videre uendret
          body: JSON.stringify(req.body),
          // Gi opp før widgeten, som venter i ti sekunder
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!response.ok) {
        console.error(
          `Lumi API svarte med ${response.status}: ${await response.text()}`,
        );
      }
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        res.set("Retry-After", retryAfter);
      }
      res.sendStatus(response.status);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      console.error(
        timedOut ? "Lumi API svarte ikke:" : "Innsending til Lumi feilet:",
        error,
      );
      res.sendStatus(timedOut ? 504 : 500);
    }
  },
);
```

`try`/`catch` trengs fordi Express 4 ikke fanger feil i asynkrone ruter.
`validateIdportenToken` kaster en feil når Nais-variablene for ID-porten mangler,
for eksempel lokalt.

### Interne apper med Entra ID

Ruten er den samme for en intern app. Dette er annerledes:

| | TokenX | Entra ID |
| :--- | :--- | :--- |
| Nais-manifestet | `idporten.enabled: true`, `idporten.sidecar.enabled: true` og `tokenx.enabled: true` | `azure.application.enabled: true` og `azure.sidecar.enabled: true` |
| Validering | `validateIdportenToken(token)` | `validateAzureToken(token)` |
| Tokenveksling | `requestTokenxOboToken(token, audience)` | `requestAzureOboToken(token, audience)` |
| `LUMI_FEEDBACK_PATH` | `/api/tokenx/v1/feedback` | `/api/azure/v1/feedback` |

Host, audience og sti kommer fra en av Entra ID-blokkene i
[steg 2](#_2-sett-miljøvariabler-i-nais). Bruker backenden Express, ser ruten ut som i
[Express med TokenX](#express), med `validateAzureToken` og
`requestAzureOboToken` i stedet.

## 4. Konfigurer access policies {#_4-konfigurer-access-policies}

Både appen deres og mottakeren hos Lumi må ha en access policy som slipper
trafikken gjennom. Outbound-regelen, hosten og audience i tokenet
må peke på samme mottaker:

| Tokenveksling | Miljø | Tenant i appen | Mottaker |
| :--- | :--- | :--- | :--- |
| TokenX | dev-gcp | – | `lumi-api` |
| TokenX | prod-gcp | – | `lumi-api` |
| Entra ID | dev-gcp | `nav.no` | `lumi-api` |
| Entra ID | dev-gcp | `trygdeetaten.no` | `lumi-submission-proxy` |
| Entra ID | prod-gcp | `nav.no` | `lumi-api` |

`lumi-submission-proxy` finnes bare i dev-gcp. Se
[Interne apper og Modia](#interne-apper) hvis dere er usikre på tenanten.

### Appen deres (outbound)

Kaller appen `lumi-api` direkte, legger dere til:

```yaml
spec:
  accessPolicy:
    outbound:
      rules:
        - application: lumi-api
          namespace: team-esyfo
```

Bruker appen Entra ID med tenanten `trygdeetaten.no` i dev, legger dere til denne regelen i stedet:

```yaml
spec:
  accessPolicy:
    outbound:
      rules:
        - application: lumi-submission-proxy
          namespace: team-esyfo
```

### Mottakeren (inbound) {#mottakeren-inbound}

Appen må også legges til som inbound i mottakeren fra tabellen: `lumi-api`
for direkte kall, eller `lumi-submission-proxy` for `trygdeetaten.no` i dev.
Uten inbound-regelen får ikke appen veksle token til mottakeren. Det kan dere
ordne på to måter:

- Vet dere hvilken mottaker dere skal ha, kan dere [sende en PR selv](#send-pr-selv).
  Det går raskest.
- Er dere usikre, kan dere [opprette en issue](https://github.com/navikt/lumi/issues/new?template=access-request.yml)
  med app-navn, namespace og auth-type, så ordner Team eSyfo resten. Tilgangen
  gjelder da både dev og prod.

Regelen ser slik ut:

```yaml
spec:
  accessPolicy:
    inbound:
      rules:
        - application: din-app
          namespace: ditt-team
```

#### Send PR selv {#send-pr-selv}

Legg regelen til under `spec.accessPolicy.inbound.rules` i filen for
mottakeren og hvert miljø dere trenger:

| Mottaker | Miljø | Fil |
| :--- | :--- | :--- |
| `lumi-api` | dev-gcp | [`apps/lumi-api/nais/app/dev.yaml`](https://github.com/navikt/lumi/blob/main/apps/lumi-api/nais/app/dev.yaml) |
| `lumi-api` | prod-gcp | [`apps/lumi-api/nais/app/prod.yaml`](https://github.com/navikt/lumi/blob/main/apps/lumi-api/nais/app/prod.yaml) |
| `lumi-submission-proxy` | dev-gcp | [`apps/lumi-submission-proxy/nais/dev.yaml`](https://github.com/navikt/lumi/blob/main/apps/lumi-submission-proxy/nais/dev.yaml) |

- Ta alltid med `namespace`. Uten den gjelder regelen en app i `team-esyfo`.
- Skriv auth-type (TokenX eller Entra ID) i PR-beskrivelsen. Team eSyfo sjekker
  tenanten i appens Nais-manifest og at mottakeren stemmer.
- Inbound-listen er selve tilgangskontrollen. Team eSyfo går derfor gjennom
  alle endringer, og tilgangen gjelder først når PR-en er merget og mottakeren
  er deployet.

Går appen via proxyen i dev, trenger den ikke inbound i `lumi-api` i dev.
Proxyen har allerede sin egen tilgang til `lumi-api`. I prod trenger appen
inbound i `lumi-api`.

## 5. Velg lagring {#_5-velg-lagring}

Widgeten husker at brukeren har lukket surveyen bare når den får lagre det.
Standardstrategien `consent` krever Nav-dekoratøren og at brukeren har
samtykket. Interne apper uten dekoratøren må sette
`storageStrategy: "localStorage"`. Se [Lagring](/guider/lagring) for hva som
skjer uten samtykke, og hvordan dere velger strategi.

## Komplett sjekkliste {#komplett-sjekkliste}

Før dere setter appen i produksjon, sjekk at dere har:

- [ ] bedt om inbound-tilgang hos mottakeren ([send PR selv](#send-pr-selv) eller [opprett issue](https://github.com/navikt/lumi/issues/new?template=access-request.yml)), helst først
- [ ] installert `@navikt/lumi-survey` og lagt den delte surveyen i appen
- [ ] importert widgeten fra `@navikt/lumi-survey/client`, eller lagt `"use client"` øverst i filen med widgeten, hvis appen bruker Next.js App Router
- [ ] importert `@navikt/ds-css` og `@navikt/lumi-survey/styles.css`
- [ ] satt `transport` til `{ endpoint: "/api/lumi/feedback" }`, eller laget en egen `transport.submit` som sender `submission.transportPayload` og kaster en feil når svaret ikke er `ok`
- [ ] installert `@navikt/oasis` og laget endepunktet i backenden med validering og tokenveksling (TokenX eller Entra ID)
- [ ] riktig endepunkt (`/api/tokenx/v1/feedback` eller `/api/azure/v1/feedback`)
- [ ] `LUMI_API_HOST`, `LUMI_AUDIENCE` og `LUMI_FEEDBACK_PATH` satt i Nais-manifestet
- [ ] outbound access policy mot riktig mottaker (`lumi-api` eller `lumi-submission-proxy`) i `team-esyfo`
- [ ] riktig `storageStrategy` (`consent`, `localStorage` eller `none`)
- [ ] testet i dev at et innsendt svar vises i dashboardet

## Test i dev

Deploy appen til dev-gcp og sjekk at hele kjeden virker:

1. Åpne appen i dev og send inn et svar på surveyen.
2. Sjekk at svaret vises i [dashboardet i dev](https://lumi-dashboard.ansatt.dev.nav.no).

Feiler innsendingen, finner dere vanlige feil og løsninger i [Feilsøking](/guider/feilsoking).

## Videre lesing

- [Velg hva dere vil måle](/guider/surveytyper): hvilket oppsett som passer til det dere vil finne ut
- [Spørsmålstyper](/guider/sporsmalstyper): vurdering, fritekst, ett valg og flere valg
- [Vis bare relevante spørsmål](/guider/betinget-synlighet): vis spørsmål ut fra tidligere svar
- [Context og tags](/guider/context-og-tags): legg til metadata dere kan filtrere på i dashboardet
