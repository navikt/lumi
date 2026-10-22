---
title: Legg surveyen i appen
---

# Legg surveyen i appen

Appen bruker en delt versjon fra [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted). En delt versjon kan ikke endres, så appen viser den samme surveyen til dere tar i bruk en ny versjon.

## Kopier surveyen

Åpne versjonen dere vil ta i bruk, og velg **Kopier TypeScript**. Lim innholdet inn i `survey.ts` i appen.

Filen eksporterer `survey` og har en typesjekk med `SurveyDocumentV1`. Spørsmål, sider, oppfølgingsspørsmål og takkeside følger med, i tillegg til spørsmålene oppsettet trenger for at dashboardet skal kunne analysere svarene.

## Vis surveyen og send inn svar

Når dere har [installert pakken og importert stilarkene](/kom-i-gang/installer-widget), kan dere bruke filen i en komponent:

```tsx
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

Legg `FeedbackWidget` på siden der dere vil samle tilbakemeldinger. `survey` er innholdet brukeren møter, og `transport` sier hvor svarene skal sendes. Bruker appen Next.js App Router, se [Next.js App Router](#next-js).

### Send svarene {#send-svarene}

Med `{ endpoint }` som `transport` sender widgeten svarene selv. Den sender `submission.transportPayload` som JSON med `POST` til `endpoint`, og viser takkesiden bare når backenden svarer med 2xx. En videresending, for eksempel til innlogging, og en nettside med status 200 regnes som feil.

`endpoint` er en sti i appens egen backend:

- Stien starter med `/` og ligger på samme domene som siden. Lumi API kan ikke stå her, fordi svarene skal gjennom appens backend.
- Har appen en base-sti, må den være med, for eksempel `/min-app/api/lumi/feedback`. Se [Base-sti](#base-sti).
- Stien må være nøyaktig den samme som ruten. Widgeten følger ikke videresendinger, heller ikke en som bare legger til `/` på slutten, for eksempel med `trailingSlash: true` i `next.config`. Skriv da stien med `/` på slutten.

Er `endpoint` ugyldig, viser widgeten ingenting og skriver en melding som starter med `[Lumi]` i konsollen. Svarer backenden med en feil, skriver widgeten en `[Lumi]`-melding med status og årsak, men ikke svarene.

`/api/lumi/feedback` er et endepunkt dere lager selv i appens backend. Det bytter brukerens token mot et token for Lumi API (tokenveksling) og sender svarene videre. Widgeten kan vises før endepunktet finnes, men svarene lagres ikke før [backenden er koblet til](/kom-i-gang/koble-til-backend).

`transport` med `{ endpoint }` finnes fra versjon 2.5.0 av `@navikt/lumi-survey`.

### Tidsgrense og nytt forsøk {#tidsgrense-og-nytt-forsok}

Widgeten venter i høyst ti sekunder på hvert forsøk. Da avbryter den kallet, og brukeren ser feilmeldingen.

Slik prøver widgeten én gang til med det samme svaret:

- 503: etter tiden i `Retry-After`, eller etter et halvt til halvannet sekund når `Retry-After` mangler
- 429: bare når `Retry-After` ber om å vente i fem sekunder eller mindre

Ber `Retry-After` om mer enn fem sekunder, viser widgeten feilmeldingen med en gang. Lumi API lagrer et svar bare én gang selv om det sendes to ganger, så et nytt forsøk gir ikke doble svar.

Med [egen transport](#egen-transport) gjelder dette når `submit` sender `options.signal` videre til `fetch` og kaster `LumiSurveyHttpError`, eller en annen feil med `status` som tall. Tidsgrensen, `options.signal` og `LumiSurveyHttpError` finnes fra versjon 2.4.0.

### Egen transport {#egen-transport}

Trenger backenden mer enn en sti, lager dere transporten selv. Det gjelder for eksempel egne headere som `Nav-Call-Id`, egen håndtering av utløpt innlogging eller et annet domene:

```tsx
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
      signal: options?.signal ?? null,
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

Widgeten viser takkesiden når `submit` er ferdig uten feil, så `submit` må kaste en feil når backenden svarer med feil.

### Base-sti {#base-sti}

`endpoint` og `fetch` får ikke base-stien lagt til av seg selv. Har appen `basePath` i `next.config`, setter dere den foran stien med samme konstant:

```tsx
<LumiSurveyDock
  surveyId="min-app-tilbakemelding"
  survey={survey}
  transport={{ endpoint: `${basePath}/api/lumi/feedback` }}
/>
```

I Vite står base-stien i `import.meta.env.BASE_URL`, og den slutter alltid med `/`. Den må være en sti som `/min-app/`, ikke `./`:

```tsx
transport={{ endpoint: `${import.meta.env.BASE_URL}api/lumi/feedback` }}
```

### Next.js App Router {#next-js}

Fra versjon 2.5.0 kan en serverkomponent vise widgeten direkte. Importer den fra `@navikt/lumi-survey/client`:

```tsx
import { LumiSurveyDock } from "@navikt/lumi-survey/client";
import { survey } from "./survey";

export default function Side() {
  return (
    <LumiSurveyDock
      surveyId="min-app-tilbakemelding"
      survey={survey}
      transport={{ endpoint: "/api/lumi/feedback" }}
    />
  );
}
```

`@navikt/lumi-survey/client` har `"use client"`, så Next.js kjører widgeten i nettleseren. Fra en serverkomponent kan dere bare sende data og JSX. `events`, en transport med `submit` og `labels.textTooLong` er funksjoner. De krever en egen fil med `"use client"` øverst, som importerer `LumiSurveyDock` fra `@navikt/lumi-survey`.

Hovedinngangen `@navikt/lumi-survey` har ikke direktivet. En serverkomponent kan bare importere typer derfra, for eksempel `import type { SurveyDocumentV1 }`. Hjelpefunksjoner som `createTopTasksSurveyDocument` må brukes i en klientkomponent.

TypeScript finner typene til `@navikt/lumi-survey/client` med `moduleResolution` satt til `bundler` eller `node16`. Next.js bruker `bundler` som standard.

En serverkomponent leser base-stien når siden rendres. Variabelen trenger derfor ikke prefikset `NEXT_PUBLIC_`, men den må være satt når siden rendres, og for statiske sider er det når appen bygges.

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
