---
title: Styling
---

# Styling

Widgeten er bygget med Aksel, Navs designsystem, og trenger to CSS-importer.

## CSS-import

Begge importene må være med. Uten dem ser layouten ødelagt ut:

```tsx
import "@navikt/ds-css";              // Grunnstilene fra Aksel
import "@navikt/lumi-survey/styles.css"; // Stilene til widgeten
```

::: warning Mangler CSS?
Hvis widgeten vises uten farger og med rar layout, sjekk at begge CSS-importene er med. Se også [Layout virker tom](/guider/feilsoking#layout-virker-tom) i feilsøkingen.
:::

## `style`-prop

Med `style` kan dere endre plassering og farger og legge til egne CSS-klasser:

```tsx
<LumiSurveyDock
  surveyId="min-app-tilbakemelding"
  survey={survey}
  transport={transport}
  style={{
    position: "bottom-left",
    offset: 16,
    panelBackground: "neutral-soft",
    panelBorderColor: "neutral-subtle",
    containerClassName: "min-ekstra-klasse",
  }}
/>
```

### Sider med Frida

Widgeten ligger som standard nederst til høyre, over Frida-chatboten i Nav-dekoratøren. På sider med dekoratøren setter dere `position: "bottom-left"`, med mindre appen har slått av chatboten med `chatbot: false`. På smale skjermer er åpen widget nesten like bred som skjermen og kan dekke Frida uansett plassering.

`position: "bottom-left"` er førstevalget. Fra versjon 2.4.0 finnes to valg til for sider der det ikke er nok:

- `style.zIndex` styrer om widgeten ligger over eller under andre faste elementer. Standard er `1000`, og verdien må være et heltall. Legger dere widgeten under Frida nederst til høyre, dekker Frida en del av det åpne panelet.
- `behavior.hideMinimizedButton: true` viser ingenting når widgeten er minimert. Da ligger det ingen knapp i hjørnet etter at brukeren har lukket surveyen. Får widgeten ikke lagre, for eksempel fordi brukeren ikke har samtykket, starter den minimert, og da ser brukeren aldri surveyen. Se [Uten samtykke](/guider/lagring#uten-samtykke).

### Alle feltene i `style`

Alle feltene står i [`style` i props-referansen](/referanse/props-referanse#style-lumisurveystyle).

## Aksel-kompatibilitet

Widgeten bruker Aksel-komponenter og -tokens og følger derfor Aksel automatisk: Fonter og tekststørrelser kommer fra `@navikt/ds-css`, avstander fra `space-*`-tokenene og farger fra tokens som `neutral-soft` og `neutral-subtle`.

I `panelBackground` og `panelBorderColor` kan dere bruke alle tokens som Aksel-komponenten `Box` godtar i `background` og `borderColor`.

## Storybook

I [Lumi Storybook](https://navikt.github.io/lumi/storybook/) ser dere widgeten i ulike konfigurasjoner. Der finnes eksempler med spørsmålstyper, visuell tilpasning og betinget visning.
