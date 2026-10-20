# Lumi Survey

`@navikt/lumi-survey` er React-widgeten som viser en Lumi-survey i appen deres. Den er laget med Aksel. Teamet lager surveyen i **Surveyverksted** og leser svarene i Lumi-dashboardet.

[Åpne Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) · [Kom i gang](https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi) · [Se demo](https://lumi-dashboard-demo.ekstern.dev.nav.no)

## 1. Lag surveyen

I Surveyverksted velger dere hva dere vil finne ut. Deretter kan dere endre spørsmålene og prøve surveyen slik brukeren vil se den.

Når dere er klare, velg **Del med utvikler** og opprett en versjon. Åpne versjonen, velg **Kopier TypeScript**, og lagre innholdet som `survey.ts` i appen. Endringer i utkastet påvirker ikke den delte versjonen. Brukerne ser surveyen når appen med den nye koden er satt i produksjon.

Surveyverksted krever Nav-innlogging og medlemskap i teamet i Nais Console. Se [Lag surveyen](https://navikt.github.io/lumi/kom-i-gang/lag-survey) for hele flyten.

## 2. Installer widgeten

Krever React 18 eller nyere og Aksel 8 eller nyere.

```sh
pnpm add @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

## 3. Legg surveyen i appen

Importer Aksel-stilarket før Lumi-stilarket, og bruk `survey` fra filen du kopierte fra Surveyverksted:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { LumiSurveyDock } from "@navikt/lumi-survey";
import { survey } from "./survey";

export function FeedbackWidget() {
  return (
    <LumiSurveyDock
      surveyId="min-app-tilbakemelding"
      survey={survey}
      transport={{ endpoint: "/api/lumi/feedback" }}
    />
  );
}
```

Bytt eksempelverdien i `surveyId` med en stabil ID for surveyen i appen. Dere finner et forslag på versjonssiden i Surveyverksted.

Med `{ endpoint }` sender widgeten svarene selv til appens backend, med tidsgrense og ett nytt forsøk ved 429 og 503. Trenger backenden mer, kan dere lage en egen transport. Se [Send svarene](https://navikt.github.io/lumi/kom-i-gang/konfigurer-survey#send-svarene). I Next.js App Router importerer dere widgeten fra `@navikt/lumi-survey/client`.

Widgeten bruker Nav-dekoratørens samtykkeløsning for å huske at brukeren har lukket surveyen. På interne flater uten dekoratøren, sett `behavior={{ storageStrategy: "localStorage" }}` på `LumiSurveyDock`. Se [Lagring](https://navikt.github.io/lumi/guider/lagring) for innstillinger.

## 4. Koble til Lumi og se svarene

`/api/lumi/feedback` i eksempelet er et endepunkt **dere oppretter i egen app**. Backend gjør token exchange med TokenX eller Entra ID (OBO) og sender svarene videre til Lumi API. Appen trenger også tilgang til API-et i Nais.

Følg [Koble til backend](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend) for oppsett og tilgangsbestilling. Test innsending i dev og kontroller at svaret vises i [Lumi-dashboardet i dev](https://lumi-dashboard.ansatt.dev.nav.no) før dere ruller ut i produksjon.

Les [bruksvilkårene](https://navikt.github.io/lumi/referanse/bruksvilkar) og fullfør etterlevelsesdokumentasjonen før dere samler inn svar fra brukerne.

## Dokumentasjon og hjelp

- [Velg hva dere vil måle](https://navikt.github.io/lumi/guider/surveytyper)
- [Props og TypeScript-referanse](https://navikt.github.io/lumi/referanse/props-referanse)
- [Feilsøking](https://navikt.github.io/lumi/guider/feilsoking)
- [Spør i #lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD)

Laget av Team eSyfo i Nav. [MIT-lisens](https://github.com/navikt/lumi/blob/main/packages/lumi-survey/LICENSE).
