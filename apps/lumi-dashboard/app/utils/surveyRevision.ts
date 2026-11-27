import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import type {
  SurveyAuthoringRevision,
  SurveyDisplayMode,
  SurveyPresentation,
} from "~/types/surveyAuthoring";
import {
  MIN_WIDGET_VERSION_FOR_ENDPOINT_TRANSPORT,
  MIN_WIDGET_VERSION_FOR_INLINE,
  suggestSurveyId,
} from "~/utils/surveyDocument";

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

/**
 * The widget component for a display mode, and the lowest widget version the
 * embed example runs on.
 */
export const DISPLAY_MODE_COMPONENTS: Record<
  SurveyDisplayMode,
  { component: string; minWidgetVersion: string }
> = {
  dock: {
    component: "LumiSurveyDock",
    // The document format is older, but the example sends the answers with
    // `transport={{ endpoint }}`.
    minWidgetVersion: MIN_WIDGET_VERSION_FOR_ENDPOINT_TRANSPORT,
  },
  inline: {
    component: "LumiSurveyInline",
    minWidgetVersion: MIN_WIDGET_VERSION_FOR_INLINE,
  },
};

/**
 * A JSX attribute value. A quoted attribute decodes entities such as `&amp;`
 * and cannot hold a quote or a line break, so only plain text is quoted.
 * Everything else is written as an expression.
 */
function jsxString(value: string): string {
  return /^[\p{L}\p{N} ._:/-]*$/u.test(value)
    ? `"${value}"`
    : `{${JSON.stringify(value)}}`;
}

// Lumi API rejects a submission with a tag value over 100 characters, and a
// name for a place is shorter than the sentence it is made from.
const MAX_PLACEMENT_TAG_LENGTH = 60;

/** A short, fixed name for the place, made from the author's note. */
function placementTagFrom(note: string): string {
  const slug = suggestSurveyId(note);
  if (slug.length <= MAX_PLACEMENT_TAG_LENGTH) return slug;
  const cut = slug.slice(0, MAX_PLACEMENT_TAG_LENGTH);
  if (slug[MAX_PLACEMENT_TAG_LENGTH] === "-") return cut;
  // Stop at a whole word when there is one to stop at.
  const lastWord = cut.lastIndexOf("-");
  return lastWord > 0 ? cut.slice(0, lastWord) : cut;
}

/**
 * The tags the embed example sets on a survey at the content. The previews
 * set the same ones, so a question that is shown by a tag is shown there too.
 */
export function inlineContextTags(
  presentation: SurveyPresentation,
): Record<string, string> {
  const note = presentation.placementNote?.trim();
  const placement = note ? placementTagFrom(note) : "";
  return { surface: "inline", ...(placement ? { placement } : {}) };
}

/**
 * The context tags a preview gives the widget: its environment, and at the
 * content the tags of the embed example. The editor evaluates the conditions
 * of its live view with the same tags.
 */
export function previewContextTags(
  environment: string,
  presentation: SurveyPresentation,
): Record<string, string> {
  return {
    environment,
    ...(presentation.mode === "inline" ? inlineContextTags(presentation) : {}),
  };
}

/**
 * The component the developer puts in the app, for the display mode the
 * author chose. It is an example to start from: the document is imported from
 * the exported file, and the developer still decides where the survey stands
 * and where the answers are sent.
 */
export function serializeSurveyEmbedExample({
  surveyId,
  presentation,
}: {
  surveyId: string;
  presentation: SurveyPresentation;
}): string {
  const { component, minWidgetVersion } =
    DISPLAY_MODE_COMPONENTS[presentation.mode];
  const placementNote = presentation.placementNote?.trim();
  // The tag tells the places apart in the analysis, so it is a short, fixed
  // name made from the note, not the note itself.
  const tags = Object.entries(inlineContextTags(presentation))
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");

  // The client entry also works in a server component in the Next.js App
  // Router. TypeScript finds its types with "bundler" and "node16", not with
  // the older "node" resolution.
  return [
    `// Krever @navikt/lumi-survey ${minWidgetVersion} eller nyere.`,
    '// Med "moduleResolution": "node" i tsconfig: importer fra "@navikt/lumi-survey" i en fil med "use client" øverst.',
    '// Med "node16" eller "nodenext" i et ESM-prosjekt: importer fra "./survey.js".',
    `import { ${component} } from "@navikt/lumi-survey/client";`,
    'import { survey } from "./survey";',
    "",
    "export function Tilbakemelding() {",
    "  return (",
    ...(presentation.mode === "inline" && placementNote
      ? [`    // Plassering: ${placementNote.replace(/\s+/g, " ")}`]
      : []),
    `    <${component}`,
    `      surveyId=${jsxString(surveyId)}`,
    "      survey={survey}",
    '      transport={{ endpoint: "/api/lumi/feedback" }}',
    ...(presentation.mode === "inline"
      ? [`      context={{ tags: { ${tags} } }}`]
      : []),
    "    />",
    "  );",
    "}",
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

const DISPLAY_MODE_NAMES: Record<SurveyDisplayMode, string> = {
  dock: "Flytende panel",
  inline: "Ved innholdet",
};

/**
 * The presentation is stored beside the document, so a version can move the
 * survey without changing a single question.
 */
function describePresentationChange(
  changes: string[],
  current: SurveyPresentation,
  previous: SurveyPresentation,
) {
  if (current.mode !== previous.mode) {
    changes.push(
      `Visningen er endret fra «${DISPLAY_MODE_NAMES[previous.mode]}» til «${DISPLAY_MODE_NAMES[current.mode]}».`,
    );
  }
  const note = current.placementNote?.trim() ?? "";
  const previousNote = previous.placementNote?.trim() ?? "";
  if (note === previousNote) return;
  if (!previousNote) {
    changes.push(`Plasseringsbeskrivelsen «${note}» er lagt til.`);
  } else if (!note) {
    changes.push(`Plasseringsbeskrivelsen «${previousNote}» er fjernet.`);
  } else {
    changes.push(
      `Plasseringsbeskrivelsen er endret fra «${previousNote}» til «${note}».`,
    );
  }
}

/** What a shared version holds that the next one can differ in. */
export type RevisionContent = Pick<
  SurveyAuthoringRevision,
  "document" | "presentation" | "presentationUnknown"
>;

export function describeRevisionChanges(
  currentRevision: RevisionContent,
  previousRevision?: RevisionContent | null,
): string[] {
  if (!previousRevision) return ["Første delte versjon i prosjektet."];
  const current = currentRevision.document;
  const previous = previousRevision.document;

  const changes: string[] = [];
  // An API from before the display choice existed does not say which one a
  // version has, so the display cannot be compared.
  const presentationCompared =
    !currentRevision.presentationUnknown &&
    !previousRevision.presentationUnknown;
  if (presentationCompared) {
    describePresentationChange(
      changes,
      currentRevision.presentation,
      previousRevision.presentation,
    );
  }
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

  // Compared one by one: an id can hold any character, also one that would
  // join two ids into the same text.
  const currentOrder = current.pages.map((page) => page.id);
  const previousOrder = previous.pages.map((page) => page.id);
  if (
    (currentOrder.length !== previousOrder.length ||
      currentOrder.some((id, index) => id !== previousOrder[index])) &&
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

  if (!presentationCompared) {
    return changes.length > 0
      ? [...changes, PRESENTATION_NOT_COMPARED]
      : [`Ingen endringer i surveydokumentet. ${PRESENTATION_NOT_COMPARED}`];
  }
  return changes.length > 0
    ? changes
    : ["Ingen semantiske endringer oppdaget."];
}

const PRESENTATION_NOT_COMPARED =
  "Visningen kunne ikke hentes, så den er ikke sammenlignet.";

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
