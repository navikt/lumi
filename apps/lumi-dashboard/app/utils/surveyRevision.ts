import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import type { SurveyAuthoringRevision } from "~/types/surveyAuthoring";

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

export function serializeSurveyDocumentJson(
  document: SurveyDocumentV1,
): string {
  return `${JSON.stringify(sortJson(document), null, 2)}\n`;
}

export function serializeSurveyDocumentTypeScript(
  document: SurveyDocumentV1,
): string {
  return [
    'import type { SurveyDocumentV1 } from "@navikt/lumi-survey";',
    "",
    `export const survey = ${JSON.stringify(sortJson(document), null, 2)} satisfies SurveyDocumentV1;`,
    "",
  ].join("\n");
}

export function createRevisionMarkdown(
  revision: SurveyAuthoringRevision,
  revisionUrl: string,
): string {
  const label = `${revision.name} – versjon ${revision.revisionNumber}`.replace(
    /([\\[\]])/g,
    "\\$1",
  );
  return `[${label}](${revisionUrl})`;
}

interface LocatedQuestion {
  pageId: string;
  questionIndex: number;
  question: SurveyQuestionV1;
}

function indexQuestions(document: SurveyDocumentV1) {
  return new Map<string, LocatedQuestion>(
    document.pages.flatMap((page) =>
      page.questions.map((question, questionIndex) => [
        question.id,
        { pageId: page.id, questionIndex, question },
      ]),
    ),
  );
}

function withoutText(question: SurveyQuestionV1) {
  const { prompt: _prompt, description: _description, ...structure } = question;
  return structure;
}

function pageText(page: SurveyPageV1) {
  return { title: page.title, description: page.description };
}

function describeScreenChange(
  changes: string[],
  current: { title: string; body?: string; startLabel?: string } | undefined,
  previous: { title: string; body?: string; startLabel?: string } | undefined,
  noun: string,
  definiteNoun: string,
): void {
  if (current && !previous) {
    changes.push(`${noun} er lagt til.`);
  } else if (!current && previous) {
    changes.push(`${noun} er fjernet.`);
  } else if (
    current &&
    previous &&
    JSON.stringify(current) !== JSON.stringify(previous)
  ) {
    changes.push(`${definiteNoun} er endret.`);
  }
}

export function describeRevisionChanges(
  current: SurveyDocumentV1,
  previous?: SurveyDocumentV1 | null,
): string[] {
  if (!previous) return ["Første delte versjon i prosjektet."];

  const changes: string[] = [];
  describeScreenChange(
    changes,
    current.intro,
    previous.intro,
    "Velkomstside",
    "Velkomstsiden",
  );
  describeScreenChange(
    changes,
    current.success,
    previous.success,
    "Bekreftelse etter innsending",
    "Bekreftelsen etter innsending",
  );
  if ((current.type ?? "custom") !== (previous.type ?? "custom")) {
    changes.push(
      `Surveytype er endret fra ${previous.type ?? "custom"} til ${current.type ?? "custom"}.`,
    );
  }

  const currentPages = new Map(current.pages.map((page) => [page.id, page]));
  const previousPages = new Map(previous.pages.map((page) => [page.id, page]));
  const addedPages = current.pages.filter(
    (page) => !previousPages.has(page.id),
  );
  const removedPages = previous.pages.filter(
    (page) => !currentPages.has(page.id),
  );
  if (addedPages.length > 0)
    changes.push(`${addedPages.length} side(r) er lagt til.`);
  if (removedPages.length > 0)
    changes.push(`${removedPages.length} side(r) er fjernet.`);

  const currentOrder = current.pages.map((page) => page.id).join("|");
  const previousOrder = previous.pages.map((page) => page.id).join("|");
  if (
    currentOrder !== previousOrder &&
    addedPages.length === 0 &&
    removedPages.length === 0
  ) {
    changes.push("Rekkefølgen på sidene er endret.");
  }

  const changedPageText = current.pages.filter((page) => {
    const previousPage = previousPages.get(page.id);
    return (
      previousPage &&
      JSON.stringify(pageText(page)) !== JSON.stringify(pageText(previousPage))
    );
  });
  if (changedPageText.length > 0) {
    changes.push(
      `Tittel eller beskrivelse er endret på ${changedPageText.length} side(r).`,
    );
  }

  const currentQuestions = indexQuestions(current);
  const previousQuestions = indexQuestions(previous);
  const addedQuestions = [...currentQuestions.keys()].filter(
    (id) => !previousQuestions.has(id),
  );
  const removedQuestions = [...previousQuestions.keys()].filter(
    (id) => !currentQuestions.has(id),
  );
  if (addedQuestions.length > 0)
    changes.push(`${addedQuestions.length} spørsmål er lagt til.`);
  if (removedQuestions.length > 0)
    changes.push(`${removedQuestions.length} spørsmål er fjernet.`);

  let movedQuestions = 0;
  let changedQuestionText = 0;
  let changedQuestionStructure = 0;
  for (const [id, located] of currentQuestions) {
    const before = previousQuestions.get(id);
    if (!before) continue;
    if (
      before.pageId !== located.pageId ||
      before.questionIndex !== located.questionIndex
    ) {
      movedQuestions += 1;
    }
    if (
      before.question.prompt !== located.question.prompt ||
      before.question.description !== located.question.description
    ) {
      changedQuestionText += 1;
    }
    if (
      JSON.stringify(withoutText(before.question)) !==
      JSON.stringify(withoutText(located.question))
    ) {
      changedQuestionStructure += 1;
    }
  }
  if (movedQuestions > 0)
    changes.push(`${movedQuestions} spørsmål er flyttet.`);
  if (changedQuestionText > 0)
    changes.push(`Teksten er endret i ${changedQuestionText} spørsmål.`);
  if (changedQuestionStructure > 0)
    changes.push(
      `Innstillinger er endret i ${changedQuestionStructure} spørsmål.`,
    );

  return changes.length > 0
    ? changes
    : ["Ingen semantiske endringer oppdaget."];
}

export function analyticalStructure(document: SurveyDocumentV1): string {
  return JSON.stringify({
    type: document.type ?? "custom",
    fields: document.pages
      .flatMap((page) =>
        page.questions.map((question) => ({
          id: question.id,
          type: question.type,
          variant:
            question.type === "rating"
              ? (question.variant ?? "emoji")
              : undefined,
          options:
            "options" in question
              ? question.options.map((option) => option.value)
              : undefined,
          maxSelections:
            question.type === "multiChoice"
              ? question.maxSelections
              : undefined,
        })),
      )
      .sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
      ),
  });
}
