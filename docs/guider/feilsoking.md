---
title: Feilsøking
---

# Feilsøking

Vanlige problemer og løsninger for Lumi-widgeten.

## Survey dukker ikke opp

**Symptom:** Komponenten er rendret, men ingenting vises på skjermen.

::: details Sjekk 1: `initialOpen` er satt til `false`
Widgeten starter som standard åpen (`initialOpen: true`). Hvis du har satt `initialOpen: false`, vises bare den minimerte knappen.

```tsx
// ❌ Starter minimert
<LumiSurveyDock behavior={{ initialOpen: false }} />

// ✅ Starter åpen (default)
<LumiSurveyDock behavior={{ initialOpen: true }} />
```
:::

::: details Sjekk 2: Dismissed-tilstand fra tidligere visning
Widgeten husker at brukeren lukket den. Under utvikling kan dette persistere mellom sidelaster.

**Løsning for utvikling:**
- Bruk `storageStrategy: "none"` for å deaktivere persistering
- Eller tøm localStorage/cookies og last siden på nytt

```tsx
// For utvikling/testing
<LumiSurveyDock behavior={{ storageStrategy: "none" }} />
```
:::

::: details Sjekk 3: Cooldown-perioden er aktiv
Etter at brukeren lukker surveyen, er default cooldown **30 dager**. Under utvikling kan du sette den lavere:

```tsx
<LumiSurveyDock behavior={{ dismissCooldownDays: 0 }} />
```
:::

::: details Sjekk 4: CSS mangler
Uten CSS-import kan widgeten rendre med usynlige elementer. Se [Layout virker tom](#layout-virker-tom) under.
:::

## 403 fra API

**Symptom:** `transport.submit` feiler med HTTP 403.

**Årsak:** NAIS access policies er ikke riktig konfigurert — enten utgående
fra appen din, eller innkommende til Lumi-mottakeren.

**Sjekk:**

1. **Finn riktig mottaker.** Bruk `lumi-api` for TokenX, produksjon og
   AzureAD-apper med `nav.no`-tenant. Bruk `lumi-submission-proxy` bare for
   AzureAD i dev når appen har `trygdeetaten.no`-tenant. Se den komplette
   [rutetabellen](/kom-i-gang/koble-til-backend#_4-konfigurer-access-policies).

2. **Din app** har outbound-regel mot denne mottakeren. For direkte kall til
   `lumi-api`:
   ```yaml
   spec:
     accessPolicy:
       outbound:
         rules:
           - application: lumi-api
             namespace: team-esyfo
   ```

   For AzureAD i dev med `trygdeetaten.no`-tenant:
   ```yaml
   spec:
     accessPolicy:
       outbound:
         rules:
           - application: lumi-submission-proxy
             namespace: team-esyfo
   ```

3. **Den samme mottakeren** har inbound-regel for appen din. Team eSyfo
   vedlikeholder denne regelen etter en
   [tilgangsforespørsel](https://github.com/navikt/lumi/issues/new?template=access-request.yml):
   ```yaml
   spec:
     accessPolicy:
       inbound:
         rules:
           - application: din-app
             namespace: ditt-team
   ```

4. **Token exchange** er korrekt konfigurert — sjekk at du bruker riktig endepunkt:
   - Sluttbruker (TokenX): `POST /api/tokenx/v1/feedback`
   - Intern (AzureAD): `POST /api/azure/v1/feedback`

5. **Host og audience peker på samme mottaker som access policy.** Direkte
   kall bruker `http://lumi-api.team-esyfo`; AzureAD fra
   `trygdeetaten.no` i dev bruker
   `http://lumi-submission-proxy.team-esyfo`. Se
   [miljøvariablene for alle kombinasjoner](/kom-i-gang/koble-til-backend#_2-sett-miljøvariabler-i-nais).

## 401 eller 404 fra API

**Symptom:** `transport.submit` feiler med HTTP 401 eller 404.

- **401 Unauthorized** betyr vanligvis at tokenet ikke har issueren som
  endepunktet forventer. TokenX-token skal sendes til
  `/api/tokenx/v1/feedback`, mens AzureAD-token skal sendes til
  `/api/azure/v1/feedback`.
- **404 Not Found** betyr vanligvis at host og sti ikke passer sammen. Dette
  skjer for eksempel hvis `/api/tokenx/v1/feedback` sendes til
  `lumi-submission-proxy`, som bare eksponerer AzureAD-endepunktet.

**Sjekk:**

1. Velg miljøblokken som passer auth-type, miljø og Azure-tenant i
   [backend-guiden](/kom-i-gang/koble-til-backend#_2-sett-miljøvariabler-i-nais).
2. Kopier `LUMI_API_HOST`, `LUMI_AUDIENCE` og `LUMI_FEEDBACK_PATH` fra den
   samme blokken. Ikke bland verdier fra ulike blokker.
3. Verifiser at token exchange bruker `LUMI_AUDIENCE`, og at requesten sendes
   til `${LUMI_API_HOST}${LUMI_FEEDBACK_PATH}`.

Hvis responsen er **403**, er token og rute normalt funnet, men access policy
mangler. Følg [403-sjekklisten](#_403-fra-api).

## Ingen data i dashboard

**Symptom:** Innsending ser ut til å fungere (ingen feil), men data dukker ikke opp i dashboardet.

**Sjekk:**

1. **Sender du riktig payload?** Backend skal videresende `submission.transportPayload` — ikke hele submission-objektet.

   ```ts
   // ✅ Riktig
   body: JSON.stringify(submission.transportPayload)

   // ❌ Feil
   body: JSON.stringify(submission)
   ```

2. **Riktig endepunkt?** Sjekk at du treffer riktig Lumi API-endepunkt:
   - Sluttbruker: `POST /api/tokenx/v1/feedback`
   - Intern: `POST /api/azure/v1/feedback`

3. **Sjekk nettverksfanen** i DevTools for å verifisere at requesten faktisk sendes og får 2xx-respons.

4. **Verifiser `surveyId`** — dashboardet filtrerer på `surveyId`. Sjekk at du leter under riktig ID.

## Layout virker tom {#layout-virker-tom}

**Symptom:** Widgeten vises, men uten styling — ingen farger, rar layout, elementer overlapper.

**Årsak:** Manglende CSS-import. Begge er påkrevd:

```tsx
import "@navikt/ds-css";                 // Aksel base-styles
import "@navikt/lumi-survey/styles.css"; // Lumi widget-styles
```

::: tip Sjekk import-rekkefølge
`@navikt/ds-css` bør importeres *før* `@navikt/lumi-survey/styles.css`. I de fleste bundlere spiller rekkefølgen i import-statements rolle for CSS-spesifisitet.
:::

## Dismissed-tilstand persisteres ikke

**Symptom:** Brukeren lukker surveyen, men den dukker opp igjen ved neste sidelast. Typisk på interne flater (Modia, fagsystemer).

**Årsak:** Default storage-strategi er `consent`, som krever Nav-dekoratørens consent-API (`window.webStorageController`). Interne flater har vanligvis ikke denne.

**Løsning:**

```tsx
<LumiSurveyDock
  behavior={{ storageStrategy: "localStorage" }}
/>
```

Se [Lagring](/guider/lagring) for full oversikt over lagringsstrategier.

::: info Feilsøk med events
Du kan lytte på `onDismissalPersistFailed` for å oppdage dette:

```tsx
<LumiSurveyDock
  events={{
    onDismissalPersistFailed: (cause) => {
      console.warn("Lagring feilet:", cause);
    },
  }}
/>
```
:::

## Validering feiler uventet

**Symptom:** Brukeren får valideringsfeil selv om de har svart.

**Sjekk:**
- Har du `required: true` på spørsmål som er skjult med `visibleIf`? Skjulte spørsmål hoppes over i validering, men dobbeltsjekk at betingelsen fungerer som forventet.
- Bruk `onValidationFailed` for å se hvilke spørsmål som mangler svar:

```tsx
<LumiSurveyDock
  events={{
    onValidationFailed: (missing) => {
      console.log("Mangler svar:", missing);
    },
  }}
/>
```

## Trenger du mer hjelp?

Spør i **[#lumi](https://nav-it.slack.com/archives/C0AG2FKSSMD)** på Slack — vi hjelper gjerne!

Du kan også sjekke disse sidene:
- [Styling](/guider/styling) — styling-problemer
- [Props-referanse](/referanse/props-referanse) — alle props
- [Vis bare relevante spørsmål](/guider/betinget-synlighet) — betinget flyt
- [Lagring](/guider/lagring) — lagring og cooldown
- [Opprett en issue](https://github.com/navikt/lumi/issues) — rapporter feil
