# Lumi Survey

Aksel-basert React-widget for å samle inn brukertilbakemeldinger via Lumi.

## Kom i gang

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { DEFAULT_SURVEY_RATING, LumiSurveyDock } from "@navikt/lumi-survey";

const transport = {
  async submit(submission) {
    await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};

export function App() {
  return (
    <LumiSurveyDock
      surveyId="my-app-feedback"
      survey={DEFAULT_SURVEY_RATING}
      transport={transport}
    />
  );
}
```

## Installasjon

I dette monorepoet bruker vi workspaces (ingen publisering nødvendig).

For eksterne konsumenter (hvis vi publiserer senere):

```sh
npm install @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

### Install fra GitHub Packages

Du må ha `.npmrc` som peker `@navikt` til GitHub Packages, f.eks:

```properties
@navikt:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

For eksterne flater som bruker NAV dekoratørens consent/storage API:

```sh
npm install @navikt/nav-dekoratoren-moduler
```

## Bidra / lage ny versjon

Se `CONTRIBUTING.md` for hvordan vi lager nye versjoner av `@navikt/lumi-survey`.

## Survey-presets

```tsx
import {
  LumiSurveyDock,
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_DISCOVERY,
  createTopTasksSurvey,
  createTaskPrioritySurvey,
} from "@navikt/lumi-survey";

<LumiSurveyDock surveyId="rating" survey={DEFAULT_SURVEY_RATING} transport={transport} />;

<LumiSurveyDock surveyId="discovery" survey={DEFAULT_SURVEY_DISCOVERY} transport={transport} />;

const topTasks = createTopTasksSurvey({
  tasks: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
  ],
});

const taskPriority = createTaskPrioritySurvey({
  tasks: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
  ],
});
```

## Transport

Vi støtter én måte å sende inn tilbakemeldinger på:

- Widgeten sender `submission.transportPayload` til din egen backend (API-route/server action), f.eks. `/api/lumi/feedback`.
- Backenden gjør token exchange (TokenX/OBO eller AzureAD) og videresender til `lumi-api`.

Viktig: Widgeten skal **ikke** poste direkte til `lumi-api` fra browser.

### Widget (browser → din backend)

```ts
import type { LumiSurveyTransport } from "@navikt/lumi-survey";

export const transport: LumiSurveyTransport = {
  async submit(submission) {
    await fetch("/api/lumi/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};
```

Server-side (API-route/server action) gjør token exchange og videresender til `lumi-api`.

Detaljert eksempel ligger i repoets rot-README.

## Kontekst (context)

Widgeten kan sende med ekstra kontekst som brukes til segmentering og debugging.

Dette blir alltid auto-collectet i browser:

- `viewport` (bredde/høyde fra `window.innerWidth/innerHeight`)
- `deviceType` (en grov kategori basert på viewport-bredde: mobile/tablet/desktop)
- `userAgent`

Merk: `deviceType` er **ikke** “hvilken maskin brukeren har”, men en viewport-breakpoint.
Hvis brukeren har DevTools åpent, kan viewport bli smalere og dermed gi f.eks. `tablet`.

### URL/pathname og personvern

- `url` auto-collectes aldri.
- `pathname` auto-collectes heller ikke som default.

Hvis dere har statiske ruter uten identifikatorer, kan dere opt-in til å auto-collecte
`pathname`:

```tsx
<LumiSurveyDock
  behavior={{ collectLocation: true }}
  // ...
/>
```

Hvis rutene kan inneholde ID-er (f.eks. `/sak/123`), skal dere **ikke** bruke `collectLocation`.
Send heller inn en sanitert verdi via `context`, for eksempel en route-key eller template:

```tsx
<LumiSurveyDock
  context={{ pathname: "/sak/:id" }}
  // ...
/>
```

## Consent/storage

Widgeten støtter valgfri persistering av "dismissed" til localStorage, og kan integrere med `@navikt/nav-dekoratoren-moduler` for å respektere consent/allowlist.

Merk: av kompatibilitetshensyn kan storage-nøkkel fortsatt bruke `flexjar-*` mønsteret (se [MIGRATION.md](../../MIGRATION.md)).
