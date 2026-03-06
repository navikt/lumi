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
export type {
  LumiSurveyConfig,
  SurveyType,
} from "./components/surveyTypes.js";
export * from "./core/index.js";
export {
  createDiscoverySurvey,
  // Builder functions
  createRatingSurvey,
  createTaskPrioritySurvey,
  createTopTasksSurvey,
  DEFAULT_SURVEY_DISCOVERY,
  // Default presets
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_SERVICE_FEEDBACK,
} from "./presets/index.js";
