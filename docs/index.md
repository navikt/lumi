---
layout: home
hero:
  name: Lumi
  text: Spør brukerne mens de er i tjenesten
  tagline: Lumi er et surveyverktøy for team i Nav. Surveyen vises i deres egen React-app, og svarene lagres i Lumis database på Nais.
  actions:
    - theme: brand
      text: Kom i gang
      link: /kom-i-gang/hva-er-lumi
    - theme: alt
      text: Se dashboardet med testdata
      link: https://lumi-dashboard-demo.ekstern.dev.nav.no
features:
  - icon: "1"
    title: Lag surveyen i Surveyverksted
    details: Velg hva dere vil finne ut, for eksempel om brukerne fikk gjort det de kom for. Surveyverksted foreslår spørsmålene, og alle på teamet kan endre teksten og legge til egne spørsmål.
    link: /kom-i-gang/lag-survey
    linkText: Lag surveyen
  - icon: "2"
    title: Legg surveyen inn i appen
    details: En utvikler legger TypeScript-koden fra Surveyverksted inn i appen med <code>@navikt/lumi-survey</code>. Appens backend sender svarene videre til Lumi API.
    link: /kom-i-gang/installer-widget
    linkText: Installer widgeten
  - icon: "3"
    title: Les svarene i dashboardet
    details: Dashboardet viser svarene ut fra hva dere valgte å finne ut. Bare medlemmer av Nais-teamet som appen hører til, ser svarene i dashboardet.
    link: /dashboard/tilgang
    linkText: Få tilgang til dashboardet
---

## Slik ser det ut

![Lumi-surveyen åpen nederst til høyre i demoen av kartleggingsspørsmål for sykmeldte, som har samme utseende som nav.no. Den spør hvordan brukeren opplevde å svare på spørsmålene, med fem emojier og et valgfritt tekstfelt.](/bilder/survey-i-nav-no.webp){.skjermbilde}

Surveyen i demoen av kartleggingsspørsmål for sykmeldte. Varselet om personopplysninger under tekstfeltet er med som standard.
{.bildetekst}

![Lumi-dashboardet med testdata. Øverst står antall tilbakemeldinger og andelen med tekst, og under er et søylediagram med antall tilbakemeldinger per dag de siste 30 dagene.](/bilder/dashboard-demo.webp){.skjermbilde}

Oversikten i [dashboardet med testdata](https://lumi-dashboard-demo.ekstern.dev.nav.no).
{.bildetekst}

## Hva dere kan finne ut

Det første dere gjør i [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted), er å velge hva dere vil finne ut. Valget bestemmer hvilke spørsmål surveyen får og hvordan dashboardet viser svarene.

| Valg i Surveyverksted | Dette viser dashboardet |
| :--- | :--- |
| Hvordan opplevde brukeren tjenesten? | Vurderingen over tid og fritekstsvarene |
| Hva kom brukeren for å gjøre? | Hva brukerne kom for å gjøre, med egne ord, og om de fikk det til |
| Lyktes brukeren med en kjent oppgave? | Resultat og hindringer per oppgave, og suksessraten over tid |
| Hvilke oppgaver er viktigst? | Hvilke oppgaver som får flest stemmer |
| Noe annet | Fordelingen av svarene på hvert spørsmål, også over tid |

Ved **Noe annet** setter dere sammen spørsmålene selv. Se eksempler i [Velg hva dere vil måle](/guider/surveytyper). I [Storybook](https://navikt.github.io/lumi/storybook/) ser dere surveyen slik brukerne ser den.

## Koden i appen

Surveyverksted gir dere TypeScript-koden for surveyen. I appen legges den inn med én komponent:

```tsx
import { LumiSurveyDock } from "@navikt/lumi-survey";
import { survey } from "./survey"; // kopiert fra Surveyverksted
import { transport } from "./lumi-transport"; // skriver dere selv

export function Tilbakemelding() {
  return (
    <LumiSurveyDock
      surveyId="min-app-tilbakemelding"
      survey={survey}
      transport={transport}
    />
  );
}
```

`transport` sender svaret til et endepunkt i appens egen backend. Endepunktet veksler token med TokenX eller Entra ID og sender svaret videre til Lumi API.

Resten av oppsettet, med stilark, lagring og backend, står under [Kom i gang](/kom-i-gang/installer-widget).

## Dette trenger dere

- en app på Nais som bruker minst React 18 og Aksel 8
- en backend i appen som kan veksle token med TokenX eller Entra ID
- tilgang fra appen til Lumi API, som dere [ber om i navikt/lumi](/kom-i-gang/koble-til-backend#mottakeren-inbound)
- medlemskap i teamet deres i Nais Console, som gir tilgang til Surveyverksted og svarene
- utfylt etterlevelsesdokumentasjon og en vurdering av om dere trenger en personvernkonsekvensvurdering (PVK), se [bruksvilkårene](/referanse/bruksvilkar)

## Personopplysninger

Lumi API maskerer fødselsnummer, Nav-ident, e-postadresser, telefonnummer, kontonummer, kortnummer og ordene «hemmelig adresse» i fritekstsvar og i noen kontekstfelt, som URL og tags. Navn og vanlige adresser blir ikke maskert. Maskeringen er mønsterbasert og fanger ikke opp alt, så surveyen må ikke be om personopplysninger, se [bruksvilkårene](/referanse/bruksvilkar).

Team SåPe gjorde en penetrasjonstest av Lumi i februar 2026, og alle funnene var utbedret i mars 2026. Detaljene står i [Sikkerhet og personvern](/referanse/sikkerhet).

## Kontakt

Team eSyfo utvikler og drifter Lumi. Spør i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD). Kildekoden ligger på [GitHub](https://github.com/navikt/lumi).
