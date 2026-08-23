import {
  allowedVisibleIfOperators,
  createDiscoverySurveyDocument,
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  getSpecializedSurveyContractIssues,
  SPECIALIZED_SURVEY_FIELD_IDS,
  type SurveyDocumentV1,
  type SurveyIntroV1,
  type SurveyPageV1,
  type SurveyQuestionV1,
  type SurveySuccessV1,
} from "@navikt/lumi-survey";

export type QuestionTypeId = "rating" | "text" | "singleChoice" | "multiChoice";
export type MoveDirection = "up" | "down";
export type IdFactory = () => string;

export const SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE = "__lumi_example_task__";
export const SURVEY_TEMPLATE_PLACEHOLDER_LABELS = [
  "Bytt ut med en oppgave dere vil måle",
  "Bytt ut med den første oppgaven",
  "Bytt ut med den andre oppgaven",
] as const;

export function isSurveyTemplatePlaceholderValue(value: string): boolean {
  return value.startsWith(SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE);
}

export function isSurveyTemplatePlaceholderLabel(label: string): boolean {
  const normalized = label.trim();
  return SURVEY_TEMPLATE_PLACEHOLDER_LABELS.some(
    (placeholder) => placeholder === normalized,
  );
}

export function isRequiredSpecializedQuestion(
  surveyType: SurveyDocumentV1["type"],
  questionId: string,
): boolean {
  if (surveyType === "discovery" || surveyType === "topTasks") {
    return (
      questionId === SPECIALIZED_SURVEY_FIELD_IDS.task ||
      questionId === SPECIALIZED_SURVEY_FIELD_IDS.success
    );
  }
  return (
    surveyType === "taskPriority" &&
    questionId === SPECIALIZED_SURVEY_FIELD_IDS.priority
  );
}

export function getSpecializedAuthoringContractIssues(
  document: SurveyDocumentV1,
) {
  const questions = document.pages.flatMap((page) => page.questions);
  const issues = [
    ...getSpecializedSurveyContractIssues(document.type ?? "custom", questions),
  ];
  if (document.type === "discovery" || document.type === "topTasks") {
    const success = questions.find(
      (question) => question.id === SPECIALIZED_SURVEY_FIELD_IDS.success,
    );
    if (
      success?.type === "singleChoice" &&
      success.randomize === true &&
      !issues.some((issue) => issue.fieldId === success.id)
    ) {
      issues.push({
        fieldId: success.id,
        message:
          "Svarene Ja, Delvis og Nei må vises i fast rekkefølge for dette analyseoppsettet.",
      });
    }
  }
  return issues;
}

export function isSpecializedQuestionContractValid(
  surveyType: SurveyDocumentV1["type"],
  question: SurveyQuestionV1,
): boolean {
  if (!isRequiredSpecializedQuestion(surveyType, question.id)) return false;
  if (question.required !== true || question.visibleIf !== undefined)
    return false;
  if (surveyType === "discovery" && question.id === "task") {
    return question.type === "text";
  }
  if (surveyType === "topTasks" && question.id === "task") {
    return question.type === "singleChoice";
  }
  if (question.id === "success") {
    return (
      question.type === "singleChoice" &&
      question.randomize !== true &&
      question.options.length === 3 &&
      new Set(question.options.map((option) => option.value)).size === 3 &&
      question.options.every((option) =>
        ["yes", "partial", "no"].includes(option.value),
      )
    );
  }
  return surveyType === "taskPriority" && question.type === "multiChoice";
}

/** Restores only the technical fields a specialized analysis needs. */
export function repairSpecializedSurveyDocument(
  document: SurveyDocumentV1,
): SurveyDocumentV1 {
  const template = (() => {
    if (document.type === "discovery") return createDiscoverySurveyDocument();
    if (document.type === "topTasks") {
      return createTopTasksSurveyDocument({
        tasks: [
          {
            value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
            label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[0],
          },
        ],
        includeOtherTask: true,
      });
    }
    if (document.type === "taskPriority") {
      return createTaskPrioritySurveyDocument({
        tasks: [
          {
            value: `${SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE}-1`,
            label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[1],
          },
          {
            value: `${SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE}-2`,
            label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[2],
          },
        ],
      });
    }
    return null;
  })();
  if (!template) return document;

  const templateQuestions = new Map(
    template.pages.flatMap((page) =>
      page.questions.map((question) => [question.id, question] as const),
    ),
  );
  const requiredIds = new Set(
    [...templateQuestions.keys()].filter((id) =>
      isRequiredSpecializedQuestion(document.type, id),
    ),
  );
  const seen = new Set<string>();
  const repairQuestion = (current: SurveyQuestionV1): SurveyQuestionV1 => {
    const fallback = templateQuestions.get(current.id);
    if (!fallback) return current;
    const common = {
      ...fallback,
      prompt: current.prompt.trim() ? current.prompt : fallback.prompt,
      description: current.description,
      analyticsId: current.analyticsId,
    };
    if (
      current.id === SPECIALIZED_SURVEY_FIELD_IDS.task &&
      document.type === "topTasks" &&
      current.type === "singleChoice"
    ) {
      const options = current.options.some((option) => option.value !== "other")
        ? current.options
        : [
            ...current.options,
            {
              value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
              label: SURVEY_TEMPLATE_PLACEHOLDER_LABELS[0],
            },
          ];
      return {
        ...current,
        options,
        required: true,
        visibleIf: undefined,
      };
    }
    if (
      current.id === SPECIALIZED_SURVEY_FIELD_IDS.priority &&
      current.type === "multiChoice"
    ) {
      const fallbackOptions =
        fallback.type === "multiChoice" ? fallback.options : [];
      const options = [...current.options];
      for (const option of fallbackOptions) {
        if (options.length >= 2) break;
        if (!options.some((candidate) => candidate.value === option.value)) {
          options.push(option);
        }
      }
      return {
        ...current,
        options,
        required: true,
        visibleIf: undefined,
        maxSelections:
          current.maxSelections && current.maxSelections <= options.length
            ? current.maxSelections
            : Math.min(5, options.length),
      };
    }
    if (current.id === SPECIALIZED_SURVEY_FIELD_IDS.success) {
      const currentOptions =
        current.type === "singleChoice"
          ? new Map(current.options.map((option) => [option.value, option]))
          : new Map<string, never>();
      if (fallback.type !== "singleChoice") return common;
      return {
        ...fallback,
        prompt: current.prompt.trim() ? current.prompt : fallback.prompt,
        description: current.description,
        analyticsId: current.analyticsId,
        options: fallback.options.map((option) => ({
          ...option,
          ...currentOptions.get(option.value),
          value: option.value,
          label: currentOptions.get(option.value)?.label.trim() || option.label,
        })),
        required: true,
        visibleIf: undefined,
      };
    }
    return { ...common, required: true, visibleIf: undefined };
  };

  const pages = document.pages
    .map((page) => ({
      ...page,
      questions: page.questions.flatMap((question) => {
        if (!templateQuestions.has(question.id)) return [question];
        if (seen.has(question.id)) return [];
        seen.add(question.id);
        return [repairQuestion(question)];
      }) as SurveyPageV1["questions"],
    }))
    .filter((page) => page.questions.length > 0);

  const uniquePageId = (preferred: string) => {
    const existing = new Set(pages.map((page) => page.id));
    if (!existing.has(preferred)) return preferred;
    let suffix = 2;
    while (existing.has(`${preferred}-${suffix}`)) suffix += 1;
    return `${preferred}-${suffix}`;
  };
  const referencesQuestion = (
    question: SurveyQuestionV1,
    referencedId: string,
  ) => {
    const condition = question.visibleIf;
    if (!condition) return false;
    if ("questionId" in condition) return condition.questionId === referencedId;
    if (!("all" in condition) && !("any" in condition)) return false;
    const leaves = "all" in condition ? condition.all : condition.any;
    return leaves.some(
      (leaf) => "questionId" in leaf && leaf.questionId === referencedId,
    );
  };
  const insertionIndexFor = (questionId: string) => {
    if (
      questionId === SPECIALIZED_SURVEY_FIELD_IDS.task ||
      questionId === SPECIALIZED_SURVEY_FIELD_IDS.priority
    ) {
      return 0;
    }
    if (questionId === SPECIALIZED_SURVEY_FIELD_IDS.success) {
      const dependentPageIndex = pages.findIndex((page) =>
        page.questions.some(
          (question) =>
            question.id === SPECIALIZED_SURVEY_FIELD_IDS.blocker ||
            referencesQuestion(question, questionId),
        ),
      );
      if (dependentPageIndex >= 0) return dependentPageIndex;
    }
    return pages.length;
  };

  for (const templatePage of template.pages) {
    for (const question of templatePage.questions) {
      if (!requiredIds.has(question.id) || seen.has(question.id)) continue;
      const pageId = uniquePageId(templatePage.id);
      pages.splice(insertionIndexFor(question.id), 0, {
        ...templatePage,
        id: pageId,
        questions: [question],
      });
      seen.add(question.id);
    }
  }
  return {
    ...document,
    pages: pages as SurveyDocumentV1["pages"],
  };
}

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

/**
 * Lowest `@navikt/lumi-survey` release that understands `authoringSchemaVersion: 1`.
 * The page-based document format landed after 1.0.0, so an export handed to a
 * consumer on an older widget will not type-check or render.
 */
export const MIN_WIDGET_VERSION_FOR_DOCUMENTS = "2.0.0";

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
  // No default title: a page title is a group heading for several questions,
  // and seeding one makes every page ship with a heading that competes with
  // the question below it in the widget.
  const page: SurveyPageV1 = {
    id: pageId,
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

/**
 * Replaces a template-only option identity after the designer has supplied a
 * real label. Later label edits keep the generated identity stable.
 */
export function commitOptionLabel(
  document: SurveyDocumentV1,
  pageId: string,
  questionId: string,
  optionIndex: number,
  label: string,
): SurveyDocumentV1 {
  return updateChoiceOptions(document, pageId, questionId, (options) => {
    const option = options[optionIndex];
    if (
      !option ||
      !label.trim() ||
      isSurveyTemplatePlaceholderLabel(label) ||
      !isSurveyTemplatePlaceholderValue(option.value)
    ) {
      return null;
    }
    const existingValues = options
      .filter((_, index) => index !== optionIndex)
      .map((candidate) => candidate.value);
    const next = [...options];
    next[optionIndex] = {
      ...option,
      label,
      value: slugifyOptionValue(label, existingValues),
    };
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
 * Operators offered by the workshop for the referenced question type.
 * The package's runtime-compatible table also permits CONTAINS for string
 * singleChoice answers to preserve code-authored V1 documents. The workshop
 * intentionally keeps exact equality for that type, matching the backend's
 * release-gate policy and avoiding ambiguous substring conditions.
 */
export function allowedConditionOperators(
  type: SurveyQuestionV1["type"],
): string[] {
  const compatible = allowedVisibleIfOperators(type);
  return type === "singleChoice"
    ? compatible.filter((operator) => operator !== "CONTAINS")
    : [...compatible];
}

export interface HandoffIssue {
  /** Owning question, or null for survey-level issues (intro/success). */
  questionId: string | null;
  message: string;
}

/**
 * Release-gate validation for freezing a revision. The runtime validator
 * only checks types (an empty prompt is a valid string), so the workshop
 * adds the semantic bar a handoff deserves. Deliberately NOT part of the
 * widget's structural validator, so drafts remain editable until handoff.
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
  if (document.intro && document.intro.title.trim().length === 0) {
    issues.push({
      questionId: null,
      message: "Velkomstsiden mangler tittel.",
    });
  }
  if (document.success && document.success.title.trim().length === 0) {
    issues.push({
      questionId: null,
      message: "Bekreftelsen etter innsending mangler tittel.",
    });
  }
  const questionById = new Map<string, SurveyQuestionV1>();
  for (const page of document.pages) {
    for (const question of page.questions) {
      questionById.set(question.id, question);
    }
  }
  for (const contractIssue of getSpecializedAuthoringContractIssues(document)) {
    issues.push({
      questionId: questionById.has(contractIssue.fieldId)
        ? contractIssue.fieldId
        : null,
      message: contractIssue.message,
    });
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
        if (
          question.type === "singleChoice" &&
          question.maxSelections !== undefined
        ) {
          issues.push({
            questionId: question.id,
            message: "Maks antall valg kan bare brukes på flervalgsspørsmål.",
          });
        }
        if (question.options.length === 0) {
          issues.push({
            questionId: question.id,
            message: "Spørsmålet må ha minst ett svaralternativ.",
          });
        }
        if (
          document.type === "topTasks" &&
          question.id === "task" &&
          question.options.every((option) => option.value === "other")
        ) {
          issues.push({
            questionId: question.id,
            message:
              "Legg til minst én kjent oppgave som brukeren kan velge mellom.",
          });
        }
        question.options.forEach((option, index) => {
          if (
            isSurveyTemplatePlaceholderValue(option.value) ||
            isSurveyTemplatePlaceholderLabel(option.label)
          ) {
            issues.push({
              questionId: question.id,
              message: `Bytt ut eksempeloppgaven i alternativ ${index + 1} med en oppgave dere vil ${
                document.type === "taskPriority" ? "prioritere" : "måle"
              }.`,
            });
          }
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

/** Sets or clears the survey-level intro screen. */
export function setSurveyIntro(
  document: SurveyDocumentV1,
  intro: SurveyIntroV1 | undefined,
): SurveyDocumentV1 {
  if (intro === undefined) {
    const { intro: _removed, ...rest } = document;
    return rest as SurveyDocumentV1;
  }
  return { ...document, intro };
}

/** Sets or clears the survey-level confirmation shown after submission. */
export function setSurveySuccess(
  document: SurveyDocumentV1,
  success: SurveySuccessV1 | undefined,
): SurveyDocumentV1 {
  if (success === undefined) {
    const { success: _removed, ...rest } = document;
    return rest as SurveyDocumentV1;
  }
  return { ...document, success };
}

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
