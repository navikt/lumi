import { isConditionGroup } from "./conditionUtils.js";
import { evaluateVisibility } from "./evaluateVisibility.js";
import type {
  LogicLeafCondition,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
  VisibleIfCondition,
} from "./types.js";

function isAnswerCondition(
  condition: VisibleIfCondition | undefined,
): condition is Extract<LogicLeafCondition, { field?: "ANSWER" }> {
  return (
    condition !== undefined &&
    !isConditionGroup(condition) &&
    condition.field !== "METADATA"
  );
}

/**
 * Estimates reachable questions from the current answer state via the visibleIf graph.
 * For unanswered parents with value operators (EQ/LT/GT/NEQ/CONTAINS),
 * only one unresolved child branch is counted per parent (the longest branch).
 * This avoids counting mutually exclusive paths at once, but overlapping
 * conditions (for example LT 4 and GT 3) can make the estimate lower than
 * the real number of visible questions.
 * METADATA-gated conditions are always treated as reachable to prefer
 * overestimation over underestimation when metadata may arrive or change later.
 */
export function computeReachableSteps(
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): number {
  if (questions.length === 0) {
    return 0;
  }

  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const dependentsByParent = new Map<string, LumiSurveyQuestion[]>();

  for (const question of questions) {
    const condition = question.visibleIf;
    if (!isAnswerCondition(condition) || !condition.questionId) {
      continue;
    }

    const dependents = dependentsByParent.get(condition.questionId) ?? [];
    dependents.push(question);
    dependentsByParent.set(condition.questionId, dependents);
  }

  const deterministicReachableCache = new Map<string, boolean>();

  const isDeterministicallyReachable = (
    questionId: string,
    visited: Set<string> = new Set(),
  ): boolean => {
    const cached = deterministicReachableCache.get(questionId);
    if (cached !== undefined) {
      return cached;
    }

    if (visited.has(questionId)) {
      return false;
    }

    visited.add(questionId);

    const question = questionById.get(questionId);
    if (!question) {
      deterministicReachableCache.set(questionId, false);
      return false;
    }

    const condition = question.visibleIf;

    if (!condition) {
      deterministicReachableCache.set(questionId, true);
      return true;
    }

    if (isConditionGroup(condition)) {
      // Group-gated: overestimate as reachable (same policy as METADATA).
      deterministicReachableCache.set(questionId, true);
      return true;
    }

    if (condition.field === "METADATA") {
      deterministicReachableCache.set(questionId, true);
      return true;
    }

    if (!condition.questionId) {
      deterministicReachableCache.set(questionId, true);
      return true;
    }

    if (condition.operator === "EXISTS") {
      const result = isDeterministicallyReachable(
        condition.questionId,
        visited,
      );
      deterministicReachableCache.set(questionId, result);
      return result;
    }

    if (answers[condition.questionId] !== undefined) {
      const result = evaluateVisibility(condition, answers, metadata);
      deterministicReachableCache.set(questionId, result);
      return result;
    }

    deterministicReachableCache.set(questionId, false);
    return false;
  };

  const branchLengthFrom = (
    questionId: string,
    visited: Set<string> = new Set(),
  ): number => {
    if (visited.has(questionId)) {
      return 0;
    }

    const question = questionById.get(questionId);
    if (!question) {
      return 0;
    }

    const condition = question.visibleIf;
    if (
      condition &&
      !isConditionGroup(condition) &&
      condition.field !== "METADATA" &&
      condition.questionId
    ) {
      if (condition.operator !== "EXISTS") {
        const parentId = condition.questionId;
        if (answers[parentId] !== undefined) {
          if (!evaluateVisibility(condition, answers, metadata)) {
            return 0;
          }
        } else if (!isDeterministicallyReachable(parentId)) {
          return 0;
        }
      }
    }

    visited.add(questionId);

    let total = 1;
    const children = dependentsByParent.get(questionId) ?? [];

    let bestUnansweredValueBranch = 0;

    for (const child of children) {
      const childCondition = child.visibleIf;
      if (!isAnswerCondition(childCondition) || !childCondition.questionId) {
        continue;
      }

      if (childCondition.operator === "EXISTS") {
        total += branchLengthFrom(child.id, new Set(visited));
        continue;
      }

      if (answers[questionId] !== undefined) {
        if (evaluateVisibility(childCondition, answers, metadata)) {
          total += branchLengthFrom(child.id, new Set(visited));
        }
        continue;
      }

      const branchLength = branchLengthFrom(child.id, new Set(visited));
      if (branchLength > bestUnansweredValueBranch) {
        bestUnansweredValueBranch = branchLength;
      }
    }

    total += bestUnansweredValueBranch;
    return total;
  };

  let reachableCount = 0;
  const unresolvedByParent = new Map<string, LumiSurveyQuestion[]>();

  for (const question of questions) {
    if (isDeterministicallyReachable(question.id)) {
      reachableCount += 1;
      continue;
    }

    const condition = question.visibleIf;
    if (!isAnswerCondition(condition) || !condition.questionId) {
      continue;
    }

    if (condition.operator === "EXISTS") {
      continue;
    }

    if (answers[condition.questionId] !== undefined) {
      continue;
    }

    if (!isDeterministicallyReachable(condition.questionId)) {
      continue;
    }

    const unresolved = unresolvedByParent.get(condition.questionId) ?? [];
    unresolved.push(question);
    unresolvedByParent.set(condition.questionId, unresolved);
  }

  for (const candidates of unresolvedByParent.values()) {
    let bestBranch = 0;

    for (const candidate of candidates) {
      const branch = branchLengthFrom(candidate.id);
      if (branch > bestBranch) {
        bestBranch = branch;
      }
    }

    reachableCount += bestBranch;
  }

  return reachableCount;
}
