---
title: Velg hva dere vil måle
---

# Velg hva dere vil måle

Tenk gjennom hva teamet vil vite og hva dere skal gjøre med svarene. Så velger dere et oppsett under **Hva vil dere finne ut?** i [Surveyverksted](https://lumi-dashboard.ansatt.nav.no/surveyverksted) og tilpasser spørsmålene til tjenesten.

## Velg et oppsett

| Valg i Surveyverksted | Bruk når | Hva dere får i dashboardet |
| :--- | :--- | :--- |
| Hvordan opplevde brukeren tjenesten? | Dere vil måle opplevelsen etter en konkret oppgave | Vurderingen over tid, et kort per spørsmål og fritekstsvarene |
| Hva kom brukeren for å gjøre? | Dere vil finne ut hvilke oppgaver brukerne har | Oppgavene som går igjen, med eksempler fra brukerne, om de fikk det til og hva som hindret dem |
| Lyktes brukeren med en kjent oppgave? | Dere kjenner oppgavene og vil måle hvor godt brukerne får løst dem | Resultat og hindringer per oppgave, og suksessraten over tid |
| Hvilke oppgaver er viktigst? | Dere vil vite hvilke oppgaver brukerne prioriterer | Hvilke oppgaver som får flest stemmer, og antall innsendinger over tid |
| Noe annet | Dere har spørsmål som ikke passer i de andre oppsettene | Et kort per spørsmål med fordelingen av svarene og ord som går igjen i fritekstsvarene |

Når dere har valgt én survey i dashboardet, kan dere se svarene på en vurdering eller et valgspørsmål per dag, uke eller måned. For **Hvordan opplevde brukeren tjenesten?** og **Noe annet** gjør dere det med **Se utvikling** på kortet til spørsmålet, og med **Sammenlign med forrige periode** ser dere hvert kort mot perioden rett før. For de tre andre oppsettene ligger visningen under **Utvikling over tid** nederst i dashboardet, og der kan dere ikke sammenligne perioder. Hvordan dere leser visningene, står i [Les resultatene](/dashboard/visninger).

## Hvordan opplevde brukeren tjenesten?

Oppsettet starter med vurderingen «Hvordan opplevde du tjenesten?» og det valgfrie spørsmålet «Hva kan vi gjøre bedre?», som vises når brukeren har gitt en vurdering. Still vurderingsspørsmålet etter at brukeren har gjort noe konkret, for eksempel «Hvordan var det å sende inn søknaden?». Da vet dere hvilken opplevelse svaret gjelder.

Under **Vurderingsskala** velger dere **Smilefjes**, **Stjerner**, **Tommel opp eller ned** eller **0 til 10**. Surveyverksted lar dere ikke bytte skala så lenge et annet spørsmål har en regel som bruker vurderingen, og i dette oppsettet gjelder det «Hva kan vi gjøre bedre?». Legg til flere oppfølgingsspørsmål bare når dere vet hva dere skal bruke svarene til. Hvordan dere gjør det, står i [Vis bare relevante spørsmål](/guider/betinget-synlighet).

## Hva kom brukeren for å gjøre?

Oppsettet har tre spørsmål, hvert på sin egen side:

1. «Hva kom du hit for å gjøre i dag?» Brukeren skriver svaret med egne ord. Spørsmålet er obligatorisk, så brukeren må skrive noe for å komme videre, og dere kan ikke gjøre det valgfritt.
2. «Fikk du gjort det?» med svarene «Ja», «Delvis» og «Nei». Også dette spørsmålet må besvares.
3. «Hva hindret deg?» Spørsmålet er valgfritt og vises bare når brukeren ikke har svart «Ja».

Oppsettet passer når dere ennå ikke kjenner de viktigste oppgavene godt nok til å lage en liste. Vil dere ikke kreve fritekst fra alle, velger dere **Lyktes brukeren med en kjent oppgave?**, der brukeren velger oppgaven fra en liste, eller **Noe annet**, der dere setter sammen spørsmålene selv.

## Lyktes brukeren med en kjent oppgave?

Her kjenner dere oppgavene på forhånd og lager en liste over dem. Brukeren velger fra listen og svarer på om hen lyktes. I dashboardet kan dere følge resultatet og se hindringene for hver oppgave.

Hold listen så kort at brukeren raskt finner riktig oppgave. Bruk ord brukerne kjenner, og vurder et eget alternativ for oppgaver som ikke står i listen.

## Hvilke oppgaver er viktigst?

Dere lager en oppgaveliste og bestemmer hvor mange oppgaver hver bruker kan velge. Gå grundig gjennom listen før dere starter. Oppgavene bør være lette å forstå, skille seg fra hverandre og til sammen dekke det dere vil undersøke.

Bruk resultatet som ett av flere grunnlag når dere prioriterer hva som skal forbedres.

## Noe annet

Med **Noe annet** setter dere sammen spørsmålene selv. Dere kan bruke alle [spørsmålstypene](/guider/sporsmalstyper), fordele spørsmålene på [flere sider](/guider/sider-og-flyt) og [vise oppfølgingsspørsmål](/guider/betinget-synlighet) ut fra tidligere svar.

Dashboardet viser ett kort per spørsmål. For vurderinger og valgspørsmål ser dere hvordan svarene fordeler seg, og med **Se utvikling** kan dere følge dem per dag, uke eller måned. For fritekst ser dere ord og uttrykk som går igjen, og de siste svarene. Det finnes ingen egen analyse av oppgaver eller hindringer, slik de andre oppsettene har.

## Tilpass og prøv surveyen

Surveyverksted legger inn spørsmålene som analysen trenger. I disse spørsmålene kan dere endre teksten, men ikke svartypen, om spørsmålet må besvares, eller når det vises. Der analysen bruker svaralternativene, kan dere heller ikke legge til eller fjerne alternativer. Egne spørsmål kan dere legge til fritt. Verkstedet forklarer begrensningene underveis og sjekker oppsettet før dere deler en versjon.

Prøv hele surveyen før dere deler den med utvikleren. Hvordan dere deler en versjon, og hva utvikleren gjør med den, står i [Lag surveyen](/kom-i-gang/lag-survey).

## For utviklere: analyse og dokumentformat

I det eksporterte dokumentet bestemmer `type` hvilken analyse dashboardet bruker. Spørsmålene og ID-ene må passe til analysen, så dere kan ikke bytte oppsett bare ved å endre `type`. `type` avgjør ikke hvilke sider eller ekstra spørsmål dokumentet kan ha.

| Valg i Surveyverksted | `type` | Funksjon for å opprette dokumentet i kode |
| :--- | :--- | :--- |
| Hvordan opplevde brukeren tjenesten? | `rating` | `createRatingSurveyDocument` |
| Hva kom brukeren for å gjøre? | `discovery` | `createDiscoverySurveyDocument` |
| Lyktes brukeren med en kjent oppgave? | `topTasks` | `createTopTasksSurveyDocument` |
| Hvilke oppgaver er viktigst? | `taskPriority` | `createTaskPrioritySurveyDocument` |
| Noe annet | `custom` | Skriv dokumentet direkte |

Funksjonene eksporteres fra `@navikt/lumi-survey` og returnerer `SurveyDocumentV1`. [Props-referansen](/referanse/props-referanse#survey-surveydocumentv1) viser dokumentformatet. Slik lager dere en survey med kjente oppgaver:

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

`value` er oppgavens stabile ID (`taskId`) i analyser, filtre og delbare lenker. `label` er teksten brukeren ser. Behold ID-en når dere bare retter teksten. Oppgavelisten i **Hvilke oppgaver er viktigst?** følger samme regel. Les [Survey-identitet og endringer](/guider/survey-identitet) før dere endrer en survey som er tatt i bruk.

De faste spørsmålene som analysen bygger på, må være obligatoriske og alltid synlige. Behold ID-ene, spørsmålstypene og de faste svarverdiene fra oppsettet. Spørsmålet om hindringer er valgfritt og kan vises betinget. Widgeten og API-et avviser oppsett som ikke oppfyller kravene til analysen.
