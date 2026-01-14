export * from "./components/questions/index.js";
export * from "./core/index.js";
export {
  LumiSurveyDock,
  FlexJarDock,
  type LumiSurveyDockProps,
  type FlexJarDockProps,
} from "./components/FlexJarDock/index.js";
export type {
  LumiSurveyLabels,
  LumiSurveySuccessConfig,
  LumiSurveyStyle,
  LumiSurveyBehavior,
  FlexJarLabels,
  FlexJarSuccessConfig,
  FlexJarStyle,
  FlexJarBehavior,
  StorageStrategy,
} from "./components/FlexJarDock/propTypes.js";
export type {
  LumiSurveyConfig,
  FlexJarSurveyConfig,
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
