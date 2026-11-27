import type { SurveyQuestionV1 } from "../components/surveyTypes.js";
import { isLeafCondition } from "./conditionUtils.js";
import { evaluateVisibility } from "./evaluateVisibility.js";
import { ownValue, setOwnValue } from "./ownValue.js";
import type {
  LogicLeafCondition,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
  VisibleIfCondition,
} from "./types.js";

/**
 * A question as `resolveDocumentVisibility` reads it: from the pages of a
 * `SurveyDocumentV1`, or in the format the widget uses inside.
 */
export interface DocumentVisibilityQuestion {
  id: LumiSurveyQuestion["id"];
  visibleIf?: VisibleIfCondition | SurveyQuestionV1["visibleIf"];
}

/**
 * Which questions of a `SurveyDocumentV1` the survey shows, with these
 * answers and this metadata. Give the questions of all pages in order.
 *
 * V1 documents only reference earlier questions. Resolve the whole document in
 * order so cached answers from a closed branch cannot open its descendants.
 * Keep the cached answers intact so returning to that branch restores input.
 *
 * `visibleAnswers` holds the answers to the visible questions and nothing
 * else: it has no prototype, so a question without an answer gives
 * `undefined`, also when its id is `constructor`.
 */
export function resolveDocumentVisibility<
  Question extends DocumentVisibilityQuestion,
>(
  questions: readonly Question[],
  answers: Readonly<Record<string, LumiSurveyAnswerValue>>,
  metadata?: Readonly<Record<string, unknown>>,
): {
  visibleQuestions: Question[];
  visibleQuestionIds: Set<string>;
  visibleAnswers: Record<string, LumiSurveyAnswerValue>;
} {
  const visibleQuestionIds = new Set<string>();
  const visibleAnswers: Record<string, LumiSurveyAnswerValue> =
    Object.create(null);

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
    // A V1 condition is the same shape, except that `EXISTS` on metadata has
    // no value. The evaluator reads both, and fails closed on anything else.
    if (!evaluate(question.visibleIf as VisibleIfCondition | undefined)) {
      return false;
    }
    visibleQuestionIds.add(question.id);
    const answer = ownValue(answers, question.id);
    if (answer !== undefined) {
      setOwnValue(visibleAnswers, question.id, answer);
    }
    return true;
  });

  return { visibleQuestions, visibleQuestionIds, visibleAnswers };
}
