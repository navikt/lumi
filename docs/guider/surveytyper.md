---
title: Velg hva dere vil måle
---

# Velg hva dere vil måle

Feltet `type` forteller Lumi hvilken analyse surveyen tilhører. For nye surveyer i Surveyverksted eller `SurveyDocumentV1` bruker du vanligvis `rating` eller `custom`.

`type` bestemmer ikke hvilke sider eller spørsmål dokumentet kan ha. Spørsmålene og ID-ene avgjør hvilke data dashboardet faktisk kan vise.

## Anbefalt for nye surveyer

| Type | Bruk når | Hva dashboardet viser |
| :--- | :--- | :--- |
| `rating` | Dere vil måle opplevelsen etter en konkret oppgave | Utvikling i vurderinger over tid og fritekstsvar |
| `custom` | Dere trenger spørsmål eller analyse som ikke passer i rating | Generell oversikt over svarene |

### `rating`

Bruk `rating` til en kort måling etter at brukeren har gjort noe konkret. Start med ett vurderingsspørsmål. Legg til et oppfølgingsspørsmål bare når dere vet hvordan svaret skal brukes.

```typescript
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

const survey = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "vurdering",
      questions: [
        {
          id: "opplevelse",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var det å sende inn søknaden?",
          required: true,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;
```

### `custom`

Bruk `custom` når ingen av de spesialiserte analysetypene passer. Du kan bruke alle spørsmålstyper, sider og `visibleIf`.

Velg `custom` hvis dere ikke bruker et ferdig og verifisert oppsett for en spesialisert analyse. Typeverdien alene gjør ikke et vilkårlig dokument om til en discovery-, top tasks- eller prioriteringsanalyse.

## Spesialiserte typer for eksisterende oppsett

Pakken støtter også `discovery`, `topTasks` og `taskPriority`. Disse analysene forventer bestemte spørsmåls-ID-er og svarformer. Dagens ferdige oppsett bruker den eldre, flate konfigurasjonsmodellen, og kontraktene er ennå ikke tilgjengelige som verifiserte `SurveyDocumentV1`-maler.

Ikke velg disse typene manuelt i en ny survey. Ta kontakt i [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD) hvis dere vil sette opp en slik analyse. Eksisterende surveyer fortsetter å virke.

| Type | Formål |
| :--- | :--- |
| `discovery` | Forstå hva brukeren kom for å gjøre, om hen fikk gjort det og hva som hindret hen |
| `topTasks` | Måle resultatet for en kjent liste med kjerneoppgaver |
| `taskPriority` | La brukerne velge hvilke oppgaver som er viktigst |

## Videre lesing

- [Sider og flyt](/guider/sider-og-flyt) for å velge hva som skal vises sammen
- [Spørsmålstyper](/guider/sporsmalstyper) for alle feltene brukeren kan svare på
- [Vis bare relevante spørsmål](/guider/betinget-synlighet) for oppfølginger med `visibleIf`
