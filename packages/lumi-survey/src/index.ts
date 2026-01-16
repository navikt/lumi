export * from "./components/questions/index.js";
export * from "./core/index.js";
export {
  LumiSurveyDock,
  type LumiSurveyDockProps,
} from "./components/FlexJarDock/index.js";
export type {
  LumiSurveyLabels,
  LumiSurveySuccessConfig,
  LumiSurveyStyle,
  LumiSurveyBehavior,
  StorageStrategy,
} from "./components/FlexJarDock/propTypes.js";
export type {
  LumiSurveyConfig,
  SurveyType,
} from "./components/surveyTypes.js";
export {
  // Default presets
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_SERVICE_FEEDBACK,
  DEFAULT_SURVEY_DISCOVERY,
  // Builder functions
  createRatingSurvey,
  createDiscoverySurvey,
  createTopTasksSurvey,
  createTaskPrioritySurvey,
} from "./presets/index.js";
