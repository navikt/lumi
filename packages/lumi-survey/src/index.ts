export {
  LumiSurveyDock,
  type LumiSurveyDockProps,
} from "./components/LumiSurveyDock/index.js";
export type {
  LumiSurveyBehavior,
  LumiSurveyIntroConfig,
  LumiSurveyLabels,
  LumiSurveyStyle,
  LumiSurveySuccessConfig,
  StorageStrategy,
} from "./components/LumiSurveyDock/propTypes.js";
export * from "./components/questions/index.js";
export { validateSurveyDocumentV1 } from "./components/shared/canonicalSurvey.js";
export type {
  LumiSurveyConfig,
  LumiSurveyDefinition,
  SurveyDocumentV1,
  SurveyIntroV1,
  SurveyPageV1,
  SurveyQuestionV1,
  SurveySuccessV1,
  SurveyType,
} from "./components/surveyTypes.js";
export * from "./core/index.js";
export {
  createDiscoverySurvey,
  createDiscoverySurveyDocument,
  // Builder functions
  createRatingSurvey,
  createRatingSurveyDocument,
  createTaskPrioritySurvey,
  createTaskPrioritySurveyDocument,
  createTopTasksSurvey,
  createTopTasksSurveyDocument,
  DEFAULT_DISCOVERY_SURVEY_DOCUMENT,
  DEFAULT_RATING_SURVEY_DOCUMENT,
  DEFAULT_SURVEY_DISCOVERY,
  DEFAULT_SURVEY_NPS,
  // Default presets
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_SERVICE_FEEDBACK,
  DEFAULT_SURVEY_STARS,
  DEFAULT_SURVEY_THUMBS,
  type DiscoverySurveyOptions,
  type RatingSurveyDocumentOptions,
  type RatingSurveyOptions,
  type TaskPrioritySurveyOptions,
  type TopTasksSurveyOptions,
} from "./presets/index.js";
