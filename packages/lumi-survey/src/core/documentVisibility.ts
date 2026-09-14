import { isLeafCondition } from "./conditionUtils.js";
import { evaluateVisibility } from "./evaluateVisibility.js";
import type {
  LogicLeafCondition,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
  VisibleIfCondition,
} from "./types.js";

/**
 * V1 documents only reference earlier questions. Resolve the whole document in
 * order so cached answers from a closed branch cannot open its descendants.
 * Keep the cached answers intact so returning to that branch restores input.
 */
export function resolveDocumentVisibility(
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
) {
  const visibleQuestionIds = new Set<string>();
  const visibleAnswers: Record<string, LumiSurveyAnswerValue> = {};

  const evaluateLeaf = (leaf: LogicLeafCondition): boolean => {
    if (!isLeafCondition(leaf)) return false;
    if (
      leaf.field !== "METADATA" &&
      leaf.questionId &&
      !visibleQuestionIds.has(leaf.questionId)
    ) {
      return false;
    }
    // A visible but unanswered source retains normal operator semantics,
    // including NEQ. A hidden source cannot satisfy any answer operator.
    return evaluateVisibility(leaf, answers, metadata);
  };

  const evaluate = (condition: VisibleIfCondition | undefined): boolean => {
    if (condition == null) return true;
    if (typeof condition !== "object" || Array.isArray(condition)) return false;
    if ("any" in condition && "all" in condition) return false;
    if ("any" in condition) {
      return Array.isArray(condition.any) && condition.any.some(evaluateLeaf);
    }
    if ("all" in condition) {
      return Array.isArray(condition.all) && condition.all.every(evaluateLeaf);
    }
    return evaluateLeaf(condition);
  };

  const visibleQuestions = questions.filter((question) => {
    if (!evaluate(question.visibleIf)) return false;
    visibleQuestionIds.add(question.id);
    if (answers[question.id] !== undefined) {
      visibleAnswers[question.id] = answers[question.id];
    }
    return true;
  });

  return { visibleQuestions, visibleQuestionIds, visibleAnswers };
}
