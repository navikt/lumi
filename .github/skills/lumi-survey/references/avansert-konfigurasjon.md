## Avansert konfigurasjon

For avanserte brukstilfeller (betinget synlighet, sider, events, velkomst, bekreftelse, egne tekster og styling):

1. Les de eksporterte TypeScript-typene: `node_modules/@navikt/lumi-survey/dist/index.d.ts`
2. Nøkkelgrensesnitt: `SurveyDocumentV1`, `SurveyPageV1`, `SurveyQuestionV1`, `LumiSurveyDockProps`, `LumiSurveyBehavior`, `LumiSurveyEvents`, `LumiSurveyStyle`
3. Full dokumentasjon: https://navikt.github.io/lumi/

Bruk `SurveyDocumentV1.pages` for steg og gruppering, og `visibleIf` for å vise bare relevante spørsmål. Ikke bruk legacy `logic`, flat `LumiSurveyConfig` eller `questionLayout="steps"` i ny kode. De er tilgjengelige i 2.x bare for eksisterende integrasjoner.

**Events for analyseintegrasjon:**

```tsx
<LumiSurveyDock
  events={{
    onSubmitSuccess: () => analytics.track("survey_completed"),
    onSubmitError: (cause) => logger.error("Survey submit failed", cause),
  }}
  {...otherProps}
/>
```
