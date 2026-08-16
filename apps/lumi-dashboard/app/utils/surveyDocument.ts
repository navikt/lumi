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
  const copy: SurveyPageV1 = {
    ...structuredClone(original),
    id: `side-${idFactory()}`,
    questions: original.questions.map((question) => ({
      ...structuredClone(question),
      id: `${question.type}-${idFactory()}`,
    })) as QuestionList,
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
  return updateChoiceOptions(document, pageId, questionId, (options) => {
    if (optionIndex < 0 || optionIndex >= options.length) return null;
    const next = [...options];
    next[optionIndex] = { ...next[optionIndex], value };
    return next;
  });
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
export function findHandoffIssues(document: SurveyDocumentV1): HandoffIssue[] {
  const issues: HandoffIssue[] = [];
  for (const page of document.pages) {
    for (const question of page.questions) {
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
