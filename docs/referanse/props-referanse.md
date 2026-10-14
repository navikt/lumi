---
title: Props-referanse
---

# Props-referanse

Setter dere opp widgeten for første gang, start med [Legg surveyen i appen](/kom-i-gang/konfigurer-survey).

## Props på `LumiSurveyDock`

| Prop | Type | Påkrevd | Beskrivelse |
| :--- | :--- | :---: | :--- |
| `surveyId` | `string` | Ja | Stabil identifikator for analyseserien |
| `survey` | `LumiSurveyDefinition` | Ja | Survey-dokumentet fra Surveyverksted eller kode |
| `transport` | `LumiSurveyTransport` | Ja | Sender inn svarene |
| `context` | `LumiSurveyContext` | Nei | Metadata for segmentering og feilsøking |
| `behavior` | `LumiSurveyBehavior` | Nei | Styrer åpning, lukking, framdrift og lagring |
| `events` | `LumiSurveyEvents` | Nei | Funksjoner som kalles ved hendelser i widgeten |
| `labels` | `LumiSurveyLabels` | Nei | Tekster for knapper og feilmeldinger |
| `intro` | `LumiSurveyIntroConfig` | Nei | Overstyrer innhold på velkomstsiden per felt |
| `success` | `LumiSurveySuccessConfig` | Nei | Overstyrer takkesiden etter innsending per felt |
| `style` | `LumiSurveyStyle` | Nei | Visuell tilpasning av widgeten |

## `survey`: `SurveyDocumentV1`

`SurveyDocumentV1` beskriver innholdet i surveyen. Surveyverksted eksporterer dette formatet.

```typescript
interface SurveyDocumentV1 {
  authoringSchemaVersion: 1;
  type?: "rating" | "topTasks" | "discovery" | "taskPriority" | "custom";
  intro?: {
    title: string;
    body?: string;
    startLabel?: string;
  };
  pages: [SurveyPageV1, ...SurveyPageV1[]];
  success?: {
    title: string;
    body?: string;
  };
}

interface SurveyPageV1 {
  id: string;
  title?: string;
  description?: string;
  questions: [SurveyQuestionV1, ...SurveyQuestionV1[]];
}
```

Dokumentet må ha minst én side, og hver side må ha minst ett spørsmål. Side- og spørsmåls-ID-er skal være stabile og unike i dokumentet.

`type` sendes som `surveyType` og er en del av definisjonen som Lumi API låser for `surveyId`. Utelater dere `type`, sendes surveyen som `custom`. Flytter dere en eldre survey som hadde en annen type, til `SurveyDocumentV1`, må dere sette samme `type` som før. Ellers svarer API-et med 409. Se [Survey-identitet og endringer](/guider/survey-identitet).

```typescript
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

const survey = {
  authoringSchemaVersion: 1,
  type: "custom",
  intro: {
    title: "Fortell oss om opplevelsen din",
    startLabel: "Start",
  },
  pages: [
    {
      id: "opplevelse",
      title: "Om kontakten med Nav",
      description: "Tenk på den siste gangen du tok kontakt.",
      questions: [
        {
          id: "kanal",
          type: "singleChoice",
          prompt: "Hvordan tok du kontakt?",
          required: true,
          options: [
            { value: "telefon", label: "Telefon" },
            { value: "chat", label: "Chat" },
          ],
        },
        {
          id: "resultat",
          type: "singleChoice",
          prompt: "Fikk du hjelpen du trengte?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "nei", label: "Nei" },
          ],
        },
      ],
    },
    {
      id: "oppfolging",
      questions: [
        {
          id: "forbedring",
          type: "text",
          prompt: "Hva kunne vært bedre?",
          visibleIf: {
            questionId: "resultat",
            operator: "EQ",
            value: "nei",
          },
        },
      ],
    },
  ],
  success: {
    title: "Svaret er sendt inn",
  },
} satisfies SurveyDocumentV1;
```

Spørsmålene på en side vises og valideres sammen. En side uten synlige spørsmål hoppes over. `visibleIf` kan vise til tidligere spørsmål i dokumentet. Sidene vises alltid i den rekkefølgen de står i.

Svarene og `definition` i innsendingsdataene er fortsatt flate og bruker spørsmåls-ID. Sidetittel, sidebeskrivelse og side-ID sendes ikke til API-et.

Se [Sider og flyt](/guider/sider-og-flyt) og [Spørsmålstyper](/guider/sporsmalstyper).

## `transport`: `LumiSurveyTransport`

```typescript
interface LumiSurveyTransport {
  submit: (submission: LumiSurveySubmission) => Promise<void>;
}
```

Send `submission.transportPayload` til endepunktet i appen deres. Se [Koble til backend](/kom-i-gang/koble-til-backend#_3-send-inn-svar-til-lumi-api).

## `behavior`: `LumiSurveyBehavior`

| Felt | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `initialOpen` | `boolean` | `true` | Om widgeten starter åpen |
| `resetOnClose` | `boolean` | `true` | Nullstill svar når brukeren lukker |
| `dismissCooldownDays` | `number` | `30` | Dager før en lukket widget vises igjen. `0` betyr at lukkingen ikke utløper |
| `hideAfterSubmit` | `boolean` | `true` | Skjul widgeten etter vellykket innsending |
| `questionLayout` | `"auto" \| "singlePage" \| "steps"` | `"auto"` | Hvordan sidene vises |
| `showPersonalDataNotice` | `boolean` | `true` | Vis informasjon om personopplysninger |
| `personalDataNotice` | `ReactNode` | – | Egen informasjon om personopplysninger |
| `collectLocation` | `boolean` | `false` | Samle inn `pathname` automatisk |
| `storageStrategy` | `"consent" \| "localStorage" \| "none"` | `"consent"` | Hvordan widgeten husker at brukeren har lukket |
| `showProgress` | `boolean` | `false` | Vis framdrift når minst to steg kan nås |
| `initialPageId` | `string` | – | Start på denne synlige siden. Laget for innebygd forhåndsvisning |
| `simulatedViewport` | `{ width: number; height: number }` | – | Simuler størrelse og enhetstype i innebygd forhåndsvisning |

### `questionLayout`

- `auto` er standard og anbefalt. Et dokument med flere sider vises stegvis. Et dokument med én side viser alle spørsmålene samtidig.
- `singlePage` viser alle synlige sider samtidig. Sidetitler og beskrivelser beholdes.
- `steps` har samme sidebaserte resultat som `auto` for et dokument med flere sider. Verdien finnes hovedsakelig av hensyn til eldre konfigurasjoner.

Velkomstsiden og takkesiden er ikke med i framdriften.

## `labels`: `LumiSurveyLabels`

| Felt | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `submit` | `string` | `"Send"` | Knapp for innsending |
| `submitPending` | `string` | `"Sender…"` | Knapp mens innsending pågår |
| `cancel` | `string` | `"Lukk"` | Knapp for å lukke |
| `validationError` | `string` | `"Du må svare på spørsmålet."` | Feil ved manglende svar |
| `validationSummary` | `string` | `"Du må rette svarene før du kan fortsette:"` | Overskrift når flere svar må rettes |
| `textTooLong` | `(maxLength: number) => string` | `` `Svaret kan ikke være lengre enn ${maxLength} tegn.` `` | Lager feilmeldingen når et fritekstsvar er for langt |
| `transportError` | `string` | `"Kunne ikke sende tilbakemeldingen. Prøv igjen senere."` | Feil ved innsending |
| `minimizedButton` | `string` | `"Gi tilbakemelding"` | Knapp når widgeten er minimert |

```tsx
<LumiSurveyDock
  labels={{
    submit: "Send tilbakemelding",
    cancel: "Avbryt",
    validationSummary: "Se over disse svarene:",
    textTooLong: (maxLength) =>
      `Svaret kan ha høyst ${maxLength} tegn.`,
    minimizedButton: "Hjelp oss å bli bedre",
  }}
/>
```

## Innhold før og etter spørsmålene

Legg vanlig tekst til velkomstsiden og takkesiden i `SurveyDocumentV1`. Da følger innholdet surveyen fra Surveyverksted til kode.

Propsene `intro` og `success` er overstyringer for appen som viser widgeten. De slås sammen med dokumentet per felt. Felt dere ikke setter, beholder verdien fra dokumentet.

```tsx
<LumiSurveyDock
  {...otherProps}
  survey={survey}
  intro={{
    title: "Fortell oss om opplevelsen din",
    body: <AppSpecificPrivacyText />,
  }}
  success={{
    primaryLabel: "Til forsiden",
    autoClose: true,
    autoCloseDelayMs: 2000,
  }}
/>
```

I eksempelet beholder widgeten `intro.startLabel`, `success.title` og `success.body` fra dokumentet. `intro.title` må være med når dere sender `intro` som prop, fordi prop-typen krever en tittel.

### `intro`: `LumiSurveyIntroConfig`

| Felt | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Påkrevd når `intro`-prop-en settes | Overskrift på velkomstsiden |
| `body` | `ReactNode` | – | Innhold under overskriften |
| `startLabel` | `string` | `"Start"` | Knapp som starter surveyen |

En tom `startLabel` faller tilbake til `"Start"`. En velkomstside med tom dokumenttittel vises ikke. Utkast kan være ufullstendige, men en versjon fra Surveyverksted må ha en tittel.

### `success`: `LumiSurveySuccessConfig`

| Felt | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `"Takk for tilbakemeldingen!"` | Overskrift etter innsending |
| `body` | `ReactNode` | – | Innhold under overskriften |
| `primaryLabel` | `string` | `"Lukk"` | Tekst på hovedknappen |
| `autoClose` | `boolean` | `false` | Lukk automatisk etter innsending |
| `autoCloseDelayMs` | `number` | `1600` | Tid før automatisk lukking, i millisekunder |

Hvis `success.title` i dokumentet er tom, bruker widgeten standardteksten på takkesiden.

## `style`: `LumiSurveyStyle`

| Felt | Type | Standard | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Plassering på skjermen |
| `offset` | `number` | `24` | Avstand fra kanten, i piksler |
| `containerClassName` | `string` | – | Ekstra CSS-klasse for beholderen |
| `panelClassName` | `string` | – | Ekstra CSS-klasse for panelet |
| `panelBackground` | Aksel `Box`-token | `"default"` | Bakgrunnsfarge |
| `panelBorderColor` | Aksel `Box`-token | `"neutral-subtle"` | Kantfarge |
| `panelMaxHeight` | `string` | `"calc(100vh - 2rem)"` | Største høyde for panelet |

Se [Styling](/guider/styling).

## `events`: `LumiSurveyEvents`

Se [Events](/referanse/events) for alle funksjonene og eksempler.

## `context`: `LumiSurveyContext`

```typescript
interface LumiSurveyContext {
  viewport?: { width: number; height: number };
  screenResolution?: { width: number; height: number };
  deviceType?: "mobile" | "tablet" | "desktop";
  userAgent?: string;
  url?: string;
  pathname?: string;
  tags?: Record<string, string | number | boolean>;
  debug?: Record<string, unknown>;
}
```

Se [Context og tags](/guider/context-og-tags) for personvernråd og eksempler.

## Eldre konfigurasjoner

`LumiSurveyDefinition` godtar fortsatt den eldre, flate `LumiSurveyConfig`. Presets, builder-funksjoner, `logic` og spørsmålsbasert `questionLayout: "steps"` fortsetter også å virke i 2.x. Ikke bruk disse mekanismene i nye surveyer.

Se [Migrer en eldre survey](/referanse/migrer-eldre-survey) hvis dere vedlikeholder en eksisterende konfigurasjon.
