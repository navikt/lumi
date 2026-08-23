import type {
  LogicConditionGroup,
  LogicLeafCondition,
  LogicOperator,
  LumiSurveyQuestionType,
  VisibleIfCondition,
} from "./types.js";

/** Valid `LogicOperator` values — keep in sync with the type in `types.ts`. */
const LOGIC_OPERATORS = new Set<string>([
  "EQ",
  "NEQ",
  "GT",
  "LT",
  "CONTAINS",
  "EXISTS",
]);

/** True when the condition is an `any`/`all` group rather than a leaf. */
export function isConditionGroup(
  condition: VisibleIfCondition,
): condition is LogicConditionGroup {
  return (
    typeof condition === "object" &&
    condition !== null &&
    ("any" in condition || "all" in condition)
  );
}

/**
 * Flattens a condition to its leaf conditions (a leaf yields itself).
 * A group whose body is not an array (malformed raw input) yields no leaves
 * rather than throwing, so callers can fail closed instead of crashing.
 */
export function getLeafConditions(
  condition: VisibleIfCondition,
): LogicLeafCondition[] {
  if (typeof condition !== "object" || condition === null) return [];
  if ("any" in condition)
    return Array.isArray(condition.any) ? condition.any : [];
  if ("all" in condition)
    return Array.isArray(condition.all) ? condition.all : [];
  return [condition];
}

/**
 * True for a structurally valid leaf condition: a plain object with a string
 * `operator` that is not an `any`/`all` group. Use to fail closed on malformed
 * raw input rather than crash or treat it as visible.
 */
export function isLeafCondition(
  condition: unknown,
): condition is LogicLeafCondition {
  return (
    typeof condition === "object" &&
    condition !== null &&
    !Array.isArray(condition) &&
    !("any" in condition) &&
    !("all" in condition) &&
    typeof (condition as { operator?: unknown }).operator === "string" &&
    LOGIC_OPERATORS.has((condition as { operator: string }).operator)
  );
}

/**
 * The operators that are meaningful against each question type in
 * `visibleIf`. multiChoice answers are arrays, so strict EQ/NEQ never
 * match; GT/LT compare numbers and only fit rating scores. Authoring
 * validation and the workshop's operator picker share this table.
 */
export function allowedVisibleIfOperators(
  type: LumiSurveyQuestionType,
): readonly LogicOperator[] {
  switch (type) {
    case "rating":
      return ["EXISTS", "EQ", "NEQ", "GT", "LT"];
    case "singleChoice":
      return ["EXISTS", "EQ", "NEQ", "CONTAINS"];
    case "multiChoice":
      return ["EXISTS", "CONTAINS"];
    case "text":
      return ["EXISTS", "EQ", "NEQ", "CONTAINS"];
  }
}
