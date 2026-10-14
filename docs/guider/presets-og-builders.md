---
title: Eldre presets og builders
search: false
---

# Eldre presets og builders

De eldre presetene og builder-funksjonene lager en flat `LumiSurveyConfig`. De virker fortsatt i 2.x, men skal ikke brukes til nye surveyer. De anbefalte builderne har navn som ender på `SurveyDocument` og står i [Velg hva dere vil måle](/guider/surveytyper).

Lag nye surveyer i [Surveyverksted](/kom-i-gang/lag-survey) eller som `SurveyDocumentV1` i kode. Se [Migrer en eldre survey](/referanse/migrer-eldre-survey) hvis dere vedlikeholder et eksisterende oppsett.

## Spørsmåls-ID-er i de eldre presetene

Spørsmåls-ID-ene er en del av definisjonen som Lumi API låser for hver `surveyId`. Sjekk dem før dere flytter et eldre oppsett til `SurveyDocumentV1`.

| Preset eller builder | `type` | Spørsmåls-ID-er |
| :--- | :--- | :--- |
| `DEFAULT_SURVEY_RATING` | `rating` | `rating` (`emoji`) og `feedback` |
| `DEFAULT_SURVEY_SERVICE_FEEDBACK` | `rating` | `rating` (`emoji`) og `feedback` |
| `DEFAULT_SURVEY_THUMBS` | `rating` | `helpful` (`thumbs`) og `feedback` |
| `DEFAULT_SURVEY_STARS` | `rating` | `stars` (`stars`) og `feedback` |
| `DEFAULT_SURVEY_NPS` | `rating` | `nps` (`nps`) og `reason` |
| `createRatingSurvey` | `rating` | `rating` (`emoji`) og ID-ene dere gir oppfølgingsspørsmålene |
| `DEFAULT_SURVEY_DISCOVERY` og `createDiscoverySurvey` | `discovery` | `discoveredTask`, `taskSuccess` og `blocker` |
| `createTopTasksSurvey` | `topTasks` | `task`, `otherTask`, `taskSuccess` og `blocker` |
| `createTaskPrioritySurvey` | `taskPriority` | `priorities` |

Verdien i parentes er ratingvarianten. `blocker` er med så lenge `includeBlockerQuestion` ikke er `false`, og `otherTask` er bare med når `includeOtherTask` er `true`. `taskSuccess` har svaralternativene `yes`, `partial` og `no`.

## Bytte til en anbefalt builder

De anbefalte builderne bruker ikke alltid de samme spørsmåls-ID-ene som de eldre. Bytter dere builder og beholder samme `surveyId`, svarer Lumi API med 409 når ID-ene er ulike.

| Eldre | Anbefalt | Samme `surveyId`? | Hvorfor |
| :--- | :--- | :--- | :--- |
| `DEFAULT_SURVEY_RATING` | `DEFAULT_RATING_SURVEY_DOCUMENT` | Ja | Begge bruker `rating` og `feedback`. |
| `DEFAULT_SURVEY_SERVICE_FEEDBACK` | `createRatingSurveyDocument` med de samme tekstene | Ja | Begge bruker `rating` og `feedback`. Presetet spør «Hvordan opplevde du å svare på spørsmålene?». `DEFAULT_RATING_SURVEY_DOCUMENT` har de samme ID-ene, men spør «Hvordan var opplevelsen din?». |
| `createRatingSurvey` | `createRatingSurveyDocument` | Ja | ID-ene er de samme når oppfølgingsspørsmålene beholder ID-ene sine og `variant` er `emoji`. |
| `DEFAULT_SURVEY_THUMBS`, `DEFAULT_SURVEY_STARS` og `DEFAULT_SURVEY_NPS` | `createRatingSurveyDocument` | Nei | Builderen kaller alltid vurderingen `rating`. Presetene bruker `helpful`, `stars` og `nps`. |
| `DEFAULT_SURVEY_DISCOVERY` og `createDiscoverySurvey` | `DEFAULT_DISCOVERY_SURVEY_DOCUMENT` og `createDiscoverySurveyDocument` | Nei | `discoveredTask` er blitt `task`, og `taskSuccess` er blitt `success`. |
| `createTopTasksSurvey` | `createTopTasksSurveyDocument` | Nei | `taskSuccess` er blitt `success`. |
| `createTaskPrioritySurvey` | `createTaskPrioritySurveyDocument` | Nei | `priorities` er blitt `priority`. |

## Behold ID-ene i dokumentformatet

Skal surveyen beholde `surveyId`, skriver dere `SurveyDocumentV1` selv med de samme spørsmåls-ID-ene, samme `type`, de samme svaralternativene og samme grense for antall valg som før. Widgeten og Lumi API godtar fortsatt `discoveredTask`, `taskSuccess` og `priorities` i surveyer med `type` `discovery`, `topTasks` og `taskPriority`.

Dette dokumentet har de samme ID-ene som `DEFAULT_SURVEY_THUMBS`:

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
          id: "helpful",
          type: "rating",
          variant: "thumbs",
          prompt: "Var dette til hjelp?",
          required: true,
        },
        {
          id: "feedback",
          type: "text",
          prompt: "Har du forslag til forbedringer?",
          maxLength: 500,
          visibleIf: { questionId: "helpful", operator: "EXISTS" },
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;
```

Begge spørsmålene ligger på samme side, slik at de vises samlet som i presetet.
