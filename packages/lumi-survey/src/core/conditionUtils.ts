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

/** Flattens a condition to its leaf conditions (a leaf yields itself). */
export function getLeafConditions(
  condition: VisibleIfCondition,
): LogicLeafCondition[] {
  if ("any" in condition) return condition.any;
  if ("all" in condition) return condition.all;
  return [condition];
}
