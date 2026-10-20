---
title: Legg surveyen i appen
---

# Legg surveyen i appen

Appen bruker en delt versjon fra [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted). En delt versjon kan ikke endres, så appen viser den samme surveyen til dere tar i bruk en ny versjon.

## Kopier surveyen

Åpne versjonen dere vil ta i bruk, og velg **Kopier TypeScript**. Lim innholdet inn i `survey.ts` i appen.

Filen eksporterer `survey` og har en typesjekk med `SurveyDocumentV1`. Spørsmål, sider, oppfølgingsspørsmål og takkeside følger med, i tillegg til spørsmålene oppsettet trenger for at dashboardet skal kunne analysere svarene.

## Vis surveyen og send inn svar

Når dere har [installert pakken og importert stilarkene](/kom-i-gang/installer-widget), kan dere bruke filen i en komponent. Eksempelet er skrevet for Next.js App Router. I Vite og andre React-apper uten serverkomponenter trengs ikke første linje.

```tsx
"use client";

import {
  LumiSurveyDock,
  LumiSurveyHttpError,
  type LumiSurveyTransport,
} from "@navikt/lumi-survey";
import { survey } from "./survey";

const transport: LumiSurveyTransport = {
  async submit({ transportPayload }, options) {
    const response = await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transportPayload),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw LumiSurveyHttpError.fromResponse(response);
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

Legg `FeedbackWidget` på siden der dere vil samle tilbakemeldinger. `survey` er innholdet brukeren møter, mens `transport` sender svarene til appens backend. Widgeten viser takkesiden når `submit` er ferdig uten feil, så `submit` må kaste en feil når backenden svarer med feil.

Widgeten venter i høyst ti sekunder på hvert forsøk. Da avbryter `options.signal` kallet til `fetch`, og brukeren ser feilmeldingen. `LumiSurveyHttpError` forteller widgeten hvilken status backenden svarte med. Ved 429 og 503 prøver widgeten én gang til med det samme svaret, etter tiden i `Retry-After` eller etter ett sekund. Ber `Retry-After` om mer enn fem sekunder, viser widgeten feilmeldingen med en gang. Lumi API lagrer et svar bare én gang selv om det sendes to ganger, så et nytt forsøk gir ikke doble svar. Tidsgrensen, `options.signal` og `LumiSurveyHttpError` finnes fra versjon 2.4.0 av `@navikt/lumi-survey`.

`/api/lumi/feedback` er et endepunkt dere lager selv i appens backend. Det bytter brukerens token mot et token for Lumi API (tokenveksling) og sender svarene videre. Widgeten kan vises før endepunktet finnes, men svarene lagres ikke før [backenden er koblet til](/kom-i-gang/koble-til-backend).

### Next.js App Router {#next-js}

`"use client"` på første linje gjør filen til en klientkomponent. Widgeten bruker React-hooks og må kjøre i nettleseren, men den bygde pakken har ikke direktivet selv. Uten linjen prøver Next.js å kjøre widgeten som serverkomponent, og siden feiler. I Vite og andre React-apper uten serverkomponenter trengs ikke linjen.

Har appen `basePath` i `next.config`, legger ikke Next.js den til i `fetch`. Sett den foran stien selv, for eksempel med en variabel som også brukes som `basePath`:

```ts
fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/lumi/feedback`, {
  // som over
});
```

Next.js setter inn `NEXT_PUBLIC_`-variabler i klientkoden når appen bygges, så variabelen må være satt ved bygg.

I Vite står base-stien i `import.meta.env.BASE_URL`, og den slutter alltid med `/`:

```ts
fetch(`${import.meta.env.BASE_URL}api/lumi/feedback`, {
  // som over
});
```

## Sett survey-ID

Bytt ut `min-app-tilbakemelding` med en stabil ID for surveyen. Surveyverksted foreslår en ID, og den står som **Survey-ID** på versjonssiden. ID-en settes på `LumiSurveyDock` og følger ikke med i den kopierte TypeScript-filen.

Behold ID-en så lenge svarene skal tilhøre samme analyseserie. Se [Survey-identitet og endringer](/guider/survey-identitet) før dere endrer hva surveyen måler eller hvilke svaralternativer den har.

## Når brukeren lukker surveyen

Widgeten husker at brukeren har lukket surveyen bare når den får lagre det. Standarden virker bare på sider med Nav-dekoratøren og når brukeren har samtykket. I apper uten dekoratøren setter dere `storageStrategy: "localStorage"` i `behavior`. Les [Lagring](/guider/lagring) før dere setter appen i produksjon, og se [Props-referansen](/referanse/props-referanse) for andre innstillinger.

## Språk

Spørsmålene, velkomstsiden og takkesiden kan dere skrive på nynorsk eller engelsk i Surveyverksted. De faste tekstene i widgeten finnes bare på bokmål. Noen av dem kan dere endre selv:

- knappene, feilmeldingene og knappen i minimert widget med `labels`, se [`labels` i props-referansen](/referanse/props-referanse#labels-lumisurveylabels)
- knappen på takkesiden med `success.primaryLabel`
- varselet om personopplysninger med `behavior.personalDataNotice`. Varselet skal fortsatt vises, se [bruksvilkårene](/referanse/bruksvilkar).

Resten kan dere ikke endre, for eksempel «Neste», «Tilbake», «(valgfritt)» og «Steg 1 av 3».

Er surveyen på et annet språk enn siden, setter dere `lang` på widgeten, for eksempel `lang="en"`. Da leser skjermleseren teksten fra surveyen med riktig uttale. Faste tekster dere ikke har endret, er merket som bokmål. `lang` finnes fra versjon 2.3.0 av `@navikt/lumi-survey`.

## Prøv surveyen i appen

- Gå gjennom hele flyten med tastatur og på liten skjerm.
- Sjekk at oppfølgingsspørsmålene vises når de skal.
- Kontroller at tekstene passer til siden og tidspunktet surveyen vises på.

Når teamet endrer surveyen i Surveyverksted, deler dere en ny versjon og oppdaterer filen i appen. Brukerne ser endringen når appen er satt i produksjon.

Neste steg er å [koble til backend](/kom-i-gang/koble-til-backend), slik at svarene blir lagret og vises i Lumi-dashboardet.
