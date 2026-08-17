import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";

export type QuestionTypeId = "rating" | "text" | "singleChoice" | "multiChoice";
export type MoveDirection = "up" | "down";
export type IdFactory = () => string;

type PageList = SurveyDocumentV1["pages"];
type QuestionList = SurveyPageV1["questions"];
type ChoiceOptionV1 = Extract<
  SurveyQuestionV1,
  { type: "singleChoice" }
>["options"][number];

const randomId: IdFactory = () => crypto.randomUUID().slice(0, 8);

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Suggests a survey id from a draft name while the author types. */
export function suggestSurveyId(name: string): string {
  return slugify(name);
}

export function slugifyOptionValue(
  label: string,
  existingValues: readonly string[],
): string {
  const base = slugify(label);

  if (!base) {
    let counter = existingValues.length + 1;
    while (existingValues.includes(`alternativ-${counter}`)) counter += 1;
    return `alternativ-${counter}`;
  }
  if (!existingValues.includes(base)) return base;
  let suffix = 2;
  while (existingValues.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function createQuestion(
  type: QuestionTypeId,
  idFactory: IdFactory = randomId,
): SurveyQuestionV1 {
  const id = `${type}-${idFactory()}`;
  switch (type) {
    case "text":
      return {
        id,
        type: "text",
        prompt: "Hva vil du fortelle oss?",
        maxLength: 1000,
        minRows: 4,
      };
    case "singleChoice":
    case "multiChoice":
      return {
        id,
        type,
        prompt:
          type === "singleChoice"
            ? "Hva kom du hit for å gjøre?"
            : "Hva er viktigst for deg? Velg gjerne flere.",
        options: [
          { value: "alternativ-1", label: "Alternativ 1" },
          { value: "alternativ-2", label: "Alternativ 2" },
        ],
      };
    default:
      return {
        id,
        type: "rating",
        prompt: "Hvordan opplevde du tjenesten?",
        variant: "emoji",
        required: true,
      };
  }
}

function updatePage(
  document: SurveyDocumentV1,
  pageId: string,
  updater: (page: SurveyPageV1) => SurveyPageV1,
): SurveyDocumentV1 {
  return {
    ...document,
    pages: document.pages.map((page) =>
      page.id === pageId ? updater(page) : page,
    ) as PageList,
  };
}

function updateQuestion(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  updater: (question: SurveyQuestionV1) => SurveyQuestionV1,
): SurveyDocumentV1 {
  return updatePage(document, pageId, (page) => ({
    ...page,
    questions: page.questions.map((question) =>
      question.id === questionId ? updater(question) : question,
    ) as QuestionList,
  }));
}

function moveItem<T>(
  items: readonly T[],
  index: number,
  direction: MoveDirection,
): T[] | null {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return null;
  return moveItemToIndex(items, index, target);
}

function moveItemToIndex<T>(
  items: readonly T[],
  index: number,
  rawTarget: number,
): T[] | null {
  const target = Math.max(0, Math.min(items.length - 1, rawTarget));
  if (index < 0 || index === target) return null;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function movePageToIndex(
  document: SurveyDocumentV1,
  pageId: string,
  toIndex: number,
): SurveyDocumentV1 {
  const index = document.pages.findIndex((page) => page.id === pageId);
  const moved = moveItemToIndex(document.pages, index, toIndex);
  if (!moved) return document;
  return { ...document, pages: moved as PageList };
}

export function moveQuestionToIndex(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  toIndex: number,
): SurveyDocumentV1 {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) return document;
  const index = page.questions.findIndex(
    (question) => question.id === questionId,
  );
  const moved = moveItemToIndex(page.questions, index, toIndex);
  if (!moved) return document;
  return updatePage(document, pageId, (current) => ({
    ...current,
    questions: moved as QuestionList,
  }));
}

export function addQuestion(
  document: SurveyDocumentV1,
  pageId: string,
  type: QuestionTypeId,
  idFactory: IdFactory = randomId,
): SurveyDocumentV1 {
  return updatePage(document, pageId, (page) => ({
    ...page,
    questions: [
      ...page.questions,
      createQuestion(type, idFactory),
    ] as QuestionList,
  }));
}

export function removeQuestion(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
): SurveyDocumentV1 {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page || page.questions.length <= 1) return document;
  if (!page.questions.some((question) => question.id === questionId)) {
    return document;
  }
  return updatePage(document, pageId, (current) => ({
    ...current,
    questions: current.questions.filter(
      (question) => question.id !== questionId,
    ) as QuestionList,
  }));
}

export function duplicateQuestion(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  idFactory: IdFactory = randomId,
): SurveyDocumentV1 {
  return updatePage(document, pageId, (page) => {
    const index = page.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (index === -1) return page;
    const original = page.questions[index];
    const copy: SurveyQuestionV1 = {
      ...structuredClone(original),
      id: `${original.type}-${idFactory()}`,
    };
    const questions = [...page.questions];
    questions.splice(index + 1, 0, copy);
    return { ...page, questions: questions as QuestionList };
  });
}

export function moveQuestion(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  direction: MoveDirection,
): SurveyDocumentV1 {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) return document;
  const index = page.questions.findIndex(
    (question) => question.id === questionId,
  );
  const moved = moveItem(page.questions, index, direction);
  if (!moved) return document;
  return updatePage(document, pageId, (current) => ({
    ...current,
    questions: moved as QuestionList,
  }));
}

export function moveQuestionToPage(
  document: SurveyDocumentV1,
  fromPageId: string,
  questionId: string,
  toPageId: string,
): SurveyDocumentV1 {
  const fromPage = document.pages.find((page) => page.id === fromPageId);
  const toPage = document.pages.find((page) => page.id === toPageId);
  if (!fromPage || !toPage || fromPage.id === toPage.id) return document;
  if (fromPage.questions.length <= 1) return document;
  const question = fromPage.questions.find(
    (candidate) => candidate.id === questionId,
  );
  if (!question) return document;
  const withoutSource = updatePage(document, fromPageId, (page) => ({
    ...page,
    questions: page.questions.filter(
      (candidate) => candidate.id !== questionId,
    ) as QuestionList,
  }));
  return updatePage(withoutSource, toPageId, (page) => ({
    ...page,
    questions: [...page.questions, question] as QuestionList,
  }));
}

export function changeQuestionType(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  type: QuestionTypeId,
  idFactory: IdFactory = randomId,
): SurveyDocumentV1 {
  return updateQuestion(document, pageId, questionId, (question) => {
    if (question.type === type) return question;
    // Carry every type-independent field; only fields owned by the old
    // type (variant, options, maxLength, …) are dropped with it.
    return {
      ...createQuestion(type, idFactory),
      id: question.id,
      prompt: question.prompt,
      description: question.description,
      required: question.required,
      analyticsId: question.analyticsId,
      visibleIf: question.visibleIf,
    };
  });
}

export function addPage(
  document: SurveyDocumentV1,
  idFactory: IdFactory = randomId,
): { document: SurveyDocumentV1; pageId: string } {
  const pageId = `side-${idFactory()}`;
  const page: SurveyPageV1 = {
    id: pageId,
    title: "Ny side",
    questions: [createQuestion("rating", idFactory)] as QuestionList,
  };
  return {
    document: { ...document, pages: [...document.pages, page] as PageList },
    pageId,
  };
}

export function removePage(
  document: SurveyDocumentV1,
  pageId: string,
): SurveyDocumentV1 {
  if (document.pages.length <= 1) return document;
  if (!document.pages.some((page) => page.id === pageId)) return document;
  return {
    ...document,
    pages: document.pages.filter((page) => page.id !== pageId) as PageList,
  };
}

export function duplicatePage(
  document: SurveyDocumentV1,
  pageId: string,
  idFactory: IdFactory = randomId,
): SurveyDocumentV1 {
  const index = document.pages.findIndex((page) => page.id === pageId);
  if (index === -1) return document;
  const original = document.pages[index];
  // New ids for the copies, and a map so INTERNAL condition references
  // follow their copied questions. External references and METADATA
  // conditions are kept as-is.
  const idByOriginal = new Map<string, string>();
  for (const question of original.questions) {
    idByOriginal.set(question.id, `${question.type}-${idFactory()}`);
  }
  const remapLeaf = (leaf: ConditionLeafV1): ConditionLeafV1 => {
    if (isMetadataCondition(leaf)) return leaf;
    const mapped = idByOriginal.get(leaf.questionId);
    return mapped ? { ...leaf, questionId: mapped } : leaf;
  };
  const copy: SurveyPageV1 = {
    ...structuredClone(original),
    id: `side-${idFactory()}`,
    questions: original.questions.map((question) => {
      const cloned: SurveyQuestionV1 = {
        ...structuredClone(question),
        id: idByOriginal.get(question.id) ?? question.id,
      };
      const condition = cloned.visibleIf;
      if (condition) {
        if ("any" in condition) {
          cloned.visibleIf = { any: condition.any.map(remapLeaf) };
        } else if ("all" in condition) {
          cloned.visibleIf = { all: condition.all.map(remapLeaf) };
        } else {
          cloned.visibleIf = remapLeaf(condition);
        }
      }
      return cloned;
    }) as QuestionList,
  };
  const pages = [...document.pages];
  pages.splice(index + 1, 0, copy);
  return { ...document, pages: pages as PageList };
}

export function movePage(
  document: SurveyDocumentV1,
  pageId: string,
  direction: MoveDirection,
): SurveyDocumentV1 {
  const index = document.pages.findIndex((page) => page.id === pageId);
  const moved = moveItem(document.pages, index, direction);
  if (!moved) return document;
  return { ...document, pages: moved as PageList };
}

function updateChoiceOptions(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  updater: (options: readonly ChoiceOptionV1[]) => ChoiceOptionV1[] | null,
): SurveyDocumentV1 {
  let changed = false;
  const next = updateQuestion(document, pageId, questionId, (question) => {
    if (question.type !== "singleChoice" && question.type !== "multiChoice") {
      return question;
    }
    const options = updater(question.options);
    if (!options) return question;
    changed = true;
    return { ...question, options };
  });
  return changed ? next : document;
}

export function addOption(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  label: string,
): SurveyDocumentV1 {
  return updateChoiceOptions(document, pageId, questionId, (options) => [
    ...options,
    {
      value: slugifyOptionValue(
        label,
        options.map((option) => option.value),
      ),
      label,
    },
  ]);
}

export function updateOptionLabel(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  optionIndex: number,
  label: string,
): SurveyDocumentV1 {
  return updateChoiceOptions(document, pageId, questionId, (options) => {
    if (optionIndex < 0 || optionIndex >= options.length) return null;
    const next = [...options];
    next[optionIndex] = { ...next[optionIndex], label };
    return next;
  });
}

export function updateOptionValue(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  optionIndex: number,
  value: string,
): SurveyDocumentV1 {
  let previousValue: string | undefined;
  const updated = updateChoiceOptions(
    document,
    pageId,
    questionId,
    (options) => {
      if (optionIndex < 0 || optionIndex >= options.length) return null;
      previousValue = options[optionIndex].value;
      const next = [...options];
      next[optionIndex] = { ...next[optionIndex], value };
      return next;
    },
  );
  if (updated === document || previousValue === undefined) return updated;

  // Follow the rename into DIRECT leaf conditions that reference it, so an
  // explicit value edit does not silently break later visibility. Groups
  // and METADATA conditions are never rewritten implicitly.
  const migrated = previousValue;
  return {
    ...updated,
    pages: updated.pages.map((page) => ({
      ...page,
      questions: page.questions.map((question) => {
        const condition = question.visibleIf;
        if (!condition || "any" in condition || "all" in condition) {
          return question;
        }
        if (isMetadataCondition(condition)) return question;
        if (
          condition.questionId === questionId &&
          condition.operator !== "EXISTS" &&
          condition.value === migrated
        ) {
          return {
            ...question,
            visibleIf: { ...condition, value },
          };
        }
        return question;
      }) as SurveyPageV1["questions"],
    })) as SurveyDocumentV1["pages"],
  };
}

export function removeOption(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  optionIndex: number,
): SurveyDocumentV1 {
  return updateChoiceOptions(document, pageId, questionId, (options) => {
    if (options.length <= 1) return null;
    if (optionIndex < 0 || optionIndex >= options.length) return null;
    return options.filter((_, index) => index !== optionIndex);
  });
}

export function moveOption(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  optionIndex: number,
  direction: MoveDirection,
): SurveyDocumentV1 {
  return updateChoiceOptions(document, pageId, questionId, (options) =>
    moveItem(options, optionIndex, direction),
  );
}

/** Re-insert a question (undo of removeQuestion); index is clamped. */
export function insertQuestionAt(
  document: SurveyDocumentV1,
  pageId: string,
  question: SurveyQuestionV1,
  index: number,
): SurveyDocumentV1 {
  if (!document.pages.some((page) => page.id === pageId)) return document;
  return updatePage(document, pageId, (page) => {
    const questions = [...page.questions];
    questions.splice(
      Math.max(0, Math.min(questions.length, index)),
      0,
      question,
    );
    return { ...page, questions: questions as QuestionList };
  });
}

/** Re-insert a page (undo of removePage); index is clamped. */
export function insertPageAt(
  document: SurveyDocumentV1,
  page: SurveyPageV1,
  index: number,
): SurveyDocumentV1 {
  const pages = [...document.pages];
  pages.splice(Math.max(0, Math.min(pages.length, index)), 0, page);
  return { ...document, pages: pages as PageList };
}

/**
 * Operators that behave correctly against the referenced question type at
 * runtime. multiChoice answers are arrays: strict EQ/NEQ never match, so
 * only EXISTS and CONTAINS are offered.
 */
export function allowedConditionOperators(
  type: SurveyQuestionV1["type"],
): string[] {
  switch (type) {
    case "rating":
      return ["EXISTS", "EQ", "NEQ", "GT", "LT"];
    case "singleChoice":
      return ["EXISTS", "EQ", "NEQ"];
    case "multiChoice":
      return ["EXISTS", "CONTAINS"];
    default:
      return ["EXISTS", "EQ", "NEQ", "CONTAINS"];
  }
}

export interface HandoffIssue {
  questionId: string;
  message: string;
}

/**
 * Release-gate validation for freezing a revision. The runtime validator
 * only checks types (an empty prompt is a valid string), so the workshop
 * adds the semantic bar a handoff deserves. Deliberately NOT part of the
 * widget package — production consumers stay untouched.
 */
function leafConditionIssues(
  question: SurveyQuestionV1,
  questionById: Map<string, SurveyQuestionV1>,
): HandoffIssue[] {
  const condition = question.visibleIf;
  if (!condition) return [];
  const leaves =
    "any" in condition
      ? condition.any
      : "all" in condition
        ? condition.all
        : [condition];
  const issues: HandoffIssue[] = [];
  for (const leaf of leaves) {
    if (isMetadataCondition(leaf)) {
      if ("questionId" in leaf) {
        issues.push({
          questionId: question.id,
          message:
            "Betingelsen peker på metadata, men har også en spørsmålsreferanse — fjern «questionId» eller sett field til ANSWER.",
        });
      }
      continue; // METADATA: no schema to validate against
    }
    if ("key" in leaf) {
      // The stray key is ignored by runtime, but it reads as METADATA to a
      // human — refuse to freeze the ambiguity. ANSWER semantics are still
      // validated below.
      issues.push({
        questionId: question.id,
        message:
          "Betingelsen peker på et spørsmål, men har også en metadata-nøkkel — fjern «key» eller sett field til METADATA.",
      });
    }
    if (!leaf.questionId) continue;
    const referenced = questionById.get(leaf.questionId);
    if (!referenced) continue; // Missing/forward refs are runtime-validated
    if (!allowedConditionOperators(referenced.type).includes(leaf.operator)) {
      issues.push({
        questionId: question.id,
        message:
          "Betingelsen bruker et vilkår som ikke passer spørsmålet det peker på.",
      });
      continue;
    }
    if (leaf.operator === "EXISTS") continue;
    if (
      referenced.type === "singleChoice" ||
      referenced.type === "multiChoice"
    ) {
      const known = referenced.options.some(
        (option) => option.value === leaf.value,
      );
      if (!known) {
        issues.push({
          questionId: question.id,
          message:
            "Betingelsens verdi finnes ikke blant alternativene til spørsmålet det peker på.",
        });
      }
    } else if (referenced.type === "rating") {
      const scale = RATING_SCALES[referenced.variant ?? "emoji"] ?? [];
      if (typeof leaf.value !== "number" || !scale.includes(leaf.value)) {
        issues.push({
          questionId: question.id,
          message:
            "Betingelsens verdi er utenfor skalaen til spørsmålet det peker på.",
        });
      }
    } else if (typeof leaf.value !== "string") {
      // Text answers compare strictly at runtime: 3 never matches "3".
      issues.push({
        questionId: question.id,
        message:
          "Betingelsens verdi må være tekst når den peker på et tekstspørsmål.",
      });
    } else if (leaf.value.trim().length === 0) {
      // Blank text answers are stripped from runtime answer state, so a
      // blank value gives EQ that never matches, NEQ that is true before
      // any answer, and CONTAINS that matches everything.
      issues.push({
        questionId: question.id,
        message:
          "Betingelsens verdi kan ikke være tom når den peker på et tekstspørsmål.",
      });
    }
  }
  return issues;
}

export function findHandoffIssues(document: SurveyDocumentV1): HandoffIssue[] {
  const issues: HandoffIssue[] = [];
  const questionById = new Map<string, SurveyQuestionV1>();
  for (const page of document.pages) {
    for (const question of page.questions) {
      questionById.set(question.id, question);
    }
  }
  for (const page of document.pages) {
    for (const question of page.questions) {
      issues.push(...leafConditionIssues(question, questionById));
      if (!question.prompt.trim()) {
        issues.push({
          questionId: question.id,
          message: "Spørsmålet mangler spørsmålstekst.",
        });
      }
      if (question.type === "singleChoice" || question.type === "multiChoice") {
        question.options.forEach((option, index) => {
          if (!option.label.trim()) {
            issues.push({
              questionId: question.id,
              message: `Alternativ ${index + 1} mangler tekst.`,
            });
          }
          if (!option.value.trim()) {
            issues.push({
              questionId: question.id,
              message: `Alternativ ${index + 1} mangler verdi.`,
            });
          }
        });
      }
    }
  }
  return issues;
}

/**
 * Whether any page can end up with the wide NPS dock (512px). The dock
 * headers on the first VISIBLE question, so any NPS question qualifies
 * once visibleIf hides those before it — be conservative.
 */
export function documentNeedsWideDock(document: SurveyDocumentV1): boolean {
  return document.pages.some((page) =>
    page.questions.some(
      (question) => question.type === "rating" && question.variant === "nps",
    ),
  );
}

export type VisibleIfConditionV1 = NonNullable<SurveyQuestionV1["visibleIf"]>;

/** A single condition — the non-group member of the visibleIf union. */
export type ConditionLeafV1 = Exclude<
  VisibleIfConditionV1,
  { any: unknown } | { all: unknown }
>;

export type ConditionCombinator = "all" | "any";

/** Flattens a visibleIf into its editable list of leaves. */
export function visibleIfLeaves(
  condition: VisibleIfConditionV1 | undefined,
): ConditionLeafV1[] {
  if (!condition) return [];
  if ("any" in condition) return [...condition.any];
  if ("all" in condition) return [...condition.all];
  return [condition];
}

/** The group combinator; leaves and unset conditions read as "all". */
export function conditionCombinator(
  condition: VisibleIfConditionV1 | undefined,
): ConditionCombinator {
  return condition && "any" in condition ? "any" : "all";
}

/**
 * Runtime-exact serialization: no leaves clears the condition, one leaf
 * stays a plain leaf (never a one-member group), several form a group.
 */
export function buildVisibleIf(
  leaves: readonly ConditionLeafV1[],
  combinator: ConditionCombinator,
): VisibleIfConditionV1 | undefined {
  if (leaves.length === 0) return undefined;
  if (leaves.length === 1) return leaves[0];
  return combinator === "any" ? { any: [...leaves] } : { all: [...leaves] };
}

/**
 * Runtime (`evaluateVisibility`) and the API validator both discriminate
 * the condition target on `field` ALONE — a stray `key` on an ANSWER leaf
 * must never make the builder treat it as METADATA. Keep in sync with
 * the widget package.
 */
export function isMetadataCondition<
  T extends { field?: "ANSWER" | "METADATA" },
>(leaf: T): leaf is Extract<T, { field: "METADATA" }> {
  return leaf.field === "METADATA";
}

/** Sets or clears a question's visibility condition. */
export function setQuestionVisibleIf(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  condition: VisibleIfConditionV1 | undefined,
): SurveyDocumentV1 {
  return updateQuestion(document, pageId, questionId, (question) => {
    if (condition === undefined) {
      const { visibleIf: _removed, ...rest } = question;
      return rest as SurveyQuestionV1;
    }
    return { ...question, visibleIf: condition };
  });
}

export interface ReferenceableQuestion {
  id: string;
  prompt: string;
  type: SurveyQuestionV1["type"];
  pageNumber: number;
  questionNumber: number;
}

/**
 * Questions a visibleIf condition on `questionId` may reference: strictly
 * earlier in flattened page order, mirroring the runtime validator's rule.
 */
export function listReferenceableQuestions(
  document: SurveyDocumentV1,
  questionId: string,
): ReferenceableQuestion[] {
  const earlier: ReferenceableQuestion[] = [];
  for (const [pageIndex, page] of document.pages.entries()) {
    for (const [questionIndex, question] of page.questions.entries()) {
      if (question.id === questionId) return earlier;
      earlier.push({
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        pageNumber: pageIndex + 1,
        questionNumber: questionIndex + 1,
      });
    }
  }
  return [];
}

export interface ConditionValueSuggestion {
  value: string | number;
  label: string;
}

const RATING_SCALES: Record<string, number[]> = {
  emoji: [1, 2, 3, 4, 5],
  stars: [1, 2, 3, 4, 5],
  thumbs: [1, 2],
  nps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

/** Value suggestions for a condition referencing the given question. */
export function conditionValueSuggestions(
  document: SurveyDocumentV1,
  referencedQuestionId: string,
): ConditionValueSuggestion[] {
  for (const page of document.pages) {
    for (const question of page.questions) {
      if (question.id !== referencedQuestionId) continue;
      if (question.type === "singleChoice" || question.type === "multiChoice") {
        return question.options.map((option) => ({
          value: option.value,
          label: option.label,
        }));
      }
      if (question.type === "rating") {
        const scale = RATING_SCALES[question.variant ?? "emoji"] ?? [];
        return scale.map((value) => ({ value, label: String(value) }));
      }
      return [];
    }
  }
  return [];
}

export interface QuestionLocation {
  pageNumber: number;
  questionNumber: number;
  pageId: string;
}

export function locateQuestion(
  document: SurveyDocumentV1,
  questionId: string,
): QuestionLocation | null {
  for (const [pageIndex, page] of document.pages.entries()) {
    const questionIndex = page.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (questionIndex !== -1) {
      return {
        pageNumber: pageIndex + 1,
        questionNumber: questionIndex + 1,
        pageId: page.id,
      };
    }
  }
  return null;
}
