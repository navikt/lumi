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
  DEFAULT_SURVEY_NPS,
  // Default presets
  DEFAULT_SURVEY_RATING,
  DEFAULT_SURVEY_SERVICE_FEEDBACK,
  DEFAULT_SURVEY_STARS,
  DEFAULT_SURVEY_THUMBS,
} from "./presets/index.js";
