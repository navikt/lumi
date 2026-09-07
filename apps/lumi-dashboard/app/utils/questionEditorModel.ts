import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { followUpBranches } from "./surveyDocument";

type Question = SurveyQuestionV1;
export type QuestionPages = Question[][];

export function ruleLeaves(question: Question) {
  const rule = question.visibleIf;
  return !rule
    ? []
    : "any" in rule
      ? rule.any
      : "all" in rule
        ? rule.all
        : [rule];
}

export function sources(question: Question): string[] {
  return [
    ...new Set(
      ruleLeaves(question).flatMap((leaf) =>
        "questionId" in leaf ? [leaf.questionId] : [],
      ),
    ),
  ];
}

export function orderConflict(pages: QuestionPages) {
  const questions = pages.flat();
  const positions = new Map(
    questions.map((question, index) => [question.id, index]),
  );
  for (const question of questions) {
    const source = sources(question).find(
      (id) =>
        !positions.has(id) ||
        (positions.get(id) ?? -1) >= (positions.get(question.id) ?? -1),
    );
    if (source) return { question, source };
  }
  return null;
}

export function deletionPlan(questions: Question[], id: string) {
  const affected = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const question of questions) {
      if (
        !affected.has(question.id) &&
        sources(question).some((source) => affected.has(source))
      ) {
        affected.add(question.id);
        changed = true;
      }
    }
  }
  const dependents = questions.filter(
    (question) => question.id !== id && affected.has(question.id),
  );
  // Only offer cascading deletion for the simple follow-ups this editor creates.
  // Other conditions may also be meaningful independently of the deleted source.
  const blockers = dependents.filter(
    (question) =>
      !isSimpleCondition(question, questions) &&
      !isRatingShortcut(question, questions),
  );
  return { affected, dependents, blockers };
}

// Rating shortcuts use numeric comparisons and still need the full condition
// editor. Recognizing a single catalog leaf here only makes deletion safe;
// it does not make numeric rules editable as choice-answer conditions.
function isRatingShortcut(question: Question, questions: Question[]) {
  const condition = question.visibleIf;
  if (
    !condition ||
    "any" in condition ||
    "all" in condition ||
    condition.field === "METADATA"
  )
    return false;
  const source = questions.find(
    (candidate) => candidate.id === condition.questionId,
  );
  if (source?.type !== "rating") return false;
  return followUpBranches(source).some((branch) => {
    const shortcut = branch.condition(source.id);
    return (
      !("any" in shortcut) &&
      !("all" in shortcut) &&
      shortcut.operator === condition.operator &&
      shortcut.value === condition.value
    );
  });
}

export function joinedQuestions(pages: QuestionPages) {
  return new Set(
    pages.flatMap((page) => page.slice(1).map((question) => question.id)),
  );
}

// Document operations retain page identities/headings and never rewrite conditions.
export function replaceQuestion(
  document: SurveyDocumentV1,
  question: Question,
) {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      questions: page.questions.map((item) =>
        item.id === question.id ? question : item,
      ) as SurveyPageV1["questions"],
    })) as SurveyDocumentV1["pages"],
  };
}
export function insertQuestionPage(
  document: SurveyDocumentV1,
  question: Question,
  afterPageId?: string,
) {
  const sourceIndex = document.pages.findIndex(
    (page) => page.id === afterPageId,
  );
  const index = sourceIndex >= 0 ? sourceIndex + 1 : document.pages.length;
  const page: SurveyPageV1 = {
    id: `side-${crypto.randomUUID()}`,
    questions: [question],
  };
  return {
    ...document,
    pages: [
      ...document.pages.slice(0, index),
      page,
      ...document.pages.slice(index),
    ] as SurveyDocumentV1["pages"],
  };
}
export function deleteFromDocument(
  document: SurveyDocumentV1,
  ids: Set<string>,
) {
  const pages = document.pages
    .map((page) => ({
      ...page,
      questions: page.questions.filter(
        (q) => !ids.has(q.id),
      ) as SurveyPageV1["questions"],
    }))
    .filter((page) => page.questions.length);
  // A draft always has one editable first question, including after deleting all content.
  if (!pages.length)
    pages.push({
      id: `side-${crypto.randomUUID()}`,
      questions: [
        {
          id: `text-${crypto.randomUUID()}`,
          type: "text",
          prompt: "",
          maxLength: 1000,
        },
      ],
    });
  return { ...document, pages: pages as SurveyDocumentV1["pages"] };
}
export function moveDocumentPage(
  document: SurveyDocumentV1,
  id: string,
  direction: -1 | 1,
) {
  const pages = [...document.pages];
  const index = pages.findIndex((p) => p.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= pages.length) return document;
  [pages[index], pages[target]] = [pages[target], pages[index]];
  return { ...document, pages: pages as SurveyDocumentV1["pages"] };
}
export function moveDocumentQuestion(
  document: SurveyDocumentV1,
  id: string,
  direction: -1 | 1,
) {
  const pageIndex = document.pages.findIndex((page) =>
    page.questions.some((question) => question.id === id),
  );
  if (pageIndex < 0) return document;
  const questions = [...document.pages[pageIndex].questions];
  const index = questions.findIndex((question) => question.id === id);
  const target = index + direction;
  if (target < 0 || target >= questions.length) return document;
  [questions[index], questions[target]] = [questions[target], questions[index]];
  return {
    ...document,
    pages: document.pages.map((page, currentIndex) =>
      currentIndex === pageIndex
        ? {
            ...page,
            questions: questions as SurveyPageV1["questions"],
          }
        : page,
    ) as SurveyDocumentV1["pages"],
  };
}
export function placeQuestion(
  document: SurveyDocumentV1,
  id: string,
  same: boolean,
): SurveyDocumentV1 {
  const pages = [...document.pages];
  const pi = pages.findIndex((p) => p.questions.some((q) => q.id === id));
  if (pi < 0) return document;
  const page = pages[pi];
  const qi = page.questions.findIndex((q) => q.id === id);
  const question = page.questions[qi];
  if (same) {
    if (qi > 0 || pi === 0) return document;
    if (page.questions.length === 1 && (page.title || page.description))
      throw new Error(
        "Siden har en felles overskrift eller hjelpetekst. Flytt eller fjern sideteksten i avansert redigering før du slår sammen sidene.",
      );
    pages[pi - 1] = {
      ...pages[pi - 1],
      questions: [...pages[pi - 1].questions, question],
    };
    if (page.questions.length === 1) pages.splice(pi, 1);
    else
      pages[pi] = {
        ...page,
        questions: page.questions.slice(1) as SurveyPageV1["questions"],
      };
  } else {
    if (page.questions.length === 1) return document;
    const before = page.questions.slice(0, qi);
    const after = page.questions.slice(qi + 1);
    const replacement: SurveyPageV1[] = [];
    if (before.length)
      replacement.push({
        ...page,
        questions: before as SurveyPageV1["questions"],
      });
    replacement.push({
      id: `side-${crypto.randomUUID()}`,
      questions: [question],
    });
    if (after.length)
      replacement.push({
        ...(!before.length ? page : {}),
        id: before.length ? `side-${crypto.randomUUID()}` : page.id,
        questions: after as SurveyPageV1["questions"],
      });
    pages.splice(pi, 1, ...replacement);
  }
  return { ...document, pages: pages as SurveyDocumentV1["pages"] };
}
export function isSimpleCondition(question: Question, questions: Question[]) {
  if (!question.visibleIf) return true;
  const leaves = ruleLeaves(question);
  const ids = sources(question);
  if (
    ids.length !== 1 ||
    leaves.some((leaf) => "field" in leaf && leaf.field === "METADATA")
  )
    return false;
  const source = questions.find((q) => q.id === ids[0]);
  if (leaves.length === 1 && leaves[0].operator === "EXISTS") return true;
  return Boolean(
    source &&
      "options" in source &&
      (!("all" in question.visibleIf) || leaves.length === 1) &&
      leaves.every(
        (leaf) =>
          leaf.operator ===
            (source.type === "multiChoice" ? "CONTAINS" : "EQ") &&
          typeof leaf.value === "string",
      ),
  );
}
