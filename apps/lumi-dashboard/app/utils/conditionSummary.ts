import type { SurveyDocumentV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import {
  type ConditionValueSuggestion,
  conditionCombinator,
  conditionValueSuggestions,
  isMetadataCondition,
  type VisibleIfConditionV1,
  visibleIfLeaves,
} from "./surveyDocument";

export interface ConditionRefInfo {
  prompt: string;
  pageNumber: number;
  /** Referenced question's type; decides membership vs. substring wording */
  type?: SurveyQuestionV1["type"];
}

export interface DescribeConditionContext {
  resolveRef: (questionId: string) => ConditionRefInfo | null;
  suggestionsFor: (questionId: string) => ConditionValueSuggestion[];
  /** Page number of the question carrying the condition; enables «på side N». */
  ownPageNumber?: number;
}

function shortPrompt(prompt: string, max = 30): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "uten tekst";
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** «1–2» for LT 3 on a 1–5 scale; null when the scale is not numeric. */
function numericRange(
  suggestions: ConditionValueSuggestion[],
  operator: "GT" | "LT",
  threshold: unknown,
): string | null {
  if (typeof threshold !== "number") return null;
  const values = suggestions
    .map((suggestion) => suggestion.value)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  const matching = values.filter((value) =>
    operator === "LT" ? value < threshold : value > threshold,
  );
  if (matching.length === 0) return null;
  const min = Math.min(...matching);
  const max = Math.max(...matching);
  return min === max ? String(min) : `${min}–${max}`;
}

function subjectFor(
  questionId: string | undefined,
  ctx: DescribeConditionContext,
): string {
  const ref = questionId ? ctx.resolveRef(questionId) : null;
  if (!ref) return "et tidligere spørsmål";
  const crossPage =
    ctx.ownPageNumber !== undefined && ref.pageNumber !== ctx.ownPageNumber
      ? ` på side ${ref.pageNumber}`
      : "";
  return `«${shortPrompt(ref.prompt)}»${crossPage}`;
}

function describeLeaf(
  leaf: ReturnType<typeof visibleIfLeaves>[number],
  ctx: DescribeConditionContext,
): string {
  if (isMetadataCondition(leaf)) {
    return `forhold satt i kode («${leaf.key}») stemmer`;
  }
  const subject = subjectFor(leaf.questionId, ctx);
  const suggestions = leaf.questionId
    ? ctx.suggestionsFor(leaf.questionId)
    : [];
  const valueLabel = () => {
    const match = suggestions.find(
      (suggestion) => suggestion.value === leaf.value,
    );
    return match ? match.label : String(leaf.value ?? "");
  };
  switch (leaf.operator) {
    case "EXISTS":
      return `${subject} er besvart`;
    case "EQ":
      return `svaret på ${subject} er «${valueLabel()}»`;
    case "NEQ":
      return `svaret på ${subject} ikke er «${valueLabel()}»`;
    case "GT":
    case "LT": {
      const range = numericRange(suggestions, leaf.operator, leaf.value);
      if (range) return `svaret på ${subject} er ${range}`;
      const word = leaf.operator === "GT" ? "over" : "under";
      return `svaret på ${subject} er ${word} ${String(leaf.value ?? "")}`;
    }
    case "CONTAINS":
      // Membership only against multiChoice answers; every other CONTAINS
      // is a substring match at runtime (free text — or invalid, which the
      // gates flag) and «er valgt» would misdescribe it.
      return leaf.questionId &&
        ctx.resolveRef(leaf.questionId)?.type === "multiChoice"
        ? `«${valueLabel()}» er valgt på ${subject}`
        : `svaret på ${subject} inneholder «${valueLabel()}»`;
    default:
      return `${subject} oppfyller vilkåret`;
  }
}

/**
 * An all-group of GT/LT leaves on the same numeric question is one interval
 * («er 7–8»), not two overlapping ranges joined with «og».
 */
function describeNumericAllGroup(
  leaves: ReturnType<typeof visibleIfLeaves>,
  ctx: DescribeConditionContext,
): string | null {
  if (leaves.length < 2) return null;
  const [first] = leaves;
  if (isMetadataCondition(first) || !first.questionId) return null;
  const questionId = first.questionId;
  const bounds: { operator: "GT" | "LT"; value: number }[] = [];
  for (const leaf of leaves) {
    if (isMetadataCondition(leaf) || leaf.questionId !== questionId) {
      return null;
    }
    if (leaf.operator !== "GT" && leaf.operator !== "LT") return null;
    if (typeof leaf.value !== "number") return null;
    bounds.push({ operator: leaf.operator, value: leaf.value });
  }
  const values = ctx
    .suggestionsFor(questionId)
    .map((suggestion) => suggestion.value)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  const matching = values.filter((value) =>
    bounds.every((bound) =>
      bound.operator === "GT" ? value > bound.value : value < bound.value,
    ),
  );
  if (matching.length === 0) return null;
  const min = Math.min(...matching);
  const max = Math.max(...matching);
  const range = min === max ? String(min) : `${min}–${max}`;
  return `svaret på ${subjectFor(questionId, ctx)} er ${range}`;
}

/** Plain-language reading of a visibleIf, e.g. «Vises når … er 1–2». */
export function describeVisibleIf(
  condition: VisibleIfConditionV1 | undefined,
  ctx: DescribeConditionContext,
): string | null {
  const leaves = visibleIfLeaves(condition);
  if (leaves.length === 0) return null;
  if (conditionCombinator(condition) === "all") {
    const interval = describeNumericAllGroup(leaves, ctx);
    if (interval) return `Vises når ${interval}`;
  }
  const joiner = conditionCombinator(condition) === "any" ? " eller " : " og ";
  return `Vises når ${leaves.map((leaf) => describeLeaf(leaf, ctx)).join(joiner)}`;
}

/** Summaries for every conditional question in the document, keyed by id. */
export function buildConditionSummaries(
  document: SurveyDocumentV1,
): ReadonlyMap<string, string> {
  const refIndex = new Map<string, ConditionRefInfo>();
  document.pages.forEach((page, pageIndex) => {
    for (const question of page.questions) {
      refIndex.set(question.id, {
        prompt: question.prompt,
        pageNumber: pageIndex + 1,
        type: question.type,
      });
    }
  });
  const summaries = new Map<string, string>();
  document.pages.forEach((page, pageIndex) => {
    for (const question of page.questions) {
      if (!question.visibleIf) continue;
      const text = describeVisibleIf(question.visibleIf, {
        resolveRef: (id) => refIndex.get(id) ?? null,
        suggestionsFor: (id) => conditionValueSuggestions(document, id),
        ownPageNumber: pageIndex + 1,
      });
      if (text) summaries.set(question.id, text);
    }
  });
  return summaries;
}
