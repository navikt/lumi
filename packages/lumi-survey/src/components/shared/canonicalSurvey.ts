import {
  allowedVisibleIfOperators,
  getLeafConditions,
  isConditionGroup,
  isLeafCondition,
} from "../../core/conditionUtils.js";
import type { LumiSurveyQuestion } from "../../core/types.js";
import type {
  LumiSurveyDefinition,
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyType,
} from "../surveyTypes.js";

export const RATING_ANSWER_KEY = "svar";
export const MAIN_ANSWER_KEY = "feedback";

export interface CanonicalSurvey {
  source: "legacy" | "document-v1";
  type: SurveyType;
  questions: LumiSurveyQuestion[];
  pages: CanonicalSurveyPage[];
}

export interface CanonicalSurveyPage {
  id: string;
  title?: string;
  description?: string;
  questions: LumiSurveyQuestion[];
}

export function buildCanonicalSurvey(
  survey: LumiSurveyDefinition,
): CanonicalSurvey {
  const isDocument = "authoringSchemaVersion" in survey;

  if (isDocument && survey.authoringSchemaVersion !== 1) {
    throw new Error(
      `Lumi: Unsupported authoringSchemaVersion "${String(survey.authoringSchemaVersion)}"`,
    );
  }

  const inputPages: Array<{
    id: string;
    title?: string;
    description?: string;
    questions: readonly LumiSurveyQuestion[];
  }> = isDocument
    ? validateDocumentPages(survey.pages)
    : validateLegacyQuestions(survey.questions);

  const inputQuestions = inputPages.flatMap((page) => page.questions);

  const surveyType = survey.type ?? "custom";
  if (
    isDocument &&
    !["rating", "topTasks", "discovery", "taskPriority", "custom"].includes(
      surveyType,
    )
  ) {
    throw new Error(`Lumi: Unsupported survey type "${String(surveyType)}"`);
  }

  // Apply small UX-safe defaults at build time (without changing the external API shape).
  // For rating surveys, the first rating question is the main interaction and should be
  // required by default unless explicitly set to false.
  const questions: LumiSurveyQuestion[] = (() => {
    if (
      surveyType === "rating" &&
      inputQuestions[0]?.type === "rating" &&
      inputQuestions[0]?.required === undefined
    ) {
      const next = [...inputQuestions];
      next[0] = { ...next[0], required: true } as LumiSurveyQuestion;
      return next as LumiSurveyQuestion[];
    }

    return [...inputQuestions];
  })();

  let questionOffset = 0;
  const pages: CanonicalSurveyPage[] = inputPages.map((page) => {
    const pageQuestions = questions.slice(
      questionOffset,
      questionOffset + page.questions.length,
    );
    questionOffset += page.questions.length;
    return {
      id: page.id,
      title: page.title,
      description: page.description,
      questions: pageQuestions,
    };
  });

  // Validate all questions have IDs
  const ids = new Set<string>();
  const previousIds = new Set<string>();
  for (const question of questions) {
    if (!question.id) {
      throw new Error("Lumi: All questions must have an id");
    }

    if (ids.has(question.id)) {
      throw new Error(`Lumi: Duplicate question id "${question.id}"`);
    }

    ids.add(question.id);
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));

  // Validate cross-references in visibility and branching logic
  for (const question of questions) {
    const visibleIf = question.visibleIf;
    if (visibleIf !== undefined && visibleIf !== null) {
      if (typeof visibleIf !== "object" || Array.isArray(visibleIf)) {
        throw new Error(
          `Lumi: Question "${question.id}" has a visibleIf that is not a condition object`,
        );
      }
      if (isConditionGroup(visibleIf)) {
        if ("any" in visibleIf && "all" in visibleIf) {
          throw new Error(
            `Lumi: Question "${question.id}" has a visibleIf group with both "any" and "all" — use exactly one`,
          );
        }
        const body = "any" in visibleIf ? visibleIf.any : visibleIf.all;
        if (!Array.isArray(body)) {
          throw new Error(
            `Lumi: Question "${question.id}" has a visibleIf "any"/"all" that is not a list of conditions`,
          );
        }
        if (body.length === 0) {
          throw new Error(
            `Lumi: Question "${question.id}" has an empty visibleIf "any"/"all" group`,
          );
        }
      }
      for (const leaf of getLeafConditions(visibleIf)) {
        if (isConditionGroup(leaf)) {
          throw new Error(
            `Lumi: Question "${question.id}" has a nested visibleIf group — "any"/"all" groups may only contain leaf conditions (one level)`,
          );
        }
        if (!isLeafCondition(leaf)) {
          throw new Error(
            `Lumi: Question "${question.id}" has an invalid visibleIf condition — each leaf needs an operator (EQ/NEQ/GT/LT/CONTAINS/EXISTS)`,
          );
        }
        if (
          isDocument &&
          leaf.field !== undefined &&
          leaf.field !== "ANSWER" &&
          leaf.field !== "METADATA"
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has an unsupported visibleIf field`,
          );
        }
        if (
          isDocument &&
          leaf.field === "METADATA" &&
          (typeof leaf.key !== "string" || leaf.key.trim().length === 0)
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has a METADATA visibleIf without a key`,
          );
        }
        if (
          isDocument &&
          leaf.operator !== "EXISTS" &&
          !["string", "number", "boolean"].includes(typeof leaf.value)
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has a ${leaf.operator} visibleIf without a value`,
          );
        }
        if (
          isDocument &&
          leaf.operator === "EXISTS" &&
          leaf.value !== undefined
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has an EXISTS visibleIf with an unused value`,
          );
        }
        if (
          isDocument &&
          leaf.field !== "METADATA" &&
          (!leaf.questionId || leaf.questionId.trim().length === 0)
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has an ANSWER visibleIf without a questionId`,
          );
        }
        if (
          leaf.field !== "METADATA" &&
          leaf.questionId &&
          !ids.has(leaf.questionId)
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has visibleIf.questionId "${leaf.questionId}", but no such question exists`,
          );
        }
        if (
          isDocument &&
          leaf.field !== "METADATA" &&
          leaf.questionId &&
          !previousIds.has(leaf.questionId)
        ) {
          throw new Error(
            `Lumi: Question "${question.id}" has visibleIf.questionId "${leaf.questionId}", but version 1 survey documents may only reference earlier questions`,
          );
        }
        if (isDocument && leaf.field !== "METADATA" && leaf.questionId) {
          const referenced = questionById.get(leaf.questionId);
          const allowed = referenced
            ? allowedVisibleIfOperators(referenced.type)
            : undefined;
          if (referenced && allowed && !allowed.includes(leaf.operator)) {
            throw new Error(
              `Lumi: Question "${question.id}" has a ${leaf.operator} visibleIf against question "${leaf.questionId}" (${referenced.type}) — allowed operators for ${referenced.type} are ${allowed.join(", ")}`,
            );
          }
        }
      }
    }

    if (isDocument && question.logic !== undefined) {
      throw new Error(
        `Lumi: Question "${question.id}" uses logic, but version 1 survey documents only support visibleIf`,
      );
    }

    if (!question.logic) {
      previousIds.add(question.id);
      continue;
    }
    for (const rule of question.logic) {
      const condition = rule.condition;
      if (isConditionGroup(condition)) {
        throw new Error(
          `Lumi: Question "${question.id}" uses an any/all group in logic.condition, but logic does not support groups (use visibleIf)`,
        );
      }
      if (!isLeafCondition(condition)) {
        throw new Error(
          `Lumi: Question "${question.id}" has an invalid logic.condition — it must be a leaf with an operator (EQ/NEQ/GT/LT/CONTAINS/EXISTS)`,
        );
      }
      if (condition.field !== "METADATA") {
        const referencedId = condition.questionId;
        if (referencedId && !ids.has(referencedId)) {
          throw new Error(
            `Lumi: Question "${question.id}" has logic.condition.questionId "${referencedId}", but no such question exists`,
          );
        }
      }

      if (rule.action.type === "JUMP_TO" && !ids.has(rule.action.targetId)) {
        throw new Error(
          `Lumi: Question "${question.id}" has logic.action.targetId "${rule.action.targetId}", but no such question exists`,
        );
      }
    }
    previousIds.add(question.id);
  }

  return {
    source: isDocument ? "document-v1" : "legacy",
    type: surveyType,
    questions,
    pages,
  };
}

/**
 * Validate an unknown authoring payload against the public V1 document
 * contract. Returns the original JSON-compatible document when valid.
 *
 * Authoring tools can use this before preview/export without duplicating the
 * widget's runtime validation rules.
 */
export function validateSurveyDocumentV1(input: unknown): SurveyDocumentV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Lumi: Survey document must be an object");
  }

  const document = input as Record<string, unknown>;
  if (document.authoringSchemaVersion !== 1) {
    throw new Error("Lumi: Survey document must use authoringSchemaVersion 1");
  }

  validateOptionalScreen(document.intro, "intro", [
    "title",
    "body",
    "startLabel",
  ]);
  validateOptionalScreen(document.success, "success", ["title", "body"]);

  buildCanonicalSurvey(input as SurveyDocumentV1);
  return input as SurveyDocumentV1;
}

/**
 * Intro/success screens are plain string content; the title may be blank in
 * drafts (release gates enforce non-blank), but every present field must be
 * a string and the section itself an object.
 */
function validateOptionalScreen(
  value: unknown,
  name: string,
  stringFields: readonly string[],
): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Lumi: Survey document ${name} must be an object`);
  }
  const section = value as Record<string, unknown>;
  if (typeof section.title !== "string") {
    throw new Error(`Lumi: Survey document ${name} needs a string title`);
  }
  for (const field of stringFields) {
    const fieldValue = section[field];
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new Error(
        `Lumi: Survey document ${name} field '${field}' must be a string`,
      );
    }
  }
}

function validateLegacyQuestions(
  questions: LumiSurveyQuestion[] | undefined,
): CanonicalSurveyPage[] {
  if (!questions || questions.length === 0) {
    throw new Error("Lumi survey must have at least one question");
  }

  return questions.map((question) => ({
    id: `legacy-page:${question.id}`,
    questions: [question],
  }));
}

function validateDocumentPages(
  pages: readonly SurveyPageV1[] | undefined,
): CanonicalSurveyPage[] {
  if (!pages || pages.length === 0) {
    throw new Error("Lumi: Survey document must have at least one page");
  }

  const pageIds = new Set<string>();
  return pages.map((page, index) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) {
      throw new Error(`Lumi: Page at index ${index} is not a page object`);
    }
    if (typeof page.id !== "string" || page.id.trim().length === 0) {
      throw new Error("Lumi: All pages must have an id");
    }
    if (page.title !== undefined && typeof page.title !== "string") {
      throw new Error(`Lumi: Page "${page.id}" has a non-string title`);
    }
    if (
      page.description !== undefined &&
      typeof page.description !== "string"
    ) {
      throw new Error(`Lumi: Page "${page.id}" has a non-string description`);
    }
    if (pageIds.has(page.id)) {
      throw new Error(`Lumi: Duplicate page id "${page.id}"`);
    }
    if (!Array.isArray(page.questions) || page.questions.length === 0) {
      throw new Error(
        `Lumi: Page "${page.id}" must have at least one question`,
      );
    }
    const questions = (page.questions as readonly unknown[]).map(
      (question, questionIndex) =>
        validateDocumentQuestion(question, page.id, questionIndex),
    );
    pageIds.add(page.id);
    return {
      id: page.id,
      title: page.title,
      description: page.description,
      questions,
    };
  });
}

function validateDocumentQuestion(
  question: unknown,
  pageId: string,
  questionIndex: number,
): LumiSurveyQuestion {
  if (!question || typeof question !== "object" || Array.isArray(question)) {
    throw new Error(
      `Lumi: Question at index ${questionIndex} on page "${pageId}" is not a question object`,
    );
  }

  const candidate = question as Record<string, unknown>;
  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
    throw new Error(`Lumi: All questions on page "${pageId}" need an id`);
  }
  if (typeof candidate.prompt !== "string") {
    throw new Error(
      `Lumi: Question "${candidate.id}" on page "${pageId}" has a non-string prompt`,
    );
  }
  if (
    candidate.description !== undefined &&
    typeof candidate.description !== "string"
  ) {
    throw new Error(
      `Lumi: Question "${candidate.id}" on page "${pageId}" has a non-string description`,
    );
  }
  if (
    candidate.required !== undefined &&
    typeof candidate.required !== "boolean"
  ) {
    throw new Error(
      `Lumi: Question "${candidate.id}" on page "${pageId}" has a non-boolean required value`,
    );
  }
  if (
    candidate.analyticsId !== undefined &&
    typeof candidate.analyticsId !== "string"
  ) {
    throw new Error(
      `Lumi: Question "${candidate.id}" on page "${pageId}" has a non-string analyticsId`,
    );
  }
  if (
    !["rating", "text", "singleChoice", "multiChoice"].includes(
      String(candidate.type),
    )
  ) {
    throw new Error(
      `Lumi: Question "${candidate.id}" on page "${pageId}" has an unsupported type`,
    );
  }

  if (candidate.type === "rating") {
    const variant = candidate.variant ?? "emoji";
    if (!["emoji", "thumbs", "stars", "nps"].includes(String(variant))) {
      throw new Error(
        `Lumi: Rating question "${candidate.id}" has an unsupported variant`,
      );
    }
    if (
      candidate.labels !== undefined &&
      (!Array.isArray(candidate.labels) ||
        candidate.labels.some(
          (label) =>
            !label ||
            typeof label !== "object" ||
            typeof (label as Record<string, unknown>).value !== "number" ||
            !Number.isFinite(
              (label as Record<string, unknown>).value as number,
            ) ||
            typeof (label as Record<string, unknown>).label !== "string",
        ))
    ) {
      throw new Error(
        `Lumi: Rating question "${candidate.id}" has invalid labels`,
      );
    }
    for (const labelKey of ["lowLabel", "highLabel"] as const) {
      if (
        candidate[labelKey] !== undefined &&
        typeof candidate[labelKey] !== "string"
      ) {
        throw new Error(
          `Lumi: Rating question "${candidate.id}" has a non-string ${labelKey}`,
        );
      }
    }
  }

  if (candidate.type === "text") {
    for (const numberKey of ["maxLength", "minRows"] as const) {
      const value = candidate[numberKey];
      if (
        value !== undefined &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value <= 0 ||
          (numberKey === "maxLength" && !Number.isInteger(value)))
      ) {
        throw new Error(
          `Lumi: Text question "${candidate.id}" has an invalid ${numberKey}`,
        );
      }
    }
    for (const stringKey of ["placeholder", "autoComplete"] as const) {
      if (
        candidate[stringKey] !== undefined &&
        typeof candidate[stringKey] !== "string"
      ) {
        throw new Error(
          `Lumi: Text question "${candidate.id}" has a non-string ${stringKey}`,
        );
      }
    }
  }

  if (candidate.type === "singleChoice" || candidate.type === "multiChoice") {
    if (
      !Array.isArray(candidate.options) ||
      candidate.options.length === 0 ||
      candidate.options.some(
        (option) =>
          !option ||
          typeof option !== "object" ||
          typeof (option as Record<string, unknown>).value !== "string" ||
          typeof (option as Record<string, unknown>).label !== "string" ||
          ((option as Record<string, unknown>).description !== undefined &&
            typeof (option as Record<string, unknown>).description !==
              "string"),
      )
    ) {
      throw new Error(
        `Lumi: Choice question "${candidate.id}" must have valid options`,
      );
    }
    const optionIds = new Set(
      candidate.options.map(
        (option) => (option as Record<string, unknown>).value,
      ),
    );
    if (optionIds.size !== candidate.options.length) {
      throw new Error(
        `Lumi: Choice question "${candidate.id}" has duplicate option values`,
      );
    }
    if (
      candidate.randomize !== undefined &&
      typeof candidate.randomize !== "boolean"
    ) {
      throw new Error(
        `Lumi: Choice question "${candidate.id}" has a non-boolean randomize value`,
      );
    }
    if (
      candidate.variant !== undefined &&
      !["checkbox", "combobox"].includes(String(candidate.variant))
    ) {
      throw new Error(
        `Lumi: Choice question "${candidate.id}" has an unsupported variant`,
      );
    }
    if (
      candidate.maxSelections !== undefined &&
      (typeof candidate.maxSelections !== "number" ||
        !Number.isInteger(candidate.maxSelections) ||
        candidate.maxSelections <= 0 ||
        candidate.maxSelections > candidate.options.length)
    ) {
      throw new Error(
        `Lumi: Choice question "${candidate.id}" has an invalid maxSelections`,
      );
    }
  }

  return question as LumiSurveyQuestion;
}
