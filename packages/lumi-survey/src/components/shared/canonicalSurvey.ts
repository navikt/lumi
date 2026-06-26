import {
  getLeafConditions,
  isConditionGroup,
  isLeafCondition,
} from "../../core/conditionUtils.js";
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

  const surveyType = survey.type ?? "custom";

  // Apply small UX-safe defaults at build time (without changing the external API shape).
  // For rating surveys, the first rating question is the main interaction and should be
  // required by default unless explicitly set to false.
  const questions: LumiSurveyQuestion[] = (() => {
    if (
      surveyType === "rating" &&
      survey.questions[0]?.type === "rating" &&
      survey.questions[0]?.required === undefined
    ) {
      const next = [...survey.questions];
      next[0] = { ...next[0], required: true } as LumiSurveyQuestion;
      return next as LumiSurveyQuestion[];
    }

    return survey.questions;
  })();

  // Validate all questions have IDs
  const ids = new Set<string>();
  for (const question of questions) {
    if (!question.id) {
      throw new Error("Lumi: All questions must have an id");
    }

    if (ids.has(question.id)) {
      throw new Error(`Lumi: Duplicate question id "${question.id}"`);
    }

    ids.add(question.id);
  }

  // Validate cross-references in visibility and branching logic
  for (const question of questions) {
    const visibleIf = question.visibleIf;
    if (visibleIf) {
      if (typeof visibleIf !== "object" || Array.isArray(visibleIf)) {
        throw new Error(
          `Lumi: Question "${question.id}" has a visibleIf that is not a condition object`,
        );
      }
      if (isConditionGroup(visibleIf)) {
        if ("any" in visibleIf && "all" in visibleIf) {
          throw new Error(
            `Lumi: Question "${question.id}" has a visibleIf group with both "any" and "all" — use exactly one`,
          );
        }
        const body = "any" in visibleIf ? visibleIf.any : visibleIf.all;
        if (!Array.isArray(body)) {
          throw new Error(
            `Lumi: Question "${question.id}" has a visibleIf "any"/"all" that is not a list of conditions`,
          );
        }
        if (body.length === 0) {
          throw new Error(
            `Lumi: Question "${question.id}" has an empty visibleIf "any"/"all" group`,
          );
        }
      }
      for (const leaf of getLeafConditions(visibleIf)) {
        if (isConditionGroup(leaf)) {
          throw new Error(
            `Lumi: Question "${question.id}" has a nested visibleIf group — "any"/"all" groups may only contain leaf conditions (one level)`,
          );
        }
        if (!isLeafCondition(leaf)) {
          throw new Error(
            `Lumi: Question "${question.id}" has an invalid visibleIf condition — each leaf needs an operator (EQ/NEQ/GT/LT/CONTAINS/EXISTS)`,
          );
        }
        if (
          leaf.field !== "METADATA" &&
          leaf.questionId &&
          !ids.has(leaf.questionId)
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has visibleIf.questionId "${leaf.questionId}", but no such question exists`,
          );
        }
      }
    }

    if (!question.logic) continue;
    for (const rule of question.logic) {
      const condition = rule.condition;
      if (isConditionGroup(condition)) {
        throw new Error(
          `Lumi: Question "${question.id}" uses an any/all group in logic.condition, but logic does not support groups (use visibleIf)`,
        );
      }
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
    type: surveyType,
    questions,
  };
}
