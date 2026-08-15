import {
  getLeafConditions,
  isConditionGroup,
  isLeafCondition,
} from "./conditionUtils.js";
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
  return isLeafCondition(condition) && condition.field !== "METADATA";
}

/**
 * Builds representative answer values for every truth-region expressible by
 * the value operators. The estimator deliberately considers every supported
 * answer shape because overestimation is safer than hiding a reachable step.
 */
function buildAnswerWitnesses(
  conditions: LogicLeafCondition[],
): Array<LumiSurveyAnswerValue | undefined> {
  const scalarWitnesses = new Set<string | number>([0]);
  const numericBoundaries = new Set<number>();
  const stringValues = new Set<string>();

  for (const condition of conditions) {
    if (typeof condition.value === "number") {
      scalarWitnesses.add(condition.value);
      numericBoundaries.add(condition.value);
    } else if (typeof condition.value === "string") {
      scalarWitnesses.add(condition.value);
      stringValues.add(condition.value);
    }

    if (condition.operator === "CONTAINS") {
      stringValues.add(String(condition.value));
    }
  }

  const sortedBoundaries = [...numericBoundaries]
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (sortedBoundaries.length > 0) {
    const first = sortedBoundaries[0];
    const last = sortedBoundaries[sortedBoundaries.length - 1];
    const below = first - Math.max(1, Math.abs(first) * 0.01);
    const above = last + Math.max(1, Math.abs(last) * 0.01);

    if (Number.isFinite(below) && below < first) scalarWitnesses.add(below);
    if (Number.isFinite(above) && above > last) scalarWitnesses.add(above);

    for (let index = 1; index < sortedBoundaries.length; index++) {
      const left = sortedBoundaries[index - 1];
      const right = sortedBoundaries[index];
      const midpoint = left + (right - left) / 2;
      if (Number.isFinite(midpoint) && midpoint > left && midpoint < right) {
        scalarWitnesses.add(midpoint);
      }
    }
  }

  const expectedStrings = new Set(
    conditions
      .map((condition) => condition.value)
      .filter((value): value is string => typeof value === "string"),
  );
  let combinedString = `__lumi_reachability__${[...stringValues].join("__")}__`;
  while (expectedStrings.has(combinedString)) combinedString += "_";
  scalarWitnesses.add(combinedString);

  return [undefined, ...scalarWitnesses, [...stringValues]];
}

/**
 * Estimates reachable questions from the current answer state via the visibleIf graph.
 * For unanswered parents with value operators (EQ/LT/GT/NEQ/CONTAINS), the
 * longest compatible combination of child branches is counted. This avoids
 * counting mutually exclusive paths at once without undercounting overlapping
 * conditions such as multiple NEQ/CONTAINS branches or LT 4 plus GT 3.
 * METADATA-gated conditions are always treated as reachable to prefer
 * overestimation over underestimation when metadata may arrive or change later.
 * `any`/`all` group conditions are evaluated once every referenced answer is
 * present (so an answered-but-falsified group is excluded); while still
 * unresolved they are overestimated as reachable, like METADATA.
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
      // Cyclic visibleIf dependency — genuinely indeterminate. Overestimate as
      // reachable (this function's documented policy) so a cycle never
      // UNDER-counts and hides a step that is actually reachable.
      return true;
    }

    visited.add(questionId);

    const question = questionById.get(questionId);
    if (!question) {
      deterministicReachableCache.set(questionId, false);
      return false;
    }

    const condition = question.visibleIf;

    // Only null/undefined mean "no condition"; other falsy values are malformed
    // and fall through to the fail-closed guard below.
    if (condition === null || condition === undefined) {
      deterministicReachableCache.set(questionId, true);
      return true;
    }

    // Malformed condition (not a plain object): evaluateVisibility hides it, so
    // reachability mirrors visibility and excludes it (rather than crashing).
    if (typeof condition !== "object" || Array.isArray(condition)) {
      deterministicReachableCache.set(questionId, false);
      return false;
    }

    if (isConditionGroup(condition)) {
      // Both keys at once is ambiguous — mirror evaluateVisibility and fail
      // closed so reachability matches visibility for raw both-keys input.
      if ("any" in condition && "all" in condition) {
        deterministicReachableCache.set(questionId, false);
        return false;
      }

      // Reachability of a group, per leaf:
      //  - METADATA / no-questionId leaves stay open (value may arrive).
      //  - an answered leaf contributes its actual truth (so an answered-but-
      //    falsified group is excluded).
      //  - an unanswered leaf stays open ONLY if its referenced parent is itself
      //    deterministically reachable — a leaf whose parent can never be shown
      //    can never become true, so it must not keep the group alive.
      // Combine with any (some) / all (every).
      const leaves = getLeafConditions(condition);
      const leafCanBeTrue = (leaf: LogicLeafCondition): boolean => {
        if (!isLeafCondition(leaf)) return false;
        if (leaf.field === "METADATA") return true;
        if (!leaf.questionId) return true;
        if (answers[leaf.questionId] !== undefined) {
          return evaluateVisibility(leaf, answers, metadata);
        }
        return isDeterministicallyReachable(leaf.questionId, new Set(visited));
      };

      const reachable =
        "any" in condition
          ? leaves.some(leafCanBeTrue)
          : leaves.length > 0 && leaves.every(leafCanBeTrue);

      deterministicReachableCache.set(questionId, reachable);
      return reachable;
    }

    // A non-group condition that isn't a valid leaf (e.g. missing operator) is
    // hidden by evaluateVisibility → not reachable. Keeps the two consistent.
    if (!isLeafCondition(condition)) {
      deterministicReachableCache.set(questionId, false);
      return false;
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

  function branchLengthFrom(
    questionId: string,
    visited: Set<string> = new Set(),
  ): number {
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

    const unansweredValueChildren: LumiSurveyQuestion[] = [];

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

      unansweredValueChildren.push(child);
    }

    total += maxCompatibleBranchLength(
      questionId,
      unansweredValueChildren,
      visited,
    );
    return total;
  }

  function maxCompatibleBranchLength(
    parentId: string,
    candidates: LumiSurveyQuestion[],
    visited: Set<string>,
  ): number {
    const branches = candidates.flatMap((candidate) => {
      const condition = candidate.visibleIf;
      if (!isAnswerCondition(condition) || condition.operator === "EXISTS") {
        return [];
      }

      return [
        {
          condition,
          length: branchLengthFrom(candidate.id, new Set(visited)),
        },
      ];
    });

    if (branches.length === 0) return 0;

    const hypotheticalAnswers = { ...answers };
    let best = 0;

    for (const witness of buildAnswerWitnesses(
      branches.map((branch) => branch.condition),
    )) {
      if (witness === undefined) {
        delete hypotheticalAnswers[parentId];
      } else {
        hypotheticalAnswers[parentId] = witness;
      }

      let total = 0;
      for (const branch of branches) {
        if (
          evaluateVisibility(branch.condition, hypotheticalAnswers, metadata)
        ) {
          total += branch.length;
        }
      }

      if (total > best) best = total;
    }

    return best;
  }

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

  for (const [parentId, candidates] of unresolvedByParent) {
    reachableCount += maxCompatibleBranchLength(
      parentId,
      candidates,
      new Set(),
    );
  }

  return reachableCount;
}
