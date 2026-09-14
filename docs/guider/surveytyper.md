---
title: Velg hva dere vil måle
---

# Velg hva dere vil måle

Start med hva teamet trenger å lære, og hvordan dere vil bruke svarene. I [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) velger dere et oppsett under **Hva vil dere finne ut?** Dere kan deretter tilpasse spørsmålene til tjenesten deres.

## Velg et oppsett

| Valg i Surveyverksted | Bruk når | Hva dere får i dashboardet |
| :--- | :--- | :--- |
| Hvordan opplevde brukeren tjenesten? | Dere vil måle opplevelsen etter en konkret oppgave | Vurderinger over tid og eventuelle fritekstsvar |
| Hva kom brukeren for å gjøre? | Dere vil oppdage hvilke oppgaver brukerne har | Oppgaver beskrevet med brukernes egne ord, om de lyktes og eventuelle hindringer |
| Lyktes brukeren med en kjent oppgave? | Dere kjenner oppgavene og vil måle hvor godt brukerne får løst dem | Resultat og hindringer per oppgave |
| Hvilke oppgaver er viktigst? | Dere vil vite hvilke oppgaver brukerne prioriterer | Hvilke oppgaver som får flest stemmer |
| Noe annet | Dere har spørsmål som ikke passer i de andre oppsettene | En generell oversikt over svarene |

## Hvordan opplevde brukeren tjenesten?

Still et kort vurderingsspørsmål etter at brukeren har gjort noe konkret, for eksempel «Hvordan var det å sende inn søknaden?». Det gjør det lettere å vite hvilken opplevelse svaret gjelder.

Dere kan velge emoji, tommel opp eller ned, stjerner eller NPS-skala. Legg til et oppfølgingsspørsmål bare når dere vet hvordan dere skal bruke svaret.

## Hva kom brukeren for å gjøre?

Velg dette når dere vil la brukerne beskrive oppgaven med egne ord. Det passer når dere ennå ikke kjenner de viktigste oppgavene godt nok til å lage en liste.

Brukeren beskriver hva hen kom for å gjøre, og svarer på om hen lyktes. Oppsettet spør om hindringer ved «Delvis» eller «Nei».

## Lyktes brukeren med en kjent oppgave?

Velg dette når dere allerede kjenner oppgavene. Brukeren velger fra listen deres og svarer på om hen lyktes. I dashboardet kan dere følge resultatet og se hindringer for hver oppgave.

Hold listen kort nok til at brukeren raskt finner riktig oppgave. Bruk ord brukerne kjenner, og vurder et alternativ for oppgaver som mangler i listen.

## Hvilke oppgaver er viktigst?

Velg dette når dere vil vite hvilke oppgaver brukerne mener er viktigst. Dere lager en oppgaveliste og bestemmer hvor mange oppgaver hver bruker kan velge.

Bruk resultatene som ett av grunnlagene for å prioritere forbedringer. Arbeid grundig med listen før dere starter: oppgavene bør være forståelige, skille seg fra hverandre og dekke det dere vil undersøke.

## Noe annet

Velg **Noe annet** når dere trenger en egen kombinasjon av spørsmål. Dere kan bruke alle spørsmålstypene, dele dem over flere sider og vise oppfølgingsspørsmål ut fra tidligere svar. Dashboardet gir en generell oversikt over svarene.

## Tilpass og prøv surveyen

Surveyverksted setter opp spørsmålene som analysen trenger, og beskytter feltene som må beholde en bestemt struktur. Dere kan endre teksten og legge til egne spørsmål. Verkstedet forklarer begrensningene underveis og sjekker oppsettet før dere deler en versjon.

Prøv hele surveyen før dere deler den med utvikleren. Se [Lag surveyen](/kom-i-gang/lag-survey) for veien fra utkast til app.

## For utviklere: analyse og dokumentformat

I det eksporterte dokumentet angir `type` hvilken analyse dashboardet bruker. Spørsmålene og ID-ene må passe til analysen; å endre `type` alene er ikke nok til å bytte oppsett. `type` bestemmer ikke hvilke sider eller ekstra spørsmål dokumentet kan ha.

| Oppsett | `type` | Funksjon for å opprette dokumentet i kode |
| :--- | :--- | :--- |
| Opplevelse | `rating` | `createRatingSurveyDocument` |
| Oppdage oppgaver | `discovery` | `createDiscoverySurveyDocument` |
| Kjente oppgaver | `topTasks` | `createTopTasksSurveyDocument` |
| Oppgaveprioritering | `taskPriority` | `createTaskPrioritySurveyDocument` |
| Egne spørsmål | `custom` | Skriv dokumentet direkte |

Funksjonene eksporteres fra `@navikt/lumi-survey` og returnerer `SurveyDocumentV1`. [Props-referansen](/referanse/props-referanse#survey-surveydocumentv1) viser dokumentformatet. For en oppgaveliste kan dere for eksempel bruke:

```typescript
import { createTopTasksSurveyDocument } from "@navikt/lumi-survey";

const survey = createTopTasksSurveyDocument({
  tasks: [
    { value: "soke", label: "Søke om sykepenger" },
    { value: "status", label: "Sjekke status på søknaden" },
  ],
  includeOtherTask: true,
});
```

`value` er oppgavens stabile ID (`taskId`) i analyser, filtre og delbare lenker. `label` er teksten brukeren ser. Behold ID-en når dere bare retter teksten. Det samme gjelder oppgavelister for oppgaveprioritering. Se [Survey-identitet og endringer](/guider/survey-identitet) før dere endrer en survey som er tatt i bruk.

De påkrevde analysefeltene må være obligatoriske og alltid synlige. Behold ID-er, spørsmålstyper og faste svarverdier fra oppsettet. Spørsmålet om hindringer er valgfritt og kan vises betinget. Widgeten og API-et avviser oppsett som ikke oppfyller analysekravene.

## Videre lesing

- [Sider og flyt](/guider/sider-og-flyt) for å velge hva som skal vises sammen
- [Spørsmålstyper](/guider/sporsmalstyper) for alle feltene brukeren kan svare på
- [Vis bare relevante spørsmål](/guider/betinget-synlighet) for oppfølginger med `visibleIf`
