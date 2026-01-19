# Lumi Survey

Aksel-basert React-widget for å samle inn brukertilbakemeldinger via Lumi.

## Quick Start

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import {
  LumiSurveyDock,
  DEFAULT_SURVEY_RATING,
  createLumiApiTransport,
} from "@navikt/lumi-survey";

const transport = createLumiApiTransport({
  // endpoint: "https://lumi-api.intern.nav.no/api/v1/feedback",
});

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

## Installation

I dette monorepoet bruker vi workspaces (ingen publisering nødvendig).

For eksterne konsumenter (hvis vi publiserer senere):

```sh
npm install @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

For eksterne flater som bruker NAV dekoratørens consent/storage API:

```sh
npm install @navikt/nav-dekoratoren-moduler
```

## Bidra / lage ny versjon

Se `CONTRIBUTING.md` for hvordan vi lager nye versjoner av `@navikt/lumi-survey`.

## Survey presets

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

### Bruk innebygget Lumi API-transport

`createLumiApiTransport()` POST-er payload til Lumi API.

Merk: widgeten gjør ikke runtime-validering av payload (for å holde pakken lettbeint). Backend validerer uansett.

```ts
import { createLumiApiTransport } from "@navikt/lumi-survey";

const transport = createLumiApiTransport({
  // default: /api/v1/feedback
  baseUrl: "https://lumi-api.intern.dev.nav.no",
  // getHeaders: async () => ({ Authorization: `Bearer ${token}` }),
});

Tips: TypeScript-typer følger med pakken (via `dist/*.d.ts`). Om du vil referere til kontrakt-typene eksplisitt kan du importere dem fra `@navikt/lumi-survey`.

Eksempel:

```ts
import type { LumiApiFeedbackSubmissionV1 } from "@navikt/lumi-survey";
```
```

### Egen transport

```ts
import type { LumiSurveyTransport } from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  async submit(submission) {
    await fetch("/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};
```

## Consent/storage

Widgeten støtter valgfri persistering av "dismissed" til localStorage, og kan integrere med `@navikt/nav-dekoratoren-moduler` for å respektere consent/allowlist.

Merk: av kompatibilitetshensyn kan storage-nøkkel fortsatt bruke `flexjar-*` mønsteret (se [MIGRATION.md](../../MIGRATION.md)).
