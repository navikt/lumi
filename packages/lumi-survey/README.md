# Lumi Survey

> 📖 **Ny bruker?** Se [Kom i gang-guiden](https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi) for å komme raskt i gang.

Aksel-basert React-widget for å samle inn brukertilbakemeldinger via Lumi.

> **Ny her?** Følg [Kom i gang](../../README.md#kom-i-gang) i rot-README for installasjon, backend-oppsett og NAIS-tilgang. Denne guiden dekker widget-konfigurasjon og avanserte features.

## Sett opp en survey

Her er et komplett eksempel — en emoji-rating med valgfri oppfølgingstekst:

```tsx
import "@navikt/ds-css";
import "@navikt/lumi-survey/styles.css";

import { LumiSurveyDock } from "@navikt/lumi-survey";
import type { LumiSurveyTransport } from "@navikt/lumi-survey";

const transport: LumiSurveyTransport = {
  submit: async (submission) => {
    await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
    });
  },
};

const survey = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var opplevelsen din?",
      required: true,
    },
    {
      id: "feedback",
      type: "text",
      prompt: "Har du andre tilbakemeldinger?",
      maxLength: 1000,
      visibleIf: { field: "ANSWER", questionId: "rating", operator: "EXISTS" },
    },
  ],
};

<LumiSurveyDock surveyId="min-flate" survey={survey} transport={transport} />;
```

`visibleIf` gjør at tekstfeltet først vises etter at brukeren har valgt en emoji. Se [Progresjon](#progresjon-visibleif) for flere eksempler.

## Spørsmålstyper

En survey er et `LumiSurveyConfig`-objekt med spørsmål i rekkefølge.

### Rating

Fire varianter med ulik skala:

| Variant | Skala | Beskrivelse |
| :--- | :--- | :--- |
| `emoji` | 1–5 | 😡🙁😐😀😍 |
| `thumbs` | 1–2 | 👎👍 |
| `stars` | 1–5 | ⭐⭐⭐⭐⭐ |
| `nps` | 0–10 | Nummerte knapper med lav/høy-label |

```tsx
{
  id: "nps",
  type: "rating",
  variant: "nps",
  prompt: "Hvor sannsynlig er det at du vil anbefale oss?",
  lowLabel: "Lite sannsynlig",
  highLabel: "Svært sannsynlig",
  required: true,
}
```

### Text

Fritekstfelt med valgfri maks-lengde.

```tsx
{
  id: "comment",
  type: "text",
  prompt: "Hva kan vi forbedre?",
  maxLength: 1000,
}
```

### Single choice / Multi choice

```tsx
{
  id: "reason",
  type: "singleChoice",
  prompt: "Hva var du her for å gjøre?",
  options: [
    { value: "apply", label: "Søke om noe" },
    { value: "status", label: "Sjekke status" },
    { value: "other", label: "Annet" },
  ],
}
```

`multiChoice` støtter `variant: "checkbox"` (default) eller `variant: "combobox"` for mange valg.

## Progresjon: `visibleIf`

For de fleste surveyer er det nok å vise oppfølgingsspørsmål kun når det er relevant (progressive disclosure).

```tsx
{
  id: "comment",
  type: "text",
  prompt: "Hva gikk galt?",
  visibleIf: {
    field: "ANSWER",
    questionId: "rating",
    operator: "LT",
    value: 3,
  },
}
```

Operatorer: `EXISTS`, `EQ`, `NEQ`, `GT`, `LT`, `CONTAINS`.

## Storage-strategi

Widgeten husker at brukeren har lukket (dismissed) surveyen, og respekterer en valgfri cooldown-periode før den vises igjen. Du velger *hvordan* den husker dette:

| Flate | Strategi | Merknad |
| :--- | :--- | :--- |
| Sluttbruker (nav.no) | `consent` (default) | Krever at NAV consent API er tilgjengelig på siden |
| Intern (Modia, fagsystemer) | `localStorage` | Ingen ekstra avhengigheter |
| Ingen persistering | `none` | Surveyen vises hver gang |

> ⚠️ **Interne flater (Modia o.l.):** Default er `consent`, som krever NAV consent API (`window.webStorageController`). Uten consent API-et vil widgeten ikke kunne huske at brukeren lukket surveyen. Sett `storageStrategy: "localStorage"`:
>
> ```tsx
> <LumiSurveyDock behavior={{ storageStrategy: "localStorage" }} />
> ```

`consent`-strategien leser direkte fra window-globals (`window.__DECORATOR_DATA__` og `window.webStorageController`) som settes av NAV-dekoratøren på nav.no — ingen ekstra npm-pakke er nødvendig.

<details>
<summary><strong>Ferdiglagde presets</strong></summary>

Pakken eksporterer ferdige surveyer og builder-funksjoner for de vanligste brukscasene:

```tsx
import {
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_DISCOVERY,
  DEFAULT_SURVEY_SERVICE_FEEDBACK,
  createTopTasksSurvey,
  createTaskPrioritySurvey,
  createRatingSurvey,
  createDiscoverySurvey,
} from "@navikt/lumi-survey";
```

| Preset / Builder | Beskrivelse |
| :--- | :--- |
| `DEFAULT_SURVEY_RATING` | Emoji-rating + valgfri fritekst |
| `DEFAULT_SURVEY_DISCOVERY` | "Hva kom du hit for å gjøre?" + oppfølging |
| `DEFAULT_SURVEY_SERVICE_FEEDBACK` | Tjenestevurdering med detaljer |
| `createRatingSurvey({...})` | Tilpasset rating med egne spørsmål og oppfølging |
| `createDiscoverySurvey({...})` | Tilpasset discovery-survey |
| `createTopTasksSurvey({tasks})` | Top Tasks (McGovern-metoden) |
| `createTaskPrioritySurvey({tasks})` | Task Priority / Long Neck-rangering |

Eksempel med builder:

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

<details id="velg-surveytype-playbook">
<summary><strong>Velg surveytype (playbook)</strong></summary>

Rask tommelfingerregel for å velge riktig surveytype. Poenget er å få **handlingsbare** data
med minst mulig friksjon for brukeren.

| Surveytype | Når bruke | Hva du får ut | Typiske fallgruver |
| --- | --- | --- | --- |
| `rating` | "Pulse" etter en konkret oppgave eller flyt | Trend over tid + (valgfri) årsak i fritekst | For generelt spørsmål, for mange spørsmål, for hyppig visning |
| `discovery` | Utforskning: hva kom brukeren hit for å gjøre? | Frie tekstsvar + "fikk du gjort det?" + ev. blocker | For mye tekst, dårlig segmentering, samler identifikatorer i context |
| `topTasks` | Måle suksess for kjerneoppgaver (McGovern) | Suksess/feil per oppgave + blocker-innsikt | For mange/få oppgaver, ikke randomisert rekkefølge, uklare oppgavenavn |
| `taskPriority` | Strategisk: hva er viktigst å prioritere? (Long Neck) | Rangering av viktigste oppgaver (top N) | For få tasks, ikke randomisert, feil UI-variant for mange tasks |
| `custom` | Når du må kombinere eller branch'e | Skreddersydd spørreflyt | Blir fort "for mye", vanskelig å sammenligne over tid |

Anbefaling: Start med `rating` eller `discovery`, og gå videre til `topTasks`/`taskPriority` når dere har en tydelig hypoteseliste.

**Best practices**

- Hold det kort: 1–2 spørsmål er ofte nok (rating + valgfri tekst).
- Still spørsmål om en konkret opplevelse ("etter du gjorde X"), ikke hele produktet.
- Bruk progresjon: vis fritekst først etter at rating er valgt (`visibleIf`).
- Bruk `context.tags` for segmentering (lav kardinalitet), og `context.debug` kun for feilsøking (høy kardinalitet).
- Unngå identifikatorer i `context` (og ikke auto-collect `pathname` på dynamiske ruter).
- Velg en stabil `surveyId` per flate/bruksmønster (ikke per deploy). Bruk ny `surveyId` når du fjerner, endrer navn på eller endrer type/options for spørsmål, for eksempel `min-flate-feedback-v2`.

**Go-live sjekkliste**

- Importer styling: `@navikt/ds-css` og `@navikt/lumi-survey/styles.css`.
- Implementer `transport.submit` som sender `submission.transportPayload` til din backend.
- Gjør token exchange server-side og kall riktig endepunkt (se [Koble til backend](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend)).
- Sett riktig `storageStrategy` (`consent` / `localStorage` / `none`).
- Sjekk NAIS policies og test ende-til-ende (innsending → dashboard).

</details>

## LumiSurveyDock props

| Prop | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `surveyId` | `string` | ✅ | Unik identifikator for surveyen (f.eks. `soknad-kvittering`) |
| `survey` | `LumiSurveyConfig` | ✅ | Konfigurasjonsobjektet for spørsmålene |
| `transport` | `LumiSurveyTransport` | ✅ | Objekt med `submit`-funksjon for innsending |
| `context` | `object` | ❌ | Metadata/tags/debug for segmentering |
| `behavior` | `object` | ❌ | Styrer åpning, lukking, cooldown og storage-strategi |
| `events` | `object` | ❌ | Event-callbacks for sporing og livssyklus |
| `labels` | `object` | ❌ | Tekster for UI-elementer (send-knapp, feilmeldinger) |
| `success` | `object` | ❌ | Konfigurer suksess-visning (tittel, tekst, auto-lukk) |
| `style` | `object` | ❌ | Visuell styling (posisjon, farger, classNames) |

## Transport og payload

Widgeten sender `submission.transportPayload` til din backend. Payloaden er stabil og
versjonert (`schemaVersion: 2`). Den inkluderer:

- `surveyId`, `surveyType`, `submittedAt`, `startedAt`
- `deduplicationKey`: stabil nøkkel som gjør retry trygt
- `definition`: alle spørsmålene i surveyen, også de som ikke er besvart
- `answers`: Normalisert struktur per spørsmål
- `context`: tags/debug/auto-collectet miljøinfo

`surveyId` er en del av datakontrakten. Behold samme `surveyId` når du legger til spørsmål, men bruk ny `surveyId` når du fjerner, endrer navn på eller endrer type/options for spørsmål. Da unngår du å blande ulike datastrukturer i samme analyse.

Backend-oppsett (token exchange, NAIS-tilgang) er beskrevet i [Koble til backend](https://navikt.github.io/lumi/kom-i-gang/koble-til-backend).

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

## Events (hooks)

Registrer event-callbacks ved å sende et `events`-objekt til `LumiSurveyDock`.

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

<details>
<summary><strong>Avansert: branching / skip-logic (`logic`)</strong></summary>

Bruk `logic` når du faktisk må endre flyten (hoppe, skippe, eller avslutte tidlig). Hvis du bare vil vise/skjule oppfølgingsspørsmål, bruk heller `visibleIf`.

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
        {
          condition: { field: "ANSWER", operator: "GT", value: 2 },
          action: { type: "SUBMIT" },
        },
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

</details>

## Feilsøking (vanlige problemer)

- **Survey dukker ikke opp:** Sjekk at `behavior.initialOpen` ikke er satt til `false`, og at
  `storageStrategy` ikke skjuler den pga. cooldown.
- **403 fra API:** Sjekk NAIS access policies på både inn- og utgående trafikk.
- **Ingen data i dashboard:** Verifiser at backend sender `submission.transportPayload` til riktig
  endepunkt (`/api/tokenx/v1/feedback` eller `/api/azure/v1/feedback`).
- **Layout virker "tom":** Sørg for at `@navikt/ds-css` og `@navikt/lumi-survey/styles.css` er importert.
- **Dismissed-tilstand persisteres ikke (intern flate):** Du bruker sannsynligvis default `consent`-strategi uten NAV consent API. Sett `storageStrategy: "localStorage"`.
