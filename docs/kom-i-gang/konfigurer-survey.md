---
title: Legg surveyen i appen
---

# Legg surveyen i appen

Bruk en delt versjon fra [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) som utgangspunkt for integrasjonen. Versjonen inneholder surveyen teamet har prøvd og er enige om å ta i bruk.

## Kopier surveyen

Åpne versjonen dere vil ta i bruk og velg **Kopier TypeScript**. Lim innholdet inn i `survey.ts` i appen.

Filen eksporterer `survey` og inkluderer en typesjekk med `SurveyDocumentV1`. Spørsmål, sider, oppfølging og bekreftelse følger med. Surveyverksted setter også analysefeltene for oppsettet teamet valgte.

## Vis surveyen og send inn svar

Etter at du har [installert pakken og importert stilarkene](/kom-i-gang/installer-widget), kan du bruke filen i en komponent:

```tsx
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

Legg `FeedbackWidget` på flaten der dere vil samle tilbakemeldinger. `survey` er innholdet brukeren møter, mens `transport` sender svarene til appens backend.

`/api/lumi/feedback` er et endepunkt dere må opprette i egen app. Det gjør token exchange og sender svarene videre til Lumi API. Widgeten kan vises før dette er satt opp, men svar lagres først når [backendintegrasjonen](/kom-i-gang/koble-til-backend) er på plass.

## Sett survey-ID

Bytt `min-app-tilbakemelding` med en stabil ID for surveyen. Dere finner et forslag på versjonssiden i Surveyverksted. ID-en settes på `LumiSurveyDock` og følger ikke med i den kopierte TypeScript-filen.

Behold ID-en så lenge svarene skal tilhøre samme analyseserie. Se [Survey-identitet og endringer](/guider/survey-identitet) før dere endrer hva surveyen måler eller hvilke svaralternativer den har.

## Tilpass til flaten

På nav.no bruker widgeten Nav-dekoratørens samtykkeløsning for å huske at brukeren har lukket surveyen. På interne flater uten dekoratøren, legg til:

```tsx
<LumiSurveyDock
  surveyId="min-app-tilbakemelding"
  survey={survey}
  transport={transport}
  behavior={{ storageStrategy: "localStorage" }}
/>
```

Se [Lagring](/guider/lagring) for hvor lenge lukking huskes, og [Props-referansen](/referanse/props-referanse) for øvrige innstillinger.

## Prøv surveyen i appen

- Gå gjennom hele flyten med tastatur og på liten skjerm.
- Sjekk at oppfølgingsspørsmålene vises når de skal.
- Kontroller at tekstene passer til flaten og tidspunktet surveyen vises på.

Når teamet endrer surveyen i Surveyverksted, deler dere en ny versjon og oppdaterer filen i appen. Endringen når brukerne når dere ruller ut appen.

## Neste steg

[Koble til backend](/kom-i-gang/koble-til-backend) for å lagre svarene og se dem i Lumi-dashboardet.
