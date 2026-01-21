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
  const ids = new Set<string>();
  for (const question of survey.questions) {
    if (!question.id) {
      throw new Error("Lumi: All questions must have an id");
    }

    if (ids.has(question.id)) {
      throw new Error(`Lumi: Duplicate question id "${question.id}"`);
    }

    ids.add(question.id);
  }

  // Validate cross-references in visibility and branching logic
  for (const question of survey.questions) {
    const visibleIf = question.visibleIf;
    if (visibleIf && visibleIf.field !== "METADATA") {
      const referencedId = visibleIf.questionId;
      if (referencedId && !ids.has(referencedId)) {
        throw new Error(
          `Lumi: Question "${question.id}" has visibleIf.questionId "${referencedId}", but no such question exists`,
        );
      }
    }

    if (!question.logic) continue;
    for (const rule of question.logic) {
      const condition = rule.condition;
      if (condition.field !== "METADATA") {
        const referencedId = condition.questionId;
        if (referencedId && !ids.has(referencedId)) {
          throw new Error(
            `Lumi: Question "${question.id}" has logic.condition.questionId "${referencedId}", but no such question exists`,
          );
        }
      }

      if (rule.action.type === "JUMP_TO" && !ids.has(rule.action.targetId)) {
        throw new Error(
          `Lumi: Question "${question.id}" has logic.action.targetId "${rule.action.targetId}", but no such question exists`,
        );
      }
    }
  }

  return {
    type: survey.type ?? "custom",
    questions: survey.questions,
  };
}
