---
title: Context & tags
---

# Context & tags

Kontekst gir deg metadata om *hvem* og *hvor* tilbakemeldingen kom fra — uten å samle personopplysninger. Bruk det til å segmentere data i dashboardet.

## Automatisk innsamling

Widgeten samler automatisk disse verdiene fra browseren:

| Felt | Type | Beskrivelse |
| :--- | :--- | :--- |
| `viewport` | `{ width, height }` | Nettleservinduets dimensjoner |
| `screenResolution` | `{ width, height }` | Skjermens dimensjoner rapportert av nettleseren |
| `deviceType` | `"mobile" \| "tablet" \| "desktop"` | Basert på viewport-bredde (ikke fysisk enhet) |
| `userAgent` | `string` | Nettleserens user agent-streng |

::: info deviceType er viewport-basert
`deviceType` utledes fra viewport-bredde, ikke den fysiske enheten. Hvis DevTools er åpent, kan viewporten bli smalere enn forventet.
:::

### Hva som *ikke* samles inn automatisk

`url` og `pathname` samles **ikke** automatisk. Dette er bevisst — dynamiske ruter kan inneholde identifikatorer (f.eks. `/sak/12345`).

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

### `context.debug` — høy kardinalitet OK

Debug-verdier vises kun i detaljvisningen for enkeltinnsendinger. De brukes *ikke* til grafer eller segmentering.

```tsx
<LumiSurveyDock
  surveyId="sykefravarsoppfolging"
  survey={survey}
  transport={transport}
  context={{
    tags: { rolle: "arbeidsgiver" },
    debug: {
      sessionId: "abc-123",
      buildVersion: "2.4.1",
    },
  }}
/>
```

### Oppsummering

| Felt | Kardinalitet | Brukes til | Eksempel |
| :--- | :--- | :--- | :--- |
| `context.tags` | Lav | Segmentering, grafer i dashboard | `rolle`, `tjeneste`, `abTest` |
| `context.debug` | Høy OK | Feilsøking av enkeltinnsendinger | `sessionId`, `buildVersion` |

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
    debug: {
      sessionId: crypto.randomUUID(),
    },
  }}
/>
```

## Personvernprinsipper

::: warning Ikke samle identifikatorer
- Bruk aldri person-ID, fødselsnummer, eller behandlings-ID i `context`
- Unngå `collectLocation: true` på dynamiske ruter med ID-er i URL-en
- `tags` skal ha lav kardinalitet — ikke bruk unike verdier
- Backend (lumi-api) maskerer PII automatisk, men unngå å sende det i utgangspunktet
:::

Lumi er designet for **privacy by design** — all data forblir i Nav-clusteret, og PII reduseres i hele kjeden. Kontekst-feltet skal brukes til å forstå *mønstre*, ikke identifisere enkeltpersoner.
