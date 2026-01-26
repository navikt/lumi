# Lumi Survey

Aksel-basert React-widget for å samle inn brukertilbakemeldinger via Lumi. Dette er
integratørguiden for `@navikt/lumi-survey`.

## Kom i gang (30 sek)

1) Installer

```sh
npm install @navikt/lumi-survey @navikt/ds-react @navikt/ds-css
```

I dette repoet er pakken allerede tilgjengelig via workspaces etter `npm install` i rotmappen.

2) Importer CSS

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";
```

3) Render widgeten og send `submission.transportPayload` til din backend

```tsx
import { LumiSurveyDock } from "@navikt/lumi-survey";

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
      survey={/* se full eksempel under */}
      transport={transport}
    />
  );
}
```

4) Backend gjør token exchange server-side og videresender til `lumi-api`.
Transportflyt og endepunkter er beskrevet i [README.md](../../README.md).

Les mer:
- Presets og builder-funksjoner: [Survey-presets](#survey-presets-raskest-%C3%A5-komme-i-gang) og [Bygg egne surveyer](#bygg-egne-surveyer)
- Valg av surveytype + best practices + go-live: åpne [Velg surveytype (playbook)](#velg-surveytype-playbook)
- Personvern, storage, events, feilsøking: [Kontekst og personvern](#kontekst-og-personvern), [Consent/storage](#consentstorage), [Events](#events-hooks), [Feilsøking](#feils%C3%B8king-vanlige-problemer)

<details>
<summary><strong>Install fra GitHub Packages (valgfritt)</strong></summary>

Du må ha `.npmrc` som peker `@navikt` til GitHub Packages, f.eks:

```properties
@navikt:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_AUTH_TOKEN}
```

For eksterne flater som bruker NAV dekoratørens consent/storage API:

```sh
npm install @navikt/nav-dekoratoren-moduler
```

</details>

<details>
<summary><strong>Kom i gang (smiley/rating) – full eksempel</strong></summary>

Minste mulige integrasjon. Send `submission.transportPayload` til din backend som deretter gjør
token exchange og kaller `lumi-api`. Detaljert transportflyt finnes i
[`README.md`](../../README.md).

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { LumiSurveyDock } from "@navikt/lumi-survey";

const survey = {
  type: "rating",
  questions: [
    {
      id: "plan-til-hjelp",
      type: "rating",
      variant: "emoji",
      prompt: "Er oppfølgingsplanen til hjelp for deg?",
      description: "Alle tilbakemeldinger er til stor nytte for oss",
    },
    {
      id: "begrunnelse",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      description: "Alle tilbakemeldinger er til stor nytte for oss",
      required: false,
      minRows: 3,
      maxLength: 500,
      visibleIf: {
        questionId: "plan-til-hjelp",
        operator: "EXISTS",
      },
    },
  ],
};

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
      survey={survey}
      transport={transport}
    />
  );
}
```

Tips: Bruk et stabilt, beskrivende `surveyId` per flate/bruksmønster, f.eks. `soknad-kvittering`.

</details>

## Survey-presets (raskest å komme i gang)

```tsx
import {
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_DISCOVERY,
  DEFAULT_SURVEY_SERVICE_FEEDBACK,
  createTopTasksSurvey,
  createTaskPrioritySurvey,
  createRatingSurvey,
  LumiSurveyDock,
} from "@navikt/lumi-survey";

<LumiSurveyDock surveyId="rating" survey={DEFAULT_SURVEY_RATING} transport={transport} />;

<LumiSurveyDock surveyId="discovery" survey={DEFAULT_SURVEY_DISCOVERY} transport={transport} />;

<LumiSurveyDock
  surveyId="service-feedback"
  survey={DEFAULT_SURVEY_SERVICE_FEEDBACK}
  transport={transport}
/>;
```

<details>
<summary>Eksempel: Top Tasks survey</summary>

![Bilde av Top Tasks](TODO_LINK)

```tsx
const topTasks = createTopTasksSurvey({
  tasks: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
  ],
});

<LumiSurveyDock surveyId="top-tasks" survey={topTasks} transport={transport} />;
```
</details>

<details>
<summary>Eksempel: Task Priority survey</summary>

```tsx
const taskPriority = createTaskPrioritySurvey({
  tasks: [
    { value: "apply", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status" },
  ],
});

<LumiSurveyDock surveyId="task-priority" survey={taskPriority} transport={transport} />;
```
</details>

<details>
<summary>Eksempel: NPS (0-10) rating</summary>

![Bilde av NPS](TODO_LINK)

```tsx
const nps = {
  type: "rating",
  questions: [
    {
      id: "nps",
      type: "rating",
      variant: "nps",
      prompt: "Hvor sannsynlig er det at du vil anbefale oss?",
      lowLabel: "Lite sannsynlig",
      highLabel: "Svært sannsynlig",
      required: true,
    },
  ],
};

<LumiSurveyDock surveyId="nps" survey={nps} transport={transport} />;
```
</details>

<details>
<summary><strong>Velg surveytype (playbook)</strong></summary>

Dette er en rask tommelfingerregel for å velge riktig surveytype. Poenget er å få <strong>handlingsbare</strong> data
med minst mulig friksjon for brukeren.

| Surveytype | Når bruke | Hva du får ut | Typiske fallgruver |
| --- | --- | --- | --- |
| `rating` | “Pulse” etter en konkret oppgave eller flyt | Trend over tid + (valgfri) årsak i fritekst | For generelt spørsmål, for mange spørsmål, for hyppig visning |
| `discovery` | Utforskning: hva kom brukeren hit for å gjøre? | Frie tekstsvar + “fikk du gjort det?” + ev. blocker | For mye tekst, dårlig segmentering, samler identifikatorer i context |
| `topTasks` | Måle suksess for kjerneoppgaver (McGovern) | Suksess/feil per oppgave + blocker-innsikt | For mange/få oppgaver, ikke randomisert rekkefølge, uklare oppgavenavn |
| `taskPriority` | Strategisk: hva er viktigst å prioritere? (Long Neck) | Rangering av viktigste oppgaver (top N) | For få tasks, ikke randomisert, feil UI-variant for mange tasks |
| `custom` | Når du må kombinere eller branch’e | Skreddersydd spørreflyt | Blir fort “for mye”, vanskelig å sammenligne over tid |

Anbefaling: Start med `rating` eller `discovery`, og gå videre til `topTasks`/`taskPriority` når dere har en tydelig hypoteseliste.

<strong>Best practices</strong>

- Hold det kort: 1–2 spørsmål er ofte nok (rating + valgfri tekst).
- Still spørsmål om en konkret opplevelse (“etter du gjorde X”), ikke hele produktet.
- Bruk progresjon: vis fritekst først etter at rating er valgt (`visibleIf`).
- Bruk `context.tags` for segmentering (lav kardinalitet), og `context.debug` kun for feilsøking (høy kardinalitet).
- Unngå identifikatorer i `context` (og ikke auto-collect `pathname` på dynamiske ruter).
- Velg en stabil `surveyId` per flate/bruksmønster (ikke per deploy).

<strong>Go-live sjekkliste</strong>

- Importer styling: `@navikt/ds-css` og `@navikt/lumi-survey/styles.css`.
- Implementer `transport.submit` som sender `submission.transportPayload` til din backend.
- Gjør token exchange server-side og kall riktig endpoint:
  - TokenX: `POST /api/tokenx/v1/feedback`
  - AzureAD: `POST /api/azure/v1/feedback`
- Sett riktig `storageStrategy` (`consent` / `localStorage` / `none`).
- Sjekk NAIS policies og test ende-til-ende (innsending → dashboard).

</details>

## Bygg egne surveyer

En survey er et `LumiSurveyConfig`-objekt med spørsmål i rekkefølge. Spørsmålstyper:

- `rating` (varianter: `emoji`, `thumbs`, `stars`, `nps`)
- `text`
- `singleChoice`
- `multiChoice` (støtter `variant: "checkbox"` eller `variant: "combobox"`)

Eksempel med progresjon (vis tekstfelt etter rating):

```tsx
const customSurvey = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      prompt: "Hvor fornøyd er du?",
      variant: "emoji",
      required: true,
    },
    {
      id: "comment",
      type: "text",
      prompt: "Hva kan vi forbedre?",
      visibleIf: {
        field: "ANSWER",
        questionId: "rating",
        operator: "EXISTS",
      },
    },
  ],
};

<LumiSurveyDock surveyId="custom" survey={customSurvey} transport={transport} />;
```

### Branching / skip-logic

Bruk `logic` for å hoppe, skippe eller submitte basert på svar.

```tsx
const surveyWithLogic = {
  type: "custom",
  questions: [
    {
      id: "rating",
      type: "rating",
      prompt: "Hvor fornøyd er du?",
      logic: [
        {
          condition: { field: "ANSWER", operator: "LT", value: 3 },
          action: { type: "JUMP_TO", targetId: "comment" },
        },
        { condition: { field: "ANSWER", operator: "GT", value: 2 }, action: { type: "SUBMIT" } },
      ],
    },
    {
      id: "comment",
      type: "text",
      prompt: "Hva kan vi forbedre?",
    },
  ],
};
```

## LumiSurveyDock props (API-overblikk)

| Prop | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `surveyId` | `string` | ✅ | Stabil identifikator for surveyen (f.eks. `soknad-kvittering`) |
| `survey` | `LumiSurveyConfig` | ✅ | Konfigurasjonsobjektet for spørsmålene |
| `transport` | `LumiSurveyTransport` | ✅ | Objekt med `submit`-funksjon for innsending |
| `context` | `object` | ❌ | Metadata/tags/debug for segmentering |
| `behavior` | `object` | ❌ | Styrer åpning, lukking, cooldown og storage-strategi |

## Transport og payload

Widgeten sender `submission.transportPayload` til din backend. Payloaden er stabil og
versjonert (`schemaVersion: 1`). Den inkluderer:

- `surveyId`, `surveyType`, `submittedAt`, `startedAt`
- `answers`: Normalisert struktur per spørsmål
- `context`: tags/debug/auto-collectet miljøinfo

Viktig: Widgeten skal **ikke** poste direkte til `lumi-api` fra browser.

## Kontekst og personvern

Auto-collectes i browser:

- `viewport` (bredde/høyde)
- `deviceType` (mobile/tablet/desktop)
- `userAgent`

`url` og `pathname` auto-collectes ikke som default. Hvis dere har statiske ruter uten
identifikatorer kan dere opt-in:

```tsx
<LumiSurveyDock behavior={{ collectLocation: true }} />
```

Hvis rutene kan inneholde ID-er, send heller en sanitert verdi:

```tsx
<LumiSurveyDock context={{ pathname: "/sak/:id" }} />
```

### Tags vs debug

- `context.tags`: Lav kardinalitet, brukes til segmentering og grafer i dashboard.
- `context.debug`: Høy kardinalitet, kun for detaljvisning av enkeltinnsendinger.

## Consent/storage

Widgeten kan persistere "dismissed" i storage. Velg strategi:

- `consent` (default) for eksterne flater med NAV dekoratør
- `localStorage` for interne flater (f.eks. Modia)
- `none` hvis dere ikke vil persistere i det hele tatt

```tsx
<LumiSurveyDock behavior={{ storageStrategy: "localStorage" }} />
```

## Events (hooks)

```ts
const events = {
  onViewDock: (surveyId) => {},
  onAnswer: (questionId, value) => {},
  onSubmitStart: (submission) => {},
  onSubmitSuccess: (submission) => {},
  onSubmitError: (cause) => {},
  onValidationFailed: (missingQuestionIds) => {},
  onReset: () => {},
  onDismissalPersistFailed: (cause) => {},
};
```

## Storybook (interaktiv demo)

Kjør lokalt:

```sh
npm run storybook:survey
```

Bygg statisk Storybook:

```sh
npm run build-storybook:survey
```

Statisk output ligger i `packages/lumi-survey/storybook-static`.

## Feilsøking (vanlige problemer)

- Survey dukker ikke opp: Sjekk at `behavior.initialOpen` ikke er satt til `false`, og at
  `storageStrategy` ikke skjuler den pga. cooldown.
- 403 fra API: Sjekk NAIS access policies på både inn- og utgående trafikk.
- Ingen data i dashboard: Verifiser at backend sender `submission.transportPayload` til riktig
  endpoint (`/api/tokenx/v1/feedback` eller `/api/azure/v1/feedback`).
- Layout virker “tom”: Sørg for at `@navikt/ds-css` og `@navikt/lumi-survey/styles.css` er importert.

## Bidra / lage ny versjon

Se [`CONTRIBUTING.md`](CONTRIBUTING.md) for hvordan vi lager nye versjoner av `@navikt/lumi-survey`.
