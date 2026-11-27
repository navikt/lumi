---
title: Vis surveyen ved innholdet
---

# Vis surveyen ved innholdet

`LumiSurveyInline` viser surveyen som en del av siden, der dere setter inn komponenten. Bruk den når surveyen spør om en bestemt del av siden, for eksempel en kalkulator, en meny eller en microfrontend. Da ser brukeren hva spørsmålet gjelder. Komponenten finnes fra versjon 2.6.0 av `@navikt/lumi-survey`.

`LumiSurveyDock` viser surveyen i et panel nederst i vinduet. Begge komponentene bruker den samme filen fra Surveyverksted og sender svarene på samme måte.

I Surveyverksted velger den som lager surveyen, **Ved innholdet** under **Visning**, og kan skrive hvor surveyen skal stå. Valget og plasseringen står på versjonssiden sammen med et eksempel med `LumiSurveyInline`. Eksempelet setter `surface: "inline"` i `context.tags`, og `placement` med et kort navn laget av plasseringen. Valget og plasseringen følger ikke med i den kopierte TypeScript-filen, så appen bestemmer selv hvilken komponent den bruker, og hvor den står. Se [Hvor og når brukeren ser surveyen](/kom-i-gang/lag-survey#visning).

## Sett inn komponenten

Installer pakken og importer stilarkene som i [Installer widgeten](/kom-i-gang/installer-widget). Sett så `LumiSurveyInline` der surveyen skal stå:

```tsx
import { LumiSurveyInline } from "@navikt/lumi-survey";
import { survey } from "./survey";

export function KalkulatorSide() {
  return (
    <>
      <Kalkulator />
      <LumiSurveyInline
        surveyId="kalkulator-tilbakemelding"
        survey={survey}
        transport={{ endpoint: "/api/lumi/feedback" }}
        headingLevel="3"
        context={{
          tags: { surface: "inline", placement: "under-kalkulator" },
        }}
      />
    </>
  );
}
```

`surveyId`, `survey` og `transport` virker som på `LumiSurveyDock`, se [Legg surveyen i appen](/kom-i-gang/konfigurer-survey). `survey` må være et `SurveyDocumentV1`, som er formatet Surveyverksted eksporterer. Har dere en eldre, flat konfigurasjon, se [Migrer en eldre survey](/referanse/migrer-eldre-survey).

I Next.js App Router importerer dere komponenten fra `@navikt/lumi-survey/client`, se [Next.js App Router](/kom-i-gang/konfigurer-survey#next-js).

Komponenten rendres bare i nettleseren. I en app som rendres på serveren, kommer surveyen til syne når siden er lastet, og innholdet under flytter seg ned.

## Dette er annerledes enn i panelet

| | `LumiSurveyDock` | `LumiSurveyInline` |
| :--- | :--- | :--- |
| Plassering | Fast nederst i vinduet | Der komponenten står i koden |
| Lukking | Lukkeknapp og minimert knapp | Kan ikke lukkes |
| Lagring i nettleseren | Husker at surveyen er lukket eller besvart | Lagrer ingenting |
| Etter innsending | Kvittering med knappen **Lukk** | Kvitteringen blir stående der surveyen var |
| Bredde | 24rem, og 32rem for skalaen fra 0 til 10 | Følger elementet surveyen står i |
| `<form>` | Har sitt eget | Lager ingen |

Surveyen tar ikke fokus når den vises. Når brukeren går til neste side, får en feilmelding eller sender inn, flytter fokus seg til overskriften eller feltet i den samme surveyen. Feiler innsendingen mens brukeren fortsatt er i surveyen, går fokus tilbake til knappen **Send**. Har brukeren gått videre til et felt i appen, blir fokus der. Det gjelder også siden rundt en iframe surveyen står i. Har brukeren rullet bort fra surveyen mens svaret ble sendt, ruller verken siden eller et rullefelt rundt surveyen tilbake. Er kvitteringen kortere enn spørsmålene den erstatter, ruller siden til kvitteringen. Et klikk som ikke flytter fokus, som et museklikk i Safari eller et trykk fra en skjermleser, teller som at brukeren er i surveyen. Et element appen viser fra surveyen med en portal, for eksempel en dialog, er ikke en del av surveyen, heller ikke når portalen er i et annet dokument. Surveyen holder rede på fokus også i et shadow-tre, i et shadow-tre inni et annet og med et rullefelt inni shadow-treet.

### Surveyen vises ved hver sidelast {#ingen-lagring}

`LumiSurveyInline` lagrer ingenting i nettleseren. Surveyen vises derfor uten lagringssamtykke fra Nav-dekoratøren, til alle brukere, også i apper uten dekoratøren. Den husker heller ikke at brukeren har svart. Kvitteringen står til komponenten fjernes fra siden, og ved neste sidelast vises surveyen på nytt.

Appen bestemmer når surveyen vises. Skal den bare vises i en bestemt situasjon, for eksempel etter at brukeren har regnet ut noe i kalkulatoren, rendrer dere komponenten da.

Skal brukere som har svart, slippe å se surveyen igjen, må appen huske det selv. Lagrer dere det i nettleseren på nav.no, må brukeren ha samtykket, se [Lagring](/guider/lagring#consent).

## Bredde og utseende

Rammen rundt surveyen fyller bredden på elementet den står i. Teksten og feltene inni rammen blir høyst 32rem brede, slik at linjene ikke blir for lange i et bredt element. Vil dere ha en smalere survey, setter dere bredden på elementet rundt.

I en smal kolonne krymper ansiktene og stjernene, og skalaen fra 0 til 10 bryter over flere rader. Et ord som er bredere enn kolonnen, brytes.

Står surveyen ved siden av annet innhold i en flex-rad, tar den bredden innholdet trenger, opptil 32rem pluss rammen. Blir det trangt i raden, krymper surveyen ned til 16rem. Har raden ikke plass til 16rem ved siden av det andre innholdet, for eksempel på mobil, stikker surveyen ut av raden. La raden bryte med `flex-wrap: wrap`, eller legg surveyen under innholdet på små skjermer. Skal surveyen fylle resten av raden, setter dere `flex: 1` på den med `containerClassName`.

Med `style` legger dere til egne CSS-klasser og endrer fargene på rammen:

```tsx
<LumiSurveyInline
  surveyId="kalkulator-tilbakemelding"
  survey={survey}
  transport={transport}
  style={{
    panelBackground: "neutral-soft",
    containerClassName: "min-ekstra-klasse",
  }}
/>
```

Feltene står i [`style` i props-referansen](/referanse/props-referanse#inline-style).

## Overskriftsnivå

Overskriften i surveyen er `<h2>` som standard. Sett `headingLevel` til nivået under overskriften for innholdet surveyen hører til. Da stemmer overskriftene på siden for dem som bruker skjermleser. Står kalkulatoren under en `<h2>`, setter dere `headingLevel="3"`.

`headingLevel` kan være `"2"`, `"3"`, `"4"` eller `"5"`. Nivået gjelder overskriften øverst i surveyen, sidetitlene, velkomstsiden, kvitteringen og overskriften over feilmeldingene. Et vurderingsspørsmål som har sin egen overskrift lenger ned i surveyen, får nivået under.

Overskriftene ser like ut uansett nivå.

## Skjemaer i appen {#skjema}

`LumiSurveyInline` lager ikke noe `<form>`-element, og Send-knappen er ikke en innsendingsknapp. Surveyen kan derfor stå inne i et skjema i appen. Knappene i surveyen sender ikke inn skjemaet.

Feltene i surveyen har attributtet `form=""`, så de hører ikke til skjemaet rundt:

- Svarene i surveyen kommer ikke med i `FormData` for skjemaet.
- `form.reset()` fjerner ikke svarene i surveyen.
- Enter i et felt i surveyen sender ikke inn skjemaet. Enter i appens egne felt virker som om surveyen ikke var der.

En HTML-validator melder `form=""` som feil, fordi attributtet skal peke på et skjema. Nettleserne knytter likevel ikke feltene til noe skjema, slik HTML-standarden sier.

## Flere surveyer på samme side

Hver `LumiSurveyInline` er en egen survey med egne svar, egen innsending og egen kvittering. Dere kan bruke samme `surveyId` flere steder, også på samme side. Skill stedene fra hverandre med `context.tags`:

```tsx
<Satser />
<LumiSurveyInline
  surveyId="kalkulator-nytte"
  survey={survey}
  transport={{ endpoint: "/api/lumi/feedback" }}
  headingLevel="3"
  context={{ tags: { surface: "inline", placement: "under-satser" } }}
/>

<Eksempler />
<LumiSurveyInline
  surveyId="kalkulator-nytte"
  survey={survey}
  transport={{ endpoint: "/api/lumi/feedback" }}
  headingLevel="3"
  context={{ tags: { surface: "inline", placement: "under-eksempler" } }}
/>
```

Bruk et fast navn på hvert sted. Se [Skill plasseringene med tags](/guider/context-og-tags#plassering) for hvilke verdier som egner seg.

Bytter dere ut innholdet surveyen gjelder mens komponenten står på siden, gir dere den en ny `key`. Da begynner surveyen forfra:

```tsx
<LumiSurveyInline key={valgtFane} surveyId="kalkulator-nytte" {...resten} />
```

Surveyen begynner også forfra når `surveyId` endres. Svarene og kvitteringen fra den forrige surveyen følger ikke med, og den nye får sin egen visning og svartid.

### Flere React-apper på samme side {#flere-react-apper}

Er siden satt sammen av apper som er bygd hver for seg med hver sin kopi av React, for eksempel microfrontender, må hver app sette `identifierPrefix` når den kaller `createRoot` eller `hydrateRoot`:

```tsx
createRoot(element, { identifierPrefix: "min-app-" }).render(<App />);
```

Uten prefikset kan to apper gi Aksel-komponentene sine de samme ID-ene. Det gjelder alle skjemafelt fra Aksel, også utenfor Lumi. `LumiSurveyInline` gir feltene sine og radioknappenes `name` egne ID-er, så et klikk på en ledetekst svarer alltid i riktig survey. Hjelpetekster og gruppenavn får likevel ID-ene sine fra Aksel og kan bli lest opp feil av skjermlesere uten `identifierPrefix`.

Rendres appen på serveren, må serveren bruke det samme prefikset som `hydrateRoot`, for eksempel i `renderToPipeableStream(<App />, { identifierPrefix: "min-app-" })`.

## Visning og svartid

`onViewDock` kalles én gang, første gang surveyen er synlig i vinduet. Surveyen regnes som synlig når minst halvparten av høyden og halvparten av bredden er på skjermen. Er surveyen høyere eller bredere enn vinduet, holder det at den dekker halve vinduet i den retningen. En survey langt nede på siden teller altså ikke som vist før brukeren har rullet ned til den. Det er selve surveyen som måles. Strekker en flex-rad eller et grid elementet rundt den, teller ikke den tomme plassen. En survey som er usynlig der den står, for eksempel med `visibility: hidden` eller `opacity: 0`, teller ikke før den kan ses.

Står surveyen i et rullefelt som er mindre enn vinduet, regnes det mot rullefeltet, også når rullefeltet er rundt verten til et shadow-tre surveyen står i. Er rullefeltet skalert med `transform`, regnes det mot det rullefeltet viser på skjermen. I en iframe regnes det mot iframen, også når appen rendrer surveyen dit med en portal, og når iframen er skalert med `transform`. I en iframe fra et annet domene vet ikke surveyen hvor høyt nettleservinduet er, og regner mot skjermen. Står den der i en skalert iframe fra samme domene, regnes skjermen om med skaleringen. Mens en del av surveyen er synlig, måles den på nytt fire ganger i sekundet. En bruker som slutter å rulle når grensen er nådd, telles derfor innen et kvart sekund.

Svarer brukeren, klikker i surveyen eller flytter fokus inn i den før det, teller det som en visning. Alle som svarer, er dermed også telt som en visning. En finger som treffer surveyen mens brukeren ruller forbi på en berøringsskjerm, teller ikke. I en nettleser uten `IntersectionObserver` kalles funksjonen når surveyen rendres.

`startedAt` i innsendingen er tidspunktet for visningen. `timeToCompleteMs` regnes fra `startedAt` til brukeren sender inn, og tiden brukeren bruker på resten av siden etter å ha sett surveyen, er med. Feltet er bare med i innsendingen når tiden er over ett sekund og under 30 minutter. `startedAt` og `submittedAt` sendes alltid. I `LumiSurveyDock` er `startedAt` tidspunktet da komponenten ble rendret, eller da brukeren sist lukket panelet. Lukkingen nullstiller klokken med `resetOnClose: true`, som er standard.

`onReset` og `onDismissalPersistFailed` kalles aldri fra `LumiSurveyInline`. De andre funksjonene virker som beskrevet i [Events](/referanse/events).

## Innstillinger som ikke finnes

Disse innstillingene gjelder bare panelet, og TypeScript avviser dem på `LumiSurveyInline`:

- `behavior`: `storageStrategy`, `initialOpen`, `resetOnClose`, `dismissCooldownDays`, `hideAfterSubmit`, `hideMinimizedButton` og `questionLayout: "steps"`
- `style`: `position`, `offset`, `zIndex` og `panelMaxHeight`
- `success`: `primaryLabel`, `autoClose` og `autoCloseDelayMs`
- `labels`: `cancel` og `minimizedButton`

Alle props står i [props-referansen](/referanse/props-referanse#lumisurveyinline).
