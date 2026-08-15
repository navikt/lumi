---
title: Props-referanse
---

# Props-referanse

Komplett oversikt over alle props for `LumiSurveyDock`-komponenten.

## Top-level props

| Prop | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `surveyId` | `string` | ✅ | Unik identifikator for surveyen (f.eks. `"soknad-kvittering"`) |
| `survey` | `LumiSurveyDefinition` | ✅ | Flat legacy-config eller et versjonert dokument med pages |
| `transport` | `LumiSurveyTransport` | ✅ | Objekt med `submit`-funksjon for innsending |
| `context` | `LumiSurveyContext` | ❌ | Metadata/tags/debug for segmentering |
| `behavior` | `LumiSurveyBehavior` | ❌ | Styrer åpning, lukking, cooldown og storage |
| `events` | `LumiSurveyEvents` | ❌ | Event-callbacks for sporing og livssyklus |
| `labels` | `LumiSurveyLabels` | ❌ | Tekster for UI-elementer |
| `success` | `LumiSurveySuccessConfig` | ❌ | Konfigurer suksess-visning |
| `style` | `LumiSurveyStyle` | ❌ | Visuell styling (posisjon, farger, classNames) |
| `intro` | `LumiSurveyIntroConfig` | ❌ | Intro-skjerm før første spørsmål |

## `survey` — `LumiSurveyDefinition`

`LumiSurveyDefinition` er en union av legacy-formatet under og
`SurveyDocumentV1`.

```ts
interface LumiSurveyConfig {
  /** Survey-type for analytics. Default: "custom" */
  type?: "rating" | "topTasks" | "discovery" | "taskPriority" | "custom";

  /** Alle spørsmål, i rekkefølge */
  questions: LumiSurveyQuestion[];
}
```

Se [Spørsmålstyper](/guider/sporsmalstyper) for detaljer om spørsmål-objektene.

### Flere spørsmål på samme page — `SurveyDocumentV1`

Bruk det versjonerte dokumentformatet når flere spørsmål skal vises og
valideres sammen på ett steg:

```ts
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

const survey = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "opplevelse",
      title: "Om opplevelsen",
      description: "Svar på begge spørsmålene.",
      questions: [
        {
          id: "oppgave",
          type: "text",
          prompt: "Hva prøvde du å gjøre?",
          required: true,
        },
        {
          id: "resultat",
          type: "singleChoice",
          prompt: "Fikk du gjort det?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "nei", label: "Nei" },
          ],
        },
      ],
    },
    {
      id: "utdyping",
      title: "Fortell mer",
      questions: [
        {
          id: "kommentar",
          type: "text",
          prompt: "Hva kan vi forbedre?",
          visibleIf: {
            questionId: "resultat",
            operator: "EQ",
            value: "nei",
          },
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;
```

V1 bruker lineær page-navigasjon med `visibleIf` på spørsmål. `logic` støttes
ikke i dokumentformatet. Svar og submission-definition forblir flate og basert
på question-ID; page-metadata sendes ikke til API-et.

## `transport` — `LumiSurveyTransport`

```ts
interface LumiSurveyTransport {
  submit: (submission: LumiSurveySubmission) => Promise<void>;
}
```

`submission.transportPayload` er den ferdig-formaterte payloaden du sender til din backend. Se [Koble til backend → Sjekkliste](/kom-i-gang/koble-til-backend#komplett-sjekkliste) for oppsett.

## `behavior` — `LumiSurveyBehavior`

Styrer åpning, lukking, lagring og layout.

| Property | Type | Default | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `initialOpen` | `boolean` | `true` | Om docken starter åpen |
| `resetOnClose` | `boolean` | `true` | Nullstill skjema ved lukking |
| `dismissCooldownDays` | `number` | `30` | Dager før dismissed dock vises igjen |
| `hideAfterSubmit` | `boolean` | `true` | Skjul helt etter vellykket innsending |
| `questionLayout` | `"auto" \| "singlePage" \| "steps"` | `"auto"` | Hvordan spørsmål presenteres |
| `showPersonalDataNotice` | `boolean` | `true` | Vis personverninfo |
| `personalDataNotice` | `ReactNode` | ❌ | Tilpasset personverninfo |
| `collectLocation` | `boolean` | `false` | Auto-collect `pathname` fra URL |
| `storageStrategy` | `"consent" \| "localStorage" \| "none"` | `"consent"` | Lagringsstrategi for dismissed-tilstand |
| `showProgress` | `boolean` | `false` | Vis fremdrift med synlig stegtekst fra første spørsmål i stegmodus når surveyen har minst to steg. Lineære løp viser `Steg X av N`; branching viser `Steg X` |

Intro og kvittering regnes ikke som steg. Ved branching viser den visuelle linjen det stabile estimatet, mens tilgjengelig stegtekst bare oppgir sikker informasjon som «Steg 2» uten estimert total.

::: details questionLayout-verdier
- **`"auto"`** (default): Legacy-config bruker dagens branching-regler. Et `SurveyDocumentV1` med flere authored pages bruker page-basert stegmodus.
- **`"singlePage"`**: Alle synlige spørsmål vises på én side. Page-titler og beskrivelser beholdes som struktur.
- **`"steps"`**: Navigerer mellom spørsmål for legacy-config og mellom pages for `SurveyDocumentV1`.
:::

## `labels` — `LumiSurveyLabels`

Tekster for UI-elementer. Alle har fornuftige norske defaults.

| Property | Type | Default | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `submit` | `string` | `"Send inn"` | Send-knapp |
| `submitPending` | `string` | `"Sender inn..."` | Send-knapp under innsending |
| `cancel` | `string` | `"Lukk"` | Lukk-knapp |
| `validationError` | `string` | `"Vennligst fyll ut alle påkrevde felt"` | Valideringsfeilmelding |
| `transportError` | `string` | `"Noe gikk galt ved innsending. Prøv igjen senere."` | Innsendingsfeil |
| `minimizedButton` | `string` | `"Gi tilbakemelding"` | Tekst på minimert knapp |

```tsx
<LumiSurveyDock
  labels={{
    submit: "Send tilbakemelding",
    cancel: "Avbryt",
    minimizedButton: "Hjelp oss å bli bedre",
  }}
/>
```

## `success` — `LumiSurveySuccessConfig`

Konfigurer suksess-skjermen etter innsending.

| Property | Type | Default | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `"Takk for tilbakemeldingen!"` | Overskrift |
| `body` | `ReactNode` | — | Valgfri tekst under overskriften |
| `primaryLabel` | `string` | `"Lukk"` | Knappetekst |
| `autoClose` | `boolean` | `false` | Lukk automatisk etter suksess |
| `autoCloseDelayMs` | `number` | `1600` | Forsinkelse før auto-lukk (ms) |

```tsx
<LumiSurveyDock
  success={{
    title: "Tusen takk!",
    body: "Tilbakemeldingen din hjelper oss å forbedre tjenesten.",
    autoClose: true,
    autoCloseDelayMs: 2000,
  }}
/>
```

## `style` — `LumiSurveyStyle`

Visuell tilpasning av dock-panelet.

| Property | Type | Default | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Posisjon på skjermen |
| `offset` | `number` | `24` | Avstand fra viewport-kant i px |
| `containerClassName` | `string` | — | Ekstra CSS-klasse for container |
| `panelClassName` | `string` | — | Ekstra CSS-klasse for panelet |
| `panelBackground` | Aksel `Box` background-token | `"default"` | Bakgrunnsfarge |
| `panelBorderColor` | Aksel `Box` borderColor-token | `"neutral-subtle"` | Kantfarge |

```tsx
<LumiSurveyDock
  style={{
    position: "bottom-left",
    offset: 16,
    panelBackground: "surface-subtle",
  }}
/>
```

Se [Styling](/guider/styling) for mer om visuell tilpasning.

## `events` — `LumiSurveyEvents`

Event-callbacks for livssyklus og sporing. Se [Events](/referanse/events) for fullstendig dokumentasjon med brukseksempler.

## `intro` — `LumiSurveyIntroConfig`

Viser en intro-skjerm før første spørsmål.

| Property | Type | Default | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `title` | `string` | ✅ (påkrevd) | Overskrift på intro-skjermen |
| `body` | `ReactNode` | — | Valgfri brødtekst |
| `startLabel` | `string` | `"Start"` | Knappetekst for å starte surveyen |

```tsx
<LumiSurveyDock
  intro={{
    title: "Hjelp oss å forbedre tjenesten",
    body: "Det tar bare 30 sekunder. Alle svar er anonyme.",
    startLabel: "Gi tilbakemelding",
  }}
/>
```

## `context` — `LumiSurveyContext`

Metadata for segmentering og feilsøking. Se [Context & tags](/guider/context-og-tags) for fullstendig dokumentasjon.

```ts
interface LumiSurveyContext {
  // Auto-collected
  viewport?: { width: number; height: number };
  deviceType?: "mobile" | "tablet" | "desktop";
  userAgent?: string;

  // Opt-in (krever collectLocation: true)
  url?: string;
  pathname?: string;

  // Manuelt satt
  tags?: Record<string, string | number | boolean>;
  debug?: Record<string, unknown>;
}
```
