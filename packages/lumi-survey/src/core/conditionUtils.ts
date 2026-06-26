import type {
  LogicConditionGroup,
  LogicLeafCondition,
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
