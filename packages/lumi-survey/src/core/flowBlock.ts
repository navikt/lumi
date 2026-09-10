import {
  allowedVisibleIfOperators,
  getLeafConditions,
  isConditionGroup,
  isLeafCondition,
} from "./conditionUtils.js";
import type {
  LogicLeafCondition,
  LumiSurveyQuestion,
  RatingQuestion,
  TransportFlowCondition,
  TransportFlowV1,
} from "./types.js";
import { RATING_SCALES } from "./types.js";

export const FLOW_EVALUATOR_VERSION = "visible-if-v1" as const;
const MAX_FLOW_KEY_LENGTH = 200;
const MAX_FLOW_STRING_VALUE_LENGTH = 2_048;
const MAX_FLOW_CONDITIONS_PER_FIELD = 50;
const MAX_FLOW_FIELDS = 50;
const SUPPORTED_QUESTION_TYPES = new Set([
  "rating",
  "singleChoice",
  "multiChoice",
  "text",
]);

/**
 * Builds the canonical flow contract for structured visibility.
 *
 * Legacy imperative `logic` is intentionally a hard boundary: submissions
 * continue to work, but no flow contract is emitted and analytics must treat
 * the row as unpinned until the survey is migrated to `visibleIf`.
 */
export function buildFlowBlock(
  questions: LumiSurveyQuestion[],
): TransportFlowV1 | undefined {
  if (
    questions.length === 0 ||
    questions.length > MAX_FLOW_FIELDS ||
    questions.some(
      (question) =>
        question.logic !== undefined ||
        typeof question.id !== "string" ||
        question.id.trim().length === 0 ||
        question.id.length > MAX_FLOW_KEY_LENGTH ||
        !SUPPORTED_QUESTION_TYPES.has(question.type),
    )
  ) {
    return undefined;
  }

  const previousQuestions = new Map<string, LumiSurveyQuestion>();
  const fields: TransportFlowV1["fields"] = [];
  for (const question of questions) {
    if (question.visibleIf === undefined) {
      fields.push({ fieldId: question.id });
      previousQuestions.set(question.id, question);
      continue;
    }

    if (
      typeof question.visibleIf !== "object" ||
      question.visibleIf === null ||
      Array.isArray(question.visibleIf) ||
      ("any" in question.visibleIf && "all" in question.visibleIf)
    ) {
      return undefined;
    }

    const leaves = getLeafConditions(question.visibleIf);
    if (
      leaves.length === 0 ||
      leaves.length > MAX_FLOW_CONDITIONS_PER_FIELD ||
      leaves.some((leaf) => !isLeafCondition(leaf))
    ) {
      return undefined;
    }

    const conditions = leaves.map((leaf) =>
      normalizeCondition(leaf, previousQuestions),
    );
    if (conditions.some((condition) => condition === undefined)) {
      return undefined;
    }

    fields.push({
      fieldId: question.id,
      visibleIf: {
        combinator:
          isConditionGroup(question.visibleIf) && "any" in question.visibleIf
            ? "ANY"
            : "ALL",
        conditions: conditions
          .filter(
            (condition): condition is TransportFlowCondition =>
              condition !== undefined,
          )
          .sort(compareConditions),
      },
    });
    previousQuestions.set(question.id, question);
  }

  return {
    schemaVersion: 1,
    evaluatorVersion: FLOW_EVALUATOR_VERSION,
    fields,
  };
}

function normalizeCondition(
  condition: LogicLeafCondition,
  previousQuestions: Map<string, LumiSurveyQuestion>,
): TransportFlowCondition | undefined {
  if (
    condition.field !== undefined &&
    condition.field !== "ANSWER" &&
    condition.field !== "METADATA"
  ) {
    return undefined;
  }
  const [source, key] =
    condition.field === "METADATA"
      ? (["METADATA", condition.key] as const)
      : (["ANSWER", condition.questionId ?? ""] as const);
  if (
    typeof key !== "string" ||
    key.trim().length === 0 ||
    key.length > MAX_FLOW_KEY_LENGTH
  ) {
    return undefined;
  }
  if (!hasCanonicalValue(condition)) {
    return undefined;
  }
  if (source === "METADATA") {
    if (!isCompatibleWithMetadata(condition, key)) return undefined;
  } else {
    const referenced = previousQuestions.get(key);
    if (!referenced || !isCompatibleWithQuestion(condition, referenced)) {
      return undefined;
    }
  }

  return {
    source,
    key,
    operator: condition.operator,
    ...(condition.value !== undefined ? { value: condition.value } : {}),
  };
}

function hasCanonicalValue(condition: LogicLeafCondition): boolean {
  if (condition.operator === "EXISTS") {
    return condition.value === undefined;
  }
  if (condition.value === undefined) return false;
  if (typeof condition.value === "number")
    return Number.isFinite(condition.value);
  if (typeof condition.value === "string") {
    return condition.value.length <= MAX_FLOW_STRING_VALUE_LENGTH;
  }
  return typeof condition.value === "boolean";
}

function isCompatibleWithMetadata(
  condition: LogicLeafCondition,
  key: string,
): boolean {
  if (key !== "deviceType") return true;
  if (!["EXISTS", "EQ", "NEQ", "CONTAINS"].includes(condition.operator)) {
    return false;
  }
  if (condition.operator === "EXISTS") return true;
  if (typeof condition.value !== "string") return false;
  return (
    condition.operator === "CONTAINS" ||
    ["desktop", "mobile", "tablet"].includes(condition.value)
  );
}

function isCompatibleWithQuestion(
  condition: LogicLeafCondition,
  question: LumiSurveyQuestion,
): boolean {
  if (!SUPPORTED_QUESTION_TYPES.has(question.type)) return false;
  if (!allowedVisibleIfOperators(question.type).includes(condition.operator)) {
    return false;
  }
  if (condition.operator === "EXISTS") return true;

  switch (question.type) {
    case "rating": {
      if (
        typeof condition.value !== "number" ||
        !Number.isInteger(condition.value)
      ) {
        return false;
      }
      const variant = (question as RatingQuestion).variant ?? "emoji";
      const minimum = variant === "nps" ? 0 : 1;
      return (
        condition.value >= minimum &&
        condition.value <= RATING_SCALES[variant] - (variant === "nps" ? 1 : 0)
      );
    }
    case "singleChoice":
    case "multiChoice":
      return (
        typeof condition.value === "string" &&
        question.options.some((option) => option.value === condition.value)
      );
    case "text":
      return (
        typeof condition.value === "string" && condition.value.trim().length > 0
      );
  }
}

function compareConditions(
  left: TransportFlowCondition,
  right: TransportFlowCondition,
): number {
  const leftParts = conditionSortParts(left);
  const rightParts = conditionSortParts(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function conditionSortParts(
  condition: TransportFlowCondition,
): readonly string[] {
  return [
    condition.source,
    condition.key,
    condition.operator,
    condition.value === undefined ? "undefined" : typeof condition.value,
    condition.value === undefined ? "" : JSON.stringify(condition.value),
  ];
}
