import { createContext, useContext } from "react";

/**
 * Heading level of the survey's own title. Level 5 is the deepest, because a
 * question with its own heading uses the level below.
 */
export type SurveyHeadingLevel = "2" | "3" | "4" | "5";

/** The level the dock has always used. */
export const DEFAULT_SURVEY_HEADING_LEVEL: SurveyHeadingLevel = "2";

const SURVEY_HEADING_LEVELS: readonly string[] = ["2", "3", "4", "5"];

/**
 * The level to use for a value from an app. Anything outside 2–5, also from
 * plain JavaScript, falls back to the default. A number is read as its level.
 */
export const resolveSurveyHeadingLevel = (
  level: unknown,
): SurveyHeadingLevel =>
  SURVEY_HEADING_LEVELS.includes(String(level))
    ? (String(level) as SurveyHeadingLevel)
    : DEFAULT_SURVEY_HEADING_LEVEL;

const SurveyHeadingLevelContext = createContext<SurveyHeadingLevel>(
  DEFAULT_SURVEY_HEADING_LEVEL,
);

export const SurveyHeadingLevelProvider = SurveyHeadingLevelContext.Provider;

/**
 * Level of the survey's title: the panel heading, the page titles and the
 * heading of the error summary.
 */
export const useSurveyHeadingLevel = (): SurveyHeadingLevel =>
  useContext(SurveyHeadingLevelContext);

/** Level of a question that has its own heading under the survey's title. */
export const useQuestionHeadingLevel = (): "3" | "4" | "5" | "6" =>
  String(Number(useSurveyHeadingLevel()) + 1) as "3" | "4" | "5" | "6";
