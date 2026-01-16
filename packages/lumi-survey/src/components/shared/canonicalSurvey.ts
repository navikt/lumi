import type { LumiSurveyQuestion } from "../../core/types.js";
import type { LumiSurveyConfig, SurveyType } from "../surveyTypes.js";

export const RATING_ANSWER_KEY = "svar";
export const MAIN_ANSWER_KEY = "feedback";

export interface CanonicalSurvey {
  type: SurveyType;
  questions: LumiSurveyQuestion[];
}

export function buildCanonicalSurvey(
  survey: LumiSurveyConfig,
): CanonicalSurvey {
  if (!survey.questions || survey.questions.length === 0) {
    throw new Error("Lumi survey must have at least one question");
  }

  // Validate all questions have IDs
  for (const question of survey.questions) {
    if (!question.id) {
      throw new Error("Lumi: All questions must have an id");
    }
  }

  return {
    type: survey.type ?? "custom",
    questions: survey.questions,
  };
}
