---
title: Context & tags
---

# Context & tags

Kontekst gir metadata om *hvor* og i hvilken situasjon tilbakemeldingen kom fra. Bruk lavkardinalitetsverdier til segmentering i dashboardet, og ikke legg person- eller saksidentifikatorer i konteksten.

## Automatisk innsamling

Widgeten samler automatisk disse verdiene fra browseren:

| Felt | Type | Beskrivelse |
| :--- | :--- | :--- |
| `viewport` | `{ width, height }` | Nettleservinduets dimensjoner |
| `screenResolution` | `{ width, height }` | Skjermens dimensjoner rapportert av nettleseren |
| `deviceType` | `"mobile" \| "tablet" \| "desktop"` | Bruker nettleserens device hints og user agent først, med viewport-bredde som fallback |
| `userAgent` | `string` | Nettleserens user agent-streng |

::: info Hvordan deviceType bestemmes
`deviceType` er en best-effort-klassifisering. Widgeten prioriterer kjente nettbrettsignaler, browserens Client Hints og mønstre i user agent før viewport-bredde brukes som fallback. I Surveyverkstedets innebygde preview klassifiseres `deviceType` bevisst fra `behavior.simulatedViewport`, slik at forhåndsvisningen følger den simulerte bredden i stedet for maskinen du bruker.
:::

### Hva som *ikke* samles inn automatisk

`url` samles **aldri** automatisk. `pathname` samles ikke som standard, men kan velges inn med `collectLocation`. Dette er bevisst — dynamiske ruter kan inneholde identifikatorer (f.eks. `/sak/12345`).

## Valgfri innsamling: `collectLocation`

Hvis rutene dine er statiske og ikke inneholder identifikatorer, kan du slå på automatisk location-collecting:

```tsx
<LumiSurveyDock
  surveyId="min-flate"
  survey={survey}
  transport={transport}
  behavior={{ collectLocation: true }}
/>
```

Hvis rutene *kan* inneholde ID-er, send heller en sanitert verdi via `context`:

```tsx
<LumiSurveyDock
  surveyId="min-flate"
  survey={survey}
  transport={transport}
  context={{ pathname: "/sak/:id" }}
/>
```

## Forskjellen mellom `tags` og `debug`

Kontekst-objektet har to separate felt for tilleggsinformasjon:

### `context.tags` — lav kardinalitet

Tags brukes til segmentering og grafer i dashboardet. Hold kardinaliteten lav — verdiene skal fungere som filtere.

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

✅ **Gode tags**: `rolle: "arbeidsgiver"`, `abTest: "A"`, `steg: "kvittering"`

❌ **Dårlige tags**: `behandlingId: "abc-123"`, `timestamp: 1699000000`

### `context.debug` — høy kardinalitet, ikke synlig i dag

Debug-verdier lagres med innsendingen, men inngår ikke i dagens lesemodell og vises derfor verken i dashboardet eller eksport. De brukes *ikke* til grafer eller segmentering. Ikke send person-, saks- eller andre identifikatorer i feltet.

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

### Oppsummering

| Felt | Kardinalitet | Brukes til | Eksempel |
| :--- | :--- | :--- | :--- |
| `context.tags` | Lav | Segmentering, grafer i dashboard | `rolle`, `tjeneste`, `abTest` |
| `context.debug` | Høy OK | Lagres, men er ikke tilgjengelig i dagens lesemodell | `buildVersion`, `featureVariant` |

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

## Personvernprinsipper

::: warning Ikke samle identifikatorer
- Bruk aldri person-ID, fødselsnummer, eller behandlings-ID i `context`
- Unngå `collectLocation: true` på dynamiske ruter med ID-er i URL-en
- `tags` skal ha lav kardinalitet — ikke bruk unike verdier
- Backend maskerer kjente PII-mønstre i URL, pathname, tags og debug-data ved lagring. Se [hvor og når maskering skjer](/referanse/sikkerhet#pii-feltdekning), og unngå å sende personopplysninger i utgangspunktet
:::

Lumi har innebygde personvernmekanismer, men mønsterbasert maskering erstatter ikke dataminimering. Kontekstfeltet skal brukes til å forstå *mønstre*, ikke identifisere enkeltpersoner.
