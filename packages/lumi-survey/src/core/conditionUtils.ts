import type {
  LogicConditionGroup,
  LogicLeafCondition,
  VisibleIfCondition,
} from "./types.js";

/** True when the condition is an `any`/`all` group rather than a leaf. */
export function isConditionGroup(
  condition: VisibleIfCondition,
): condition is LogicConditionGroup {
  return "any" in condition || "all" in condition;
}

/**
 * Flattens a condition to its leaf conditions (a leaf yields itself).
 * A group whose body is not an array (malformed raw input) yields no leaves
 * rather than throwing, so callers can fail closed instead of crashing.
 */
export function getLeafConditions(
  condition: VisibleIfCondition,
): LogicLeafCondition[] {
  if ("any" in condition)
    return Array.isArray(condition.any) ? condition.any : [];
  if ("all" in condition)
    return Array.isArray(condition.all) ? condition.all : [];
  return [condition];
}
