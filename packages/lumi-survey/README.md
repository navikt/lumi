# Lumi Survey

Samle tilbakemeldinger fra brukerne i Nav-appen din. Lag spørsmålene og prøv flyten i **Surveyverksted**, vis surveyen med denne Aksel-baserte React-widgeten, og følg svarene i Lumi-dashboardet.

[Åpne Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) · [Kom i gang](https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi) · [Se demo](https://lumi-dashboard-demo.ekstern.dev.nav.no)

## 1. Lag surveyen

I Surveyverksted velger teamet hva dere vil finne ut, tilpasser spørsmålene og prøver surveyen slik brukeren vil møte den.

Når dere er klare, velg **Del med utvikler** og opprett en versjon. Åpne versjonen, velg **Kopier TypeScript**, og lagre innholdet som `survey.ts` i appen. Endringer i utkastet påvirker ikke den delte versjonen. Surveyen blir tilgjengelig for brukerne når dere legger den i appen og ruller ut appen.

Surveyverksted krever Nav-innlogging og medlemskap i teamet i NAIS. Se [Lag surveyen](https://navikt.github.io/lumi/kom-i-gang/lag-survey) for hele flyten.

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

import {
  LumiSurveyDock,
  type LumiSurveyTransport,
} from "@navikt/lumi-survey";
import { survey } from "./survey";

const transport: LumiSurveyTransport = {
  async submit({ transportPayload }) {
    const response = await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transportPayload),
    });
    if (!response.ok) {
      throw new Error(`Innsending feilet med status ${response.status}`);
    }
  },
};

export function FeedbackWidget() {
  return (
    <LumiSurveyDock
      surveyId="min-app-tilbakemelding"
      survey={survey}
      transport={transport}
    />
  );
}
```

Bytt eksempelverdien i `surveyId` med en stabil ID for surveyen i appen. Dere finner et forslag på versjonssiden i Surveyverksted.

Widgeten bruker Nav-dekoratørens samtykkeløsning for å huske at brukeren har lukket surveyen. På interne flater uten dekoratøren, sett `behavior={{ storageStrategy: "localStorage" }}` på `LumiSurveyDock`. Se [Lagring](https://navikt.github.io/lumi/guider/lagring) for innstillinger.

## 4. Koble til Lumi og se svarene

`/api/lumi/feedback` i eksempelet er et endepunkt **dere oppretter i egen app**. Backend gjør token exchange med TokenX eller Azure AD (OBO) og sender svarene videre til Lumi API. Appen trenger også tilgang til API-et i NAIS.

Følg [Koble til backend](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend) for oppsett og tilgangsbestilling. Test innsending i dev og kontroller at svaret vises i [Lumi-dashboardet i dev](https://lumi-dashboard.ansatt.dev.nav.no) før dere ruller ut i produksjon.

Les [bruksvilkårene](https://navikt.github.io/lumi/referanse/bruksvilkar) og fullfør etterlevelsesdokumentasjonen før dere samler inn svar fra brukerne.

## Dokumentasjon og hjelp

- [Velg hva dere vil måle](https://navikt.github.io/lumi/guider/surveytyper)
- [Props og TypeScript-referanse](https://navikt.github.io/lumi/referanse/props-referanse)
- [Feilsøking](https://navikt.github.io/lumi/guider/feilsoking)
- [Spør i #lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD)

Laget av Team eSyfo i Nav. [MIT-lisens](https://github.com/navikt/lumi/blob/main/packages/lumi-survey/LICENSE).
