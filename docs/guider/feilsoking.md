---
title: Feilsøking
---

# Feilsøking

## Surveyen vises ikke

Komponenten er rendret, men ingenting vises på skjermen.

::: details Sjekk 1: `initialOpen` er satt til `false`
Widgeten starter som standard åpen (`initialOpen: true`). Hvis dere har satt `initialOpen: false`, vises bare den minimerte knappen, og brukeren må åpne surveyen selv. Widgeten starter også minimert når den ikke får lagre, for eksempel når brukeren ikke har samtykket. Se [Uten samtykke](/guider/lagring#uten-samtykke).

```tsx
// Starter minimert
<LumiSurveyDock behavior={{ initialOpen: false }} />

// Starter åpen (standard)
<LumiSurveyDock behavior={{ initialOpen: true }} />
```
:::

::: details Sjekk 2: Surveyen er lukket eller besvart tidligere
Widgeten husker at brukeren har lukket eller svart på surveyen, og under utvikling kan dette henge igjen fra én sidelast til den neste.

Dere kan enten bruke `storageStrategy: "none"`, så widgeten ikke lagrer noe, eller tømme localStorage og informasjonskapsler og laste siden på nytt.

```tsx
// Under utvikling og testing
<LumiSurveyDock behavior={{ storageStrategy: "none" }} />
```
:::

::: details Sjekk 3: Ventetiden er ikke over
Etter at brukeren har lukket eller svart på surveyen, venter widgeten som standard 30 dager før den viser den igjen. Under utvikling er det enklest å bruke `storageStrategy: "none"` fra sjekk 2, så husker ikke widgeten at surveyen er lukket.

Ikke sett `dismissCooldownDays: 0`. Da går ventetiden aldri ut, og surveyen åpner seg ikke av seg selv igjen for den brukeren. Har brukeren lukket surveyen, vises bare den minimerte knappen. Har brukeren svart, er widgeten skjult for godt med `hideAfterSubmit: true`, som er standard.
:::

::: details Sjekk 4: CSS mangler
Uten CSS-importene kan elementer i widgeten bli usynlige. Se [Layout virker tom](#layout-virker-tom) lenger ned.
:::

## Widgeten virker ikke i Next.js App Router

Filen som bruker `LumiSurveyDock`, må starte med `"use client"`. Den bygde
pakken har ikke direktivet selv. Uten det prøver Next.js å kjøre widgeten som
serverkomponent, og siden feiler. Se
[Next.js App Router](/kom-i-gang/konfigurer-survey#next-js).

## Innsendingen feiler

Widgeten viser en feilmelding når `transport.submit` kaster en feil. Se først i
nettverksfanen i DevTools hvilken status kallet til appens backend får. Kallet
videre til Lumi API vises ikke i nettleseren, så detaljene står i loggene til
backenden. Ruten i
[backend-eksempelet](/kom-i-gang/koble-til-backend#_3-send-inn-svar-til-lumi-api)
sender statuskoden fra Lumi API videre til nettleseren.

Mangler en access policy, ser dere det på en av to måter: Tokenvekslingen feiler, eller kallet til
Lumi API får tidsavbrudd.

### Tokenvekslingen feiler

Loggen i backenden viser at tokenvekslingen feilet. I backend-eksempelet står
det `Tokenveksling feilet`, og ruten svarer med 500. Kallet til Lumi API blir
ikke sendt.

Sjekk dette:

1. Mottakeren har appen deres som inbound. Uten regelen får ikke appen veksle
   token til mottakeren. Tilgangen gjelder først når PR-en er merget og
   mottakeren er deployet. Se
   [Mottakeren (inbound)](/kom-i-gang/koble-til-backend#mottakeren-inbound).
2. `LUMI_AUDIENCE` hører til samme mottaker som `LUMI_API_HOST`. Se
   [miljøvariablene](/kom-i-gang/koble-til-backend#_2-sett-miljøvariabler-i-nais).
3. Nais-manifestet har `tokenx.enabled: true` for TokenX eller
   `azure.application.enabled: true` for Entra ID.
4. Har appen både TokenX og Entra ID slått på, returnerer `requestOboToken`
   alltid en feil. Bruk `requestTokenxOboToken` eller `requestAzureOboToken`.

### Kallet til Lumi API får tidsavbrudd

`fetch` mot Lumi API får ikke svar og feiler etter en stund, ofte med
`fetch failed` i loggen. Da slipper ikke nettverket i Nais kallet gjennom,
vanligvis fordi appen mangler outbound-regel mot mottakeren.

Sjekk dette:

1. Finn riktig mottaker i
   [tabellen over mottakere](/kom-i-gang/koble-til-backend#_4-konfigurer-access-policies).
2. Appen deres har en outbound-regel mot denne mottakeren. For direkte kall til
   `lumi-api`:
   ```yaml
   spec:
     accessPolicy:
       outbound:
         rules:
           - application: lumi-api
             namespace: team-esyfo
   ```

   For Entra ID i dev med `trygdeetaten.no`-tenant:
   ```yaml
   spec:
     accessPolicy:
       outbound:
         rules:
           - application: lumi-submission-proxy
             namespace: team-esyfo
   ```
3. `LUMI_API_HOST` peker på den samme mottakeren: `http://lumi-api.team-esyfo`
   eller `http://lumi-submission-proxy.team-esyfo`.

### Statuskoder fra Lumi API

Kommer kallet fram, svarer Lumi API eller proxyen med en av disse kodene.
Feilmeldingen i svaret står i loggen når backenden logger den, slik
eksempelet gjør.

| Status | Hva det betyr | Hva dere gjør |
| :--- | :--- | :--- |
| 400 | Payloaden er ugyldig, for eksempel fordi backenden sender hele `submission` og ikke `submission.transportPayload`. | Send `transportPayload` videre uendret. |
| 401 | Tokenet mangler, er utløpt eller har feil utsteder. Ruten i eksempelet svarer selv 401 når brukerens token mangler eller er ugyldig, så sjekk loggen i backend for å se hvem som svarte. Et TokenX-token til `/api/azure/v1/feedback` gir 401, og det samme gjør et Entra ID-token til `/api/tokenx/v1/feedback`. | Bruk host, audience og sti fra samme [miljøblokk](/kom-i-gang/koble-til-backend#_2-sett-miljøvariabler-i-nais). |
| 404 | Host og sti passer ikke sammen, for eksempel `/api/tokenx/v1/feedback` sendt til `lumi-submission-proxy`, som bare har endepunktet for Entra ID. | Bruk host, audience og sti fra samme miljøblokk. |
| 409 | Surveyen er endret på en måte som ikke passer med definisjonen Lumi API har lagret for `surveyId`. Svaret er ikke lagret. | Se [Hvis API-et svarer med 409](/guider/survey-identitet#hvis-api-et-svarer-med-409). |
| 413 | Payloaden er større enn 1 MB. Proxyen svarer også med 413 når headeren `Content-Length` mangler. | Send bare `transportPayload`. |
| 429 | Appen har sendt mer enn 100 svar på ett minutt, eller samme bruker mer enn 15. I dev deler alle apper i `trygdeetaten.no` én grense gjennom proxyen. | Vent et minutt. Skjer det ofte, spør i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD). |
| 500 | Feil i Lumi API eller proxyen. | Spør i #lumi. |
| 502 | Proxyen fikk ikke sendt svaret videre til Lumi API. Gjelder bare `trygdeetaten.no` i dev. | Spør i #lumi. |

## Ingen data i dashboardet

Widgeten viser takkesiden, men svarene dukker ikke opp i dashboardet.

Sjekk dette:

1. `transport.submit` kaster en feil når backenden svarer med feil. Widgeten
   viser takkesiden så lenge `submit` ikke kaster, også når kallet feilet.
   Sjekk `response.ok`, slik
   [eksempelet](/kom-i-gang/konfigurer-survey#vis-surveyen-og-send-inn-svar)
   gjør.

2. Backenden svarer med 2xx bare når Lumi API gjorde det. Se i nettverksfanen i
   DevTools hvilken status kallet til appens backend får, og i loggene til
   backenden hva Lumi API svarte.

3. Sjekk at dere bruker riktig endepunkt i Lumi API:
   - sluttbrukere: `POST /api/tokenx/v1/feedback`
   - interne apper: `POST /api/azure/v1/feedback`

4. Sjekk at dere ser i riktig miljø. Svar sendt fra dev vises i
   [dashboardet i dev](https://lumi-dashboard.ansatt.dev.nav.no).

5. Sjekk at dere ser på riktig `surveyId` i dashboardet. Dashboardet filtrerer
   på `surveyId`.

## Layout virker tom {#layout-virker-tom}

Widgeten vises, men uten stiler: ingen farger, rar layout og elementer som overlapper. Da mangler minst én av CSS-importene. Begge må være med:

```tsx
import "@navikt/ds-css";                 // Grunnstilene fra Aksel
import "@navikt/lumi-survey/styles.css"; // Stilene til widgeten
```

::: tip Sjekk rekkefølgen på importene
Importer `@navikt/ds-css` før `@navikt/lumi-survey/styles.css`.
:::

## Widgeten husker ikke at surveyen er lukket

Widgeten starter minimert ved hver sidelast, også før brukeren har lukket surveyen. Det betyr at widgeten ikke får lagre at surveyen er lukket eller besvart. I versjoner før 2.3.0 åpner surveyen seg ved hver sidelast.

I interne apper som Modia og fagsystemer mangler vanligvis Nav-dekoratøren, som
standardstrategien `consent` trenger. Widgeten skriver da en advarsel som
begynner med `[Lumi]` i konsollen. Sett `storageStrategy` til `localStorage`, så
åpner surveyen seg av seg selv og widgeten husker lukkingen:

```tsx
<LumiSurveyDock
  behavior={{ storageStrategy: "localStorage" }}
/>
```

På nav.no husker widgeten lukkingen bare når brukeren har samtykket til
`surveys`, og dekoratøren tillater nøkkelen widgeten lagrer under.
[Uten samtykke](/guider/lagring#uten-samtykke) i Lagring viser hvordan dere
sjekker dette i nettleseren. Widgeten kaller `onDismissalPersistFailed` når den
ikke får lagret lukkingen. Se [Events](/referanse/events).

## Validering feiler uventet

Brukeren får valideringsfeil selv om spørsmålene er besvart.

Har dere `required: true` på spørsmål som skjules med `visibleIf`? Skjulte spørsmål hoppes over i valideringen, men sjekk at betingelsen skjuler spørsmålet når dere forventer det.

Med `onValidationFailed` ser dere hvilke spørsmål som mangler svar:

```tsx
<LumiSurveyDock
  events={{
    onValidationFailed: (missing) => {
      console.log("Mangler svar:", missing);
    },
  }}
/>
```

## Mer hjelp

Spør i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD). Feil i Lumi kan dere melde på [GitHub](https://github.com/navikt/lumi/issues). Alle props er beskrevet i [Props-referansen](/referanse/props-referanse). Problemer med utseendet er beskrevet i [Styling](/guider/styling), og problemer med flyten i [Vis bare relevante spørsmål](/guider/betinget-synlighet).
