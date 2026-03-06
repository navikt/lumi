---
title: Styling
---

# Styling

Lumi-widgeten er bygget med Aksel (NAVs designsystem) og krever to CSS-importer for å fungere riktig.

## CSS-import

Begge importene er **påkrevd** — uten dem vil layouten se ødelagt ut:

```tsx
import "@navikt/ds-css";              // Aksel base-styles
import "@navikt/lumi-survey/styles.css"; // Lumi widget-styles
```

::: warning Mangler CSS?
Hvis widgeten vises uten styling (ingen farger, rar layout), sjekk at begge CSS-importene er med. Se også [Feilsøking](/feilsoking#layout-virker-tom).
:::

## `style`-prop

Du kan justere posisjon, farger og legge til egne CSS-klasser via `style`-propen:

```tsx
<LumiSurveyDock
  surveyId="min-flate"
  survey={survey}
  transport={transport}
  style={{
    position: "bottom-left",
    offset: 16,
    panelBackground: "surface-subtle",
    panelBorderColor: "neutral-subtle",
    containerClassName: "min-ekstra-klasse",
  }}
/>
```

### Tilgjengelige style-properties

| Property | Type | Default | Beskrivelse |
| :--- | :--- | :--- | :--- |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Posisjon på skjermen |
| `offset` | `number` | `24` | Avstand fra viewport-kant i px |
| `containerClassName` | `string` | — | Ekstra CSS-klasse for ytre container |
| `panelClassName` | `string` | — | Ekstra CSS-klasse for panelet |
| `panelBackground` | Aksel background-token | `"default"` | Bakgrunnsfarge (Aksel `Box`-token) |
| `panelBorderColor` | Aksel borderColor-token | `"neutral-subtle"` | Kantfarge (Aksel `Box`-token) |

## Aksel-kompatibilitet

Widgeten bruker Aksel-komponenter og tokens internt. Det betyr at den automatisk følger Aksels:

- **Typografi** — `@navikt/ds-css` gir riktige fonter og tekststørrelser
- **Spacing** — `space-*`-tokens brukes for konsistent avstand
- **Farger** — tokens som `surface-subtle`, `neutral-subtle` osv.

Du kan bruke alle Aksel `Box`-kompatible background- og borderColor-tokens i `panelBackground` og `panelBorderColor`.

## Storybook

For å se widgeten i ulike konfigurasjoner, bruk Storybook:

🔗 **[Lumi Storybook](https://navikt.github.io/lumi/storybook/)**

Storybook inneholder eksempler med ulike presets, rating-varianter, styling-alternativer og branching-logikk.
