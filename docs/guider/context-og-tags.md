---
title: Context og tags
---

# Context og tags

Konteksten forteller hvor og i hvilken situasjon brukeren svarte. Bruk verdier med få varianter når dere vil segmentere svarene i dashboardet, og ikke legg person- eller saksidentifikatorer i konteksten.

## Automatisk innsamling

Widgeten henter disse verdiene fra nettleseren:

| Felt | Type | Beskrivelse |
| :--- | :--- | :--- |
| `viewport` | `{ width, height }` | Størrelsen på nettleservinduet |
| `screenResolution` | `{ width, height }` | Skjermstørrelsen slik nettleseren oppgir den |
| `deviceType` | `"mobile" \| "tablet" \| "desktop"` | Bestemmes først ut fra nettleserens device hints og user agent. Vindusbredden brukes hvis de ikke gir svar |
| `userAgent` | `string` | User agent-strengen til nettleseren |

::: info Slik bestemmes deviceType
`deviceType` er et anslag. Widgeten ser først etter kjente tegn på nettbrett, deretter på nettleserens Client Hints og mønstre i user agent. Bredden på vinduet brukes bare når ingen av disse gir svar. I forhåndsvisningen i Surveyverksted bestemmes `deviceType` bare ut fra bredden i `behavior.simulatedViewport`.
:::

### Dette samles ikke inn automatisk

Widgeten samler aldri inn `url` av seg selv. `pathname` samles bare inn hvis dere slår på `collectLocation`. Grunnen er at dynamiske ruter kan inneholde identifikatorer, for eksempel `/sak/12345`.

## Samle inn `pathname` med `collectLocation`

Hvis rutene i appen er faste og ikke inneholder identifikatorer, kan dere la widgeten samle inn `pathname`:

```tsx
<LumiSurveyDock
  surveyId="min-app-tilbakemelding"
  survey={survey}
  transport={transport}
  behavior={{ collectLocation: true }}
/>
```

Hvis rutene kan inneholde ID-er, sender dere heller ruten med en plassholder i `context`:

```tsx
<LumiSurveyDock
  surveyId="min-app-tilbakemelding"
  survey={survey}
  transport={transport}
  context={{ pathname: "/sak/:id" }}
/>
```

## Forskjellen mellom `tags` og `debug`

I tillegg til `url` og `pathname` har `context` to felt der dere kan legge inn egne verdier.

### `context.tags`: lav kardinalitet

Tags brukes til segmentering og grafer i dashboardet. Verdiene skal fungere som filtre, så hold kardinaliteten lav.

```tsx
<LumiSurveyDock
  surveyId="sykefravarsoppfolging"
  survey={survey}
  transport={transport}
  context={{
    tags: {
      abTest: "A",
      rolle: "arbeidsgiver",
      tjeneste: "dine-sykmeldte",
    },
  }}
/>
```

Gode tags er for eksempel `rolle: "arbeidsgiver"`, `abTest: "A"` og `steg: "kvittering"`. `behandlingId: "abc-123"` og `timestamp: 1699000000` er dårlige tags, fordi nesten hver innsending får sin egen verdi.

### `context.debug`: mange varianter, vises ikke i dashboardet

Verdiene i `debug` lagres med innsendingen, men vises verken i dashboardet eller i eksporten, og de brukes ikke til grafer eller segmentering. Ikke send person-, saks- eller andre identifikatorer i feltet.

```tsx
<LumiSurveyDock
  surveyId="sykefravarsoppfolging"
  survey={survey}
  transport={transport}
  context={{
    tags: { rolle: "arbeidsgiver" },
    debug: {
      buildVersion: "2.4.1",
      featureVariant: "ny-kvittering",
    },
  }}
/>
```

### `tags` og `debug` side om side

| Felt | Kardinalitet | Brukes til | Eksempel |
| :--- | :--- | :--- | :--- |
| `context.tags` | Lav | Segmentering og grafer i dashboardet | `rolle`, `tjeneste`, `abTest` |
| `context.debug` | Mange varianter går fint | Lagres, men vises ikke i dashboardet eller eksporten | `buildVersion`, `featureVariant` |

## Komplett eksempel

```tsx
<LumiSurveyDock
  surveyId="dine-sykmeldte-tilbakemelding"
  survey={survey}
  transport={transport}
  behavior={{ collectLocation: false }}
  context={{
    pathname: "/dine-sykmeldte",
    tags: {
      abTest: "A",
      rolle: "arbeidsgiver",
    },
  }}
/>
```

## Personvern

::: warning Ikke samle inn identifikatorer
- Bruk aldri person-ID, fødselsnummer eller behandlings-ID i `context`.
- Unngå `collectLocation: true` på dynamiske ruter med ID-er i URL-en.
- `tags` skal ha lav kardinalitet. Ikke bruk unike verdier.
- Lumi API maskerer kjente mønstre for personopplysninger i URL, pathname, tags og debug-data ved lagring. Se [hvor og når maskering skjer](/referanse/sikkerhet#pii-feltdekning). Unngå å sende personopplysninger i det hele tatt.
:::

Maskeringen er mønsterbasert og erstatter ikke dataminimering. Legg ikke inn noe i konteksten som kan identifisere enkeltpersoner.
