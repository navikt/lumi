import {
  createDiscoverySurveyDocument,
  createTaskPrioritySurveyDocument,
  createTopTasksSurveyDocument,
  type SurveyDocumentV1,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import {
  addOption,
  addPage,
  addQuestion,
  allowedConditionOperators,
  buildVisibleIf,
  changeQuestionType,
  commitOptionLabel,
  conditionCombinator,
  conditionValueSuggestions,
  createQuestion,
  documentNeedsWideDock,
  duplicatePage,
  duplicateQuestion,
  findHandoffIssues,
  insertPageAt,
  insertQuestionAt,
  isRequiredSpecializedQuestion,
  isSpecializedQuestionContractValid,
  listReferenceableQuestions,
  locateQuestion,
  moveOption,
  movePage,
  movePageToIndex,
  moveQuestion,
  moveQuestionToIndex,
  moveQuestionToPage,
  removeOption,
  removePage,
  removeQuestion,
  repairSpecializedSurveyDocument,
  SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
  setQuestionVisibleIf,
  setSurveyIntro,
  setSurveySuccess,
  slugifyOptionValue,
  suggestSurveyId,
  updateOptionLabel,
  updateOptionValue,
  visibleIfLeaves,
} from "~/utils/surveyDocument";

function sequentialIds(prefix = "id") {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

function makeDocument(): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: "rating",
    pages: [
      {
        id: "side-a",
        title: "Første side",
        questions: [
          {
            id: "rating-1",
            type: "rating",
            prompt: "Hvordan opplevde du tjenesten?",
            variant: "emoji",
            required: true,
          },
          {
            id: "text-1",
            type: "text",
            prompt: "Hva kan vi gjøre bedre?",
            maxLength: 1000,
            minRows: 4,
          },
        ],
      },
      {
        id: "side-b",
        title: "Andre side",
        questions: [
          {
            id: "choice-1",
            type: "singleChoice",
            prompt: "Hva kom du for å gjøre?",
            options: [
              { value: "soke", label: "Søke" },
              { value: "sjekke-status", label: "Sjekke status" },
            ],
          },
        ],
      },
    ],
  };
}

describe("createQuestion", () => {
  it("creates a rating question with emoji defaults", () => {
    const question = createQuestion("rating", sequentialIds());
    expect(question).toMatchObject({
      id: "rating-id-1",
      type: "rating",
      variant: "emoji",
      required: true,
    });
    expect(question.prompt.length).toBeGreaterThan(0);
  });

  it("creates a text question with length limits", () => {
    const question = createQuestion("text", sequentialIds());
    expect(question).toMatchObject({
      id: "text-id-1",
      type: "text",
      maxLength: 1000,
      minRows: 4,
    });
  });

  it("seeds singleChoice with two valid unique options", () => {
    const question = createQuestion("singleChoice", sequentialIds());
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options).toEqual([
      { value: "alternativ-1", label: "Alternativ 1" },
      { value: "alternativ-2", label: "Alternativ 2" },
    ]);
  });

  it("seeds multiChoice with two valid unique options", () => {
    const question = createQuestion("multiChoice", sequentialIds());
    if (question.type !== "multiChoice") throw new Error("wrong type");
    expect(question.options).toHaveLength(2);
    expect(new Set(question.options.map((option) => option.value)).size).toBe(
      2,
    );
  });
});

describe("suggestSurveyId", () => {
  it("slugifies a draft name to a survey id", () => {
    expect(suggestSurveyId("Kvitteringsside høst 2026")).toBe(
      "kvitteringsside-host-2026",
    );
  });

  it("returns empty string for empty names", () => {
    expect(suggestSurveyId("   ")).toBe("");
  });
});

describe("slugifyOptionValue", () => {
  it("slugifies labels to kebab-case", () => {
    expect(slugifyOptionValue("Sjekke Status", [])).toBe("sjekke-status");
    expect(slugifyOptionValue("  Mye   mellomrom  ", [])).toBe("mye-mellomrom");
    expect(slugifyOptionValue("Punktum. Og, komma!", [])).toBe(
      "punktum-og-komma",
    );
  });

  it("transliterates æ, ø and å", () => {
    expect(slugifyOptionValue("Svært fornøyd", [])).toBe("svaert-fornoyd");
    expect(slugifyOptionValue("Grønnsaker på lager", [])).toBe(
      "gronnsaker-pa-lager",
    );
  });

  it("falls back to alternativ-N for empty labels", () => {
    expect(slugifyOptionValue("", [])).toBe("alternativ-1");
    expect(slugifyOptionValue("   ", ["alternativ-1"])).toBe("alternativ-2");
  });

  it("adds numeric suffix on collision", () => {
    expect(slugifyOptionValue("Ja", ["ja"])).toBe("ja-2");
    expect(slugifyOptionValue("Ja", ["ja", "ja-2"])).toBe("ja-3");
  });
});

describe("addQuestion", () => {
  it("appends a question of the given type to the page", () => {
    const document = makeDocument();
    const next = addQuestion(
      document,
      "side-a",
      "multiChoice",
      sequentialIds(),
    );
    expect(next.pages[0].questions).toHaveLength(3);
    expect(next.pages[0].questions[2].type).toBe("multiChoice");
    expect(document.pages[0].questions).toHaveLength(2);
  });
});

describe("removeQuestion", () => {
  it("removes the question from its page", () => {
    const document = makeDocument();
    const next = removeQuestion(document, "side-a", "text-1");
    expect(next.pages[0].questions.map((question) => question.id)).toEqual([
      "rating-1",
    ]);
  });

  it("returns the same document when removing the last question on a page", () => {
    const document = makeDocument();
    const next = removeQuestion(document, "side-b", "choice-1");
    expect(next).toBe(document);
  });
});

describe("duplicateQuestion", () => {
  it("inserts a copy right after the original with a new id", () => {
    const document = makeDocument();
    const next = duplicateQuestion(
      document,
      "side-b",
      "choice-1",
      sequentialIds(),
    );
    const questions = next.pages[1].questions;
    expect(questions).toHaveLength(2);
    expect(questions[1].id).toBe("singleChoice-id-1");
    expect(questions[1]).toMatchObject({
      type: "singleChoice",
      prompt: "Hva kom du for å gjøre?",
    });
    if (questions[1].type !== "singleChoice") throw new Error("wrong type");
    expect(questions[1].options).toEqual([
      { value: "soke", label: "Søke" },
      { value: "sjekke-status", label: "Sjekke status" },
    ]);
  });
});

describe("moveQuestion", () => {
  it("moves a question down within its page", () => {
    const document = makeDocument();
    const next = moveQuestion(document, "side-a", "rating-1", "down");
    expect(next.pages[0].questions.map((question) => question.id)).toEqual([
      "text-1",
      "rating-1",
    ]);
  });

  it("returns the same document when moving past a boundary", () => {
    const document = makeDocument();
    expect(moveQuestion(document, "side-a", "rating-1", "up")).toBe(document);
    expect(moveQuestion(document, "side-a", "text-1", "down")).toBe(document);
  });
});

describe("moveQuestionToPage", () => {
  it("moves the question to the end of the target page", () => {
    const document = makeDocument();
    const next = moveQuestionToPage(document, "side-a", "text-1", "side-b");
    expect(next.pages[0].questions.map((question) => question.id)).toEqual([
      "rating-1",
    ]);
    expect(next.pages[1].questions.map((question) => question.id)).toEqual([
      "choice-1",
      "text-1",
    ]);
  });

  it("returns the same document when the move would empty the source page", () => {
    const document = makeDocument();
    const next = moveQuestionToPage(document, "side-b", "choice-1", "side-a");
    expect(next).toBe(document);
  });
});

describe("changeQuestionType", () => {
  it("preserves id, prompt, description and required", () => {
    const document = makeDocument();
    const next = changeQuestionType(
      document,
      "side-a",
      "rating-1",
      "text",
      sequentialIds(),
    );
    expect(next.pages[0].questions[0]).toMatchObject({
      id: "rating-1",
      type: "text",
      prompt: "Hvordan opplevde du tjenesten?",
      required: true,
    });
  });

  it("drops fields that belong to the previous type", () => {
    const document = makeDocument();
    const next = changeQuestionType(
      document,
      "side-a",
      "rating-1",
      "text",
      sequentialIds(),
    );
    expect("variant" in next.pages[0].questions[0]).toBe(false);
  });

  it("preserves visibleIf and analyticsId across type changes", () => {
    const document = makeDocument();
    document.pages[0].questions[1] = {
      ...document.pages[0].questions[1],
      analyticsId: "forbedring",
      visibleIf: { questionId: "rating-1", operator: "EXISTS" },
    };
    const next = changeQuestionType(
      document,
      "side-a",
      "text-1",
      "singleChoice",
      sequentialIds(),
    );
    expect(next.pages[0].questions[1]).toMatchObject({
      id: "text-1",
      type: "singleChoice",
      analyticsId: "forbedring",
      visibleIf: { questionId: "rating-1", operator: "EXISTS" },
    });
  });

  it("seeds options when switching to a choice type", () => {
    const document = makeDocument();
    const next = changeQuestionType(
      document,
      "side-a",
      "text-1",
      "singleChoice",
      sequentialIds(),
    );
    const question = next.pages[0].questions[1];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options).toHaveLength(2);
    expect(question.id).toBe("text-1");
  });
});

describe("addPage", () => {
  it("appends a page with a seeded rating question and returns its id", () => {
    const document = makeDocument();
    const { document: next, pageId } = addPage(document, sequentialIds());
    expect(pageId).toBe("side-id-1");
    expect(next.pages).toHaveLength(3);
    expect(next.pages[2].id).toBe(pageId);
    expect(next.pages[2].questions).toHaveLength(1);
    expect(next.pages[2].questions[0].type).toBe("rating");
    // A page title is a group heading, not a default: seeding one puts a
    // heading in the widget that competes with the question below it.
    expect(next.pages[2].title).toBeUndefined();
  });
});

describe("removePage", () => {
  it("removes the page", () => {
    const document = makeDocument();
    const next = removePage(document, "side-a");
    expect(next.pages.map((page) => page.id)).toEqual(["side-b"]);
  });

  it("returns the same document when removing the last page", () => {
    const document = makeDocument();
    const single = removePage(document, "side-a");
    expect(removePage(single, "side-b")).toBe(single);
  });
});

describe("duplicatePage", () => {
  it("inserts a copy after the original with new page and question ids", () => {
    const document = makeDocument();
    const next = duplicatePage(document, "side-a", sequentialIds());
    expect(next.pages.map((page) => page.id)).toEqual([
      "side-a",
      "side-id-3",
      "side-b",
    ]);
    const copy = next.pages[1];
    expect(copy.title).toBe("Første side");
    expect(copy.questions.map((question) => question.id)).toEqual([
      "rating-id-1",
      "text-id-2",
    ]);
    expect(copy.questions[0]).toMatchObject({ type: "rating" });
  });
});

describe("movePageToIndex", () => {
  it("moves a page to the given position", () => {
    const document = makeDocument();
    const next = movePageToIndex(document, "side-b", 0);
    expect(next.pages.map((page) => page.id)).toEqual(["side-b", "side-a"]);
  });

  it("returns the same document for same position or unknown page", () => {
    const document = makeDocument();
    expect(movePageToIndex(document, "side-a", 0)).toBe(document);
    expect(movePageToIndex(document, "finnes-ikke", 1)).toBe(document);
  });

  it("clamps the target index to the page list", () => {
    const document = makeDocument();
    const next = movePageToIndex(document, "side-a", 99);
    expect(next.pages.map((page) => page.id)).toEqual(["side-b", "side-a"]);
  });
});

describe("moveQuestionToIndex", () => {
  it("moves a question to the given position within its page", () => {
    const document = makeDocument();
    const next = moveQuestionToIndex(document, "side-a", "text-1", 0);
    expect(next.pages[0].questions.map((question) => question.id)).toEqual([
      "text-1",
      "rating-1",
    ]);
  });

  it("returns the same document for same position or unknown question", () => {
    const document = makeDocument();
    expect(moveQuestionToIndex(document, "side-a", "rating-1", 0)).toBe(
      document,
    );
    expect(moveQuestionToIndex(document, "side-a", "finnes-ikke", 1)).toBe(
      document,
    );
  });
});

describe("duplicatePage condition remapping", () => {
  it("rewrites internal references to the copied questions", () => {
    const document = makeDocument();
    document.pages[0].questions[1] = {
      ...document.pages[0].questions[1],
      visibleIf: { questionId: "rating-1", operator: "EXISTS" },
    };
    const next = duplicatePage(document, "side-a", sequentialIds());
    const copy = next.pages[1];
    const [copiedRating, copiedText] = copy.questions;
    expect(copiedText.visibleIf).toEqual({
      questionId: copiedRating.id,
      operator: "EXISTS",
    });
  });

  it("rewrites references inside groups but keeps external references", () => {
    const document = makeDocument();
    document.pages[1].questions[0] = {
      ...document.pages[1].questions[0],
      visibleIf: {
        all: [
          { questionId: "rating-1", operator: "EXISTS" },
          { questionId: "choice-1", operator: "EXISTS" },
        ],
      },
    };
    const next = duplicatePage(document, "side-b", sequentialIds());
    const copy = next.pages[2];
    const condition = copy.questions[0].visibleIf;
    if (!condition || !("all" in condition)) throw new Error("missing group");
    // choice-1 lives on the copied page → remapped; rating-1 is external → kept.
    expect(condition.all[0]).toEqual({
      questionId: "rating-1",
      operator: "EXISTS",
    });
    const internal = condition.all[1];
    if (!("questionId" in internal)) throw new Error("expected answer leaf");
    expect(internal.questionId).toBe(copy.questions[0].id);
  });
});

describe("duplicatePage target discrimination", () => {
  it("remaps an explicit ANSWER leaf even when it carries a stray metadata key", () => {
    // Runtime and API discriminate on `field`, so this leaf is ANSWER
    // semantics — a stray `key` must not make the builder treat it as
    // METADATA and skip the remap.
    const document = makeDocument();
    const stray = {
      field: "ANSWER" as const,
      questionId: "rating-1",
      key: "ekstra-felt",
      operator: "EXISTS" as const,
    };
    document.pages[0].questions[1] = {
      ...document.pages[0].questions[1],
      visibleIf: stray,
    };
    const next = duplicatePage(document, "side-a", sequentialIds());
    const copy = next.pages[1];
    const condition = copy.questions[1].visibleIf;
    if (!condition || !("questionId" in condition)) {
      throw new Error("expected answer leaf");
    }
    expect(condition.questionId).toBe(copy.questions[0].id);
  });
});

describe("movePage", () => {
  it("moves a page down", () => {
    const document = makeDocument();
    const next = movePage(document, "side-a", "down");
    expect(next.pages.map((page) => page.id)).toEqual(["side-b", "side-a"]);
  });

  it("returns the same document when moving past a boundary", () => {
    const document = makeDocument();
    expect(movePage(document, "side-a", "up")).toBe(document);
    expect(movePage(document, "side-b", "down")).toBe(document);
  });
});

describe("option mutations", () => {
  it("addOption appends an option with a slugged unique value", () => {
    const document = makeDocument();
    const next = addOption(document, "side-b", "choice-1", "Få hjelp");
    const question = next.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options[2]).toEqual({
      value: "fa-hjelp",
      label: "Få hjelp",
    });
  });

  it("addOption falls back to alternativ-N and uniquifies", () => {
    const document = makeDocument();
    const withEmpty = addOption(document, "side-b", "choice-1", "");
    const question = withEmpty.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options[2].value).toBe("alternativ-3");
    expect(question.options[2].label).toBe("");
  });

  it("updateOptionLabel keeps the value stable", () => {
    const document = makeDocument();
    const next = updateOptionLabel(document, "side-b", "choice-1", 0, "Søknad");
    const question = next.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options[0]).toEqual({ value: "soke", label: "Søknad" });
  });

  it("replaces a template placeholder once and then keeps the value stable", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [
        {
          value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
          label: "Bytt ut",
        },
      ],
    });
    const committed = commitOptionLabel(
      updateOptionLabel(document, "task", "task", 0, "Sende søknad"),
      "task",
      "task",
      0,
      "Sende søknad",
    );
    const renamed = commitOptionLabel(
      updateOptionLabel(committed, "task", "task", 0, "Søke digitalt"),
      "task",
      "task",
      0,
      "Søke digitalt",
    );
    const first = committed.pages[0].questions[0];
    const second = renamed.pages[0].questions[0];
    if (first.type !== "singleChoice" || second.type !== "singleChoice") {
      throw new Error("wrong type");
    }
    expect(first.options[0].value).toBe("sende-soknad");
    expect(second.options[0].value).toBe("sende-soknad");
  });

  it("does not accept the template instruction itself as a real task", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [
        {
          value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
          label: "Bytt ut med en oppgave dere vil måle",
        },
      ],
    });

    expect(
      commitOptionLabel(
        document,
        "task",
        "task",
        0,
        "Bytt ut med en oppgave dere vil måle",
      ),
    ).toBe(document);
  });

  it("accepts a real task whose wording starts with 'Bytt ut'", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [
        {
          value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
          label: "Bytt ut med en oppgave dere vil måle",
        },
      ],
    });
    const committed = commitOptionLabel(
      updateOptionLabel(document, "task", "task", 0, "Bytt ut passord"),
      "task",
      "task",
      0,
      "Bytt ut passord",
    );
    const task = committed.pages[0].questions[0];
    if (task.type !== "singleChoice") throw new Error("wrong type");
    expect(task.options[0].value).toBe("bytt-ut-passord");
  });

  it("updateOptionValue sets the value", () => {
    const document = makeDocument();
    const next = updateOptionValue(
      document,
      "side-b",
      "choice-1",
      0,
      "sok-om-stotte",
    );
    const question = next.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options[0].value).toBe("sok-om-stotte");
  });

  it("removeOption removes the option but keeps at least one", () => {
    const document = makeDocument();
    const next = removeOption(document, "side-b", "choice-1", 1);
    const question = next.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options).toHaveLength(1);
    expect(removeOption(next, "side-b", "choice-1", 0)).toBe(next);
  });

  it("moveOption reorders options", () => {
    const document = makeDocument();
    const next = moveOption(document, "side-b", "choice-1", 1, "up");
    const question = next.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    expect(question.options.map((option) => option.value)).toEqual([
      "sjekke-status",
      "soke",
    ]);
  });
});

describe("insertQuestionAt", () => {
  it("re-inserts a question at its original position", () => {
    const document = makeDocument();
    const [removed] = document.pages[0].questions;
    const without = removeQuestion(document, "side-a", "rating-1");
    const restored = insertQuestionAt(without, "side-a", removed, 0);
    expect(restored.pages[0].questions.map((question) => question.id)).toEqual([
      "rating-1",
      "text-1",
    ]);
  });

  it("clamps the index to the end of the list", () => {
    const document = makeDocument();
    const [removed] = document.pages[0].questions;
    const without = removeQuestion(document, "side-a", "rating-1");
    const restored = insertQuestionAt(without, "side-a", removed, 99);
    expect(restored.pages[0].questions.map((question) => question.id)).toEqual([
      "text-1",
      "rating-1",
    ]);
  });

  it("returns the same document when the page is gone", () => {
    const document = makeDocument();
    const [removed] = document.pages[0].questions;
    expect(insertQuestionAt(document, "finnes-ikke", removed, 0)).toBe(
      document,
    );
  });
});

describe("insertPageAt", () => {
  it("re-inserts a page at its original position", () => {
    const document = makeDocument();
    const [removed] = document.pages;
    const without = removePage(document, "side-a");
    const restored = insertPageAt(without, removed, 0);
    expect(restored.pages.map((page) => page.id)).toEqual(["side-a", "side-b"]);
  });

  it("clamps the index to the end of the list", () => {
    const document = makeDocument();
    const [removed] = document.pages;
    const without = removePage(document, "side-a");
    const restored = insertPageAt(without, removed, 99);
    expect(restored.pages.map((page) => page.id)).toEqual(["side-b", "side-a"]);
  });
});

describe("findHandoffIssues", () => {
  it("accepts a complete document", () => {
    expect(findHandoffIssues(makeDocument())).toEqual([]);
  });

  it("flags empty question prompts", () => {
    const document = makeDocument();
    document.pages[0].questions[0].prompt = "   ";
    const issues = findHandoffIssues(document);
    expect(issues).toHaveLength(1);
    expect(issues[0].questionId).toBe("rating-1");
    expect(issues[0].message).toMatch(/spørsmålstekst/i);
  });

  it("flags empty choice labels and values", () => {
    const document = makeDocument();
    const question = document.pages[1].questions[0];
    if (question.type !== "singleChoice") throw new Error("wrong type");
    question.options[0] = { value: "", label: "  " };
    const issues = findHandoffIssues(document);
    expect(
      issues.some((issue) => /alternativ 1 mangler tekst/i.test(issue.message)),
    ).toBe(true);
    expect(
      issues.some((issue) => /alternativ 1 mangler verdi/i.test(issue.message)),
    ).toBe(true);
  });

  it.each([
    createDiscoverySurveyDocument(),
    createTopTasksSurveyDocument({
      tasks: [{ value: "apply", label: "Søke" }],
    }),
    createTaskPrioritySurveyDocument({
      tasks: [
        { value: "apply", label: "Søke" },
        { value: "status", label: "Sjekke status" },
      ],
    }),
  ])("accepts a complete specialized survey contract", (document) => {
    expect(findHandoffIssues(document)).toEqual([]);
  });

  it("flags a specialized survey when a contract field is removed", () => {
    const document = createDiscoverySurveyDocument();
    document.pages = document.pages.filter(
      (page) => page.id !== "success",
    ) as SurveyDocumentV1["pages"];

    expect(findHandoffIssues(document)).toContainEqual({
      questionId: null,
      message:
        "Oppsettet «Hva kom brukeren for å gjøre?» trenger spørsmålet «success».",
    });
  });

  it("flags a specialized outcome field with incompatible choices", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [{ value: "apply", label: "Søke" }],
    });
    const success = document.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "success");
    if (!success || success.type !== "singleChoice") {
      throw new Error("missing success question");
    }
    success.options = [{ value: "done", label: "Ferdig" }];

    expect(findHandoffIssues(document)).toContainEqual({
      questionId: "success",
      message:
        "Spørsmålet «success» må ha nøyaktig svarene Ja, Delvis og Nei for oppsettet «Lyktes brukeren med en kjent oppgave?».",
    });
  });

  it("flags extra outcome choices and a repurposed blocker field", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [{ value: "apply", label: "Søke" }],
    });
    const questions = document.pages.flatMap((page) => page.questions);
    const success = questions.find((question) => question.id === "success");
    const blocker = questions.find((question) => question.id === "blocker");
    if (!success || success.type !== "singleChoice" || !blocker) {
      throw new Error("missing contract questions");
    }
    success.options.push({ value: "unknown", label: "Vet ikke" });
    Object.assign(blocker, {
      type: "singleChoice",
      options: [{ value: "other", label: "Annet" }],
    });

    expect(findHandoffIssues(document)).toEqual(
      expect.arrayContaining([
        {
          questionId: "success",
          message:
            "Spørsmålet «success» må ha nøyaktig svarene Ja, Delvis og Nei for oppsettet «Lyktes brukeren med en kjent oppgave?».",
        },
        {
          questionId: "blocker",
          message:
            "Spørsmålet «blocker» har feil type for oppsettet «Lyktes brukeren med en kjent oppgave?».",
        },
      ]),
    );
  });

  it("keeps example tasks accessible while blocking handoff", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [
        {
          value: SURVEY_TEMPLATE_PLACEHOLDER_OPTION_VALUE,
          label: "Bytt ut med en oppgave dere vil måle",
        },
      ],
    });

    expect(findHandoffIssues(document)).toContainEqual({
      questionId: "task",
      message:
        "Bytt ut eksempeloppgaven i alternativ 1 med en oppgave dere vil måle.",
    });
  });

  it("still blocks the template instruction if its technical value changed", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [
        {
          value: "manually-changed",
          label: "Bytt ut med en oppgave dere vil måle",
        },
      ],
    });
    expect(findHandoffIssues(document)).toContainEqual({
      questionId: "task",
      message:
        "Bytt ut eksempeloppgaven i alternativ 1 med en oppgave dere vil måle.",
    });
  });

  it("identifies only the fixed fields used by specialized analytics", () => {
    expect(isRequiredSpecializedQuestion("discovery", "task")).toBe(true);
    expect(isRequiredSpecializedQuestion("topTasks", "success")).toBe(true);
    expect(isRequiredSpecializedQuestion("taskPriority", "priority")).toBe(
      true,
    );
    expect(isRequiredSpecializedQuestion("topTasks", "blocker")).toBe(false);
    expect(isRequiredSpecializedQuestion("rating", "rating")).toBe(false);
  });

  it("unlocks an invalid analysis field and repairs it without removing other questions", () => {
    const document = createDiscoverySurveyDocument();
    const task = document.pages[0].questions[0];
    Object.assign(task, {
      type: "singleChoice",
      options: [{ value: "wrong", label: "Feil" }],
      required: false,
      visibleIf: { questionId: "success", operator: "EXISTS" },
    });
    document.pages[0].questions.push({
      id: "extra",
      type: "text",
      prompt: "Eget spørsmål",
    });

    expect(isSpecializedQuestionContractValid("discovery", task)).toBe(false);
    const repaired = repairSpecializedSurveyDocument(document);
    expect(findHandoffIssues(repaired)).toEqual([]);
    expect(locateQuestion(repaired, "extra")).not.toBeNull();
    const repairedTask = repaired.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "task");
    expect(repairedTask?.type).toBe("text");
    expect(repairedTask?.required).toBe(true);
    expect(repairedTask?.visibleIf).toBeUndefined();
  });

  it("restores a missing fixed field for a specialized analysis", () => {
    const document = createDiscoverySurveyDocument();
    document.pages = document.pages.filter(
      (page) => !page.questions.some((question) => question.id === "success"),
    ) as SurveyDocumentV1["pages"];
    const repaired = repairSpecializedSurveyDocument(document);
    expect(
      repaired.pages
        .flatMap((page) => page.questions)
        .find((question) => question.id === "success"),
    ).toMatchObject({ type: "singleChoice", required: true });
    expect(
      repaired.pages.flatMap((page) => page.questions).map(({ id }) => id),
    ).toEqual(["task", "success", "blocker"]);
    expect(findHandoffIssues(repaired)).toEqual([]);
  });

  it("preserves authored success option text while repairing its contract", () => {
    const document = createDiscoverySurveyDocument();
    const success = document.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "success");
    if (!success || success.type !== "singleChoice") {
      throw new Error("missing success question");
    }
    success.required = false;
    success.options[0] = {
      ...success.options[0],
      label: "Ja, helt",
      description: "Jeg fikk gjort alt",
    };

    const repaired = repairSpecializedSurveyDocument(document);
    const repairedSuccess = repaired.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "success");
    if (!repairedSuccess || repairedSuccess.type !== "singleChoice") {
      throw new Error("missing repaired success question");
    }
    expect(repairedSuccess.required).toBe(true);
    expect(
      repairedSuccess.options.find((option) => option.value === "yes"),
    ).toEqual({
      value: "yes",
      label: "Ja, helt",
      description: "Jeg fikk gjort alt",
    });
  });

  it("uses a unique page id and keeps existing page order while repairing", () => {
    const document = createDiscoverySurveyDocument();
    const taskPage = document.pages.find((page) => page.id === "task");
    const blockerPage = document.pages.find((page) => page.id === "blocker");
    if (!taskPage || !blockerPage) throw new Error("missing template pages");
    document.pages = [
      taskPage,
      {
        id: "success",
        questions: [
          {
            id: "extra-before-blocker",
            type: "text",
            prompt: "Eget spørsmål",
            visibleIf: { questionId: "task", operator: "EXISTS" },
          },
        ],
      },
      blockerPage,
    ];

    const repaired = repairSpecializedSurveyDocument(document);
    expect(repaired.pages.map((page) => page.id)).toEqual([
      "task",
      "success",
      "success-2",
      "blocker",
    ]);
    expect(repaired.pages[1].questions[0].id).toBe("extra-before-blocker");
    expect(() => validateSurveyDocumentV1(repaired)).not.toThrow();
  });

  it("preserves a real priority task and only fills the missing minimum", () => {
    const document = createTaskPrioritySurveyDocument({
      tasks: [
        { value: "apply", label: "Søke" },
        { value: "status", label: "Sjekke status" },
      ],
      maxSelections: 2,
    });
    const priority = document.pages[0].questions[0];
    if (priority.type !== "multiChoice") throw new Error("missing priority");
    priority.options = [priority.options[0]];

    const repaired = repairSpecializedSurveyDocument(document);
    const repairedPriority = repaired.pages[0].questions[0];
    expect(repairedPriority.type).toBe("multiChoice");
    if (repairedPriority.type !== "multiChoice") return;
    expect(repairedPriority.options[0]).toEqual({
      value: "apply",
      label: "Søke",
    });
    expect(repairedPriority.options).toHaveLength(2);
    expect(() => validateSurveyDocumentV1(repaired)).not.toThrow();
  });

  it("requires a real known task when Top Tasks only has the other choice", () => {
    const document = createTopTasksSurveyDocument({
      tasks: [{ value: "known", label: "Kjent oppgave" }],
      includeOtherTask: true,
    });
    const task = document.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "task");
    if (!task || task.type !== "singleChoice") {
      throw new Error("missing task question");
    }
    task.options = [{ value: "other", label: "Noe annet" }];

    expect(findHandoffIssues(document)).toContainEqual({
      questionId: "task",
      message: "Legg til minst én kjent oppgave som brukeren kan velge mellom.",
    });
  });
});

describe("documentNeedsWideDock", () => {
  it("is false without NPS questions", () => {
    expect(documentNeedsWideDock(makeDocument())).toBe(false);
  });

  it("is true when any question is NPS, even behind a hidden first question", () => {
    const document = makeDocument();
    document.pages[0].questions[1] = {
      id: "nps-1",
      type: "rating",
      variant: "nps",
      prompt: "Hvor sannsynlig er det at du anbefaler oss?",
    };
    expect(documentNeedsWideDock(document)).toBe(true);
  });
});

describe("setQuestionVisibleIf", () => {
  it("sets a leaf condition on the question", () => {
    const document = makeDocument();
    const next = setQuestionVisibleIf(document, "side-a", "text-1", {
      questionId: "rating-1",
      operator: "EXISTS",
    });
    expect(next.pages[0].questions[1].visibleIf).toEqual({
      questionId: "rating-1",
      operator: "EXISTS",
    });
  });

  it("clears the condition when given undefined", () => {
    const document = makeDocument();
    const withCondition = setQuestionVisibleIf(document, "side-a", "text-1", {
      questionId: "rating-1",
      operator: "EXISTS",
    });
    const cleared = setQuestionVisibleIf(
      withCondition,
      "side-a",
      "text-1",
      undefined,
    );
    expect("visibleIf" in cleared.pages[0].questions[1]).toBe(false);
  });
});

describe("listReferenceableQuestions", () => {
  it("returns only strictly earlier questions in page order", () => {
    const document = makeDocument();
    expect(
      listReferenceableQuestions(document, "choice-1").map(
        (candidate) => candidate.id,
      ),
    ).toEqual(["rating-1", "text-1"]);
    expect(
      listReferenceableQuestions(document, "text-1").map(
        (candidate) => candidate.id,
      ),
    ).toEqual(["rating-1"]);
  });

  it("is empty for the first question and unknown ids", () => {
    const document = makeDocument();
    expect(listReferenceableQuestions(document, "rating-1")).toEqual([]);
    expect(listReferenceableQuestions(document, "finnes-ikke")).toEqual([]);
  });

  it("labels each candidate with page and question number", () => {
    const document = makeDocument();
    const [first] = listReferenceableQuestions(document, "choice-1");
    expect(first).toMatchObject({
      id: "rating-1",
      pageNumber: 1,
      questionNumber: 1,
      prompt: "Hvordan opplevde du tjenesten?",
    });
  });
});

describe("conditionValueSuggestions", () => {
  it("suggests option values for choice questions", () => {
    const document = makeDocument();
    expect(conditionValueSuggestions(document, "choice-1")).toEqual([
      { value: "soke", label: "Søke" },
      { value: "sjekke-status", label: "Sjekke status" },
    ]);
  });

  it("suggests the fixed scale for rating variants", () => {
    const document = makeDocument();
    expect(
      conditionValueSuggestions(document, "rating-1").map(
        (suggestion) => suggestion.value,
      ),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("suggests nothing for text questions and unknown ids", () => {
    const document = makeDocument();
    expect(conditionValueSuggestions(document, "text-1")).toEqual([]);
    expect(conditionValueSuggestions(document, "finnes-ikke")).toEqual([]);
  });
});

describe("allowedConditionOperators", () => {
  it("gives multiChoice only EXISTS and CONTAINS", () => {
    expect(allowedConditionOperators("multiChoice")).toEqual([
      "EXISTS",
      "CONTAINS",
    ]);
    expect(allowedConditionOperators("singleChoice")).toEqual([
      "EXISTS",
      "EQ",
      "NEQ",
    ]);
  });
});

describe("survey screen content", () => {
  it("sets, updates and clears the intro", () => {
    const document = makeDocument();
    const withIntro = setSurveyIntro(document, {
      title: "Velkommen",
      body: "To korte spørsmål.",
      startLabel: "Kom i gang",
    });
    expect(withIntro.intro).toEqual({
      title: "Velkommen",
      body: "To korte spørsmål.",
      startLabel: "Kom i gang",
    });
    expect(document.intro).toBeUndefined();

    const cleared = setSurveyIntro(withIntro, undefined);
    expect("intro" in cleared).toBe(false);
  });

  it("sets and clears the success screen", () => {
    const document = makeDocument();
    const withSuccess = setSurveySuccess(document, { title: "Takk!" });
    expect(withSuccess.success).toEqual({ title: "Takk!" });
    const cleared = setSurveySuccess(withSuccess, undefined);
    expect("success" in cleared).toBe(false);
  });

  it("release-gates blank screen titles but leaves drafts alone", () => {
    const document = setSurveySuccess(
      setSurveyIntro(makeDocument(), { title: "   " }),
      { title: "" },
    );
    const issues = findHandoffIssues(document);
    expect(
      issues.some((issue) => /velkomst.*tittel/i.test(issue.message)),
    ).toBe(true);
    expect(
      issues.some((issue) => /bekreftelse.*tittel/i.test(issue.message)),
    ).toBe(true);

    const valid = setSurveySuccess(
      setSurveyIntro(makeDocument(), { title: "Velkommen" }),
      { title: "Takk!" },
    );
    expect(findHandoffIssues(valid)).toEqual([]);
  });
});

describe("condition group helpers", () => {
  const leafA = { questionId: "rating-1", operator: "EXISTS" } as const;
  const leafB = {
    questionId: "choice-1",
    operator: "EQ",
    value: "soke",
  } as const;

  it("flattens unset, leaf and group conditions to a leaf list", () => {
    expect(visibleIfLeaves(undefined)).toEqual([]);
    expect(visibleIfLeaves(leafA)).toEqual([leafA]);
    expect(visibleIfLeaves({ any: [leafA, leafB] })).toEqual([leafA, leafB]);
    expect(visibleIfLeaves({ all: [leafA, leafB] })).toEqual([leafA, leafB]);
  });

  it("reads the combinator with all as the default", () => {
    expect(conditionCombinator(undefined)).toBe("all");
    expect(conditionCombinator(leafA)).toBe("all");
    expect(conditionCombinator({ all: [leafA, leafB] })).toBe("all");
    expect(conditionCombinator({ any: [leafA, leafB] })).toBe("any");
  });

  it("serializes to the exact runtime shape", () => {
    expect(buildVisibleIf([], "all")).toBeUndefined();
    // A single condition is a leaf — never a one-member group.
    expect(buildVisibleIf([leafA], "any")).toEqual(leafA);
    expect(buildVisibleIf([leafA, leafB], "all")).toEqual({
      all: [leafA, leafB],
    });
    expect(buildVisibleIf([leafA, leafB], "any")).toEqual({
      any: [leafA, leafB],
    });
  });
});

describe("findHandoffIssues for conditions", () => {
  function withCondition(
    condition: NonNullable<
      SurveyDocumentV1["pages"][number]["questions"][number]["visibleIf"]
    >,
  ): SurveyDocumentV1 {
    const document = makeDocument();
    document.pages[1].questions[0] = {
      ...document.pages[1].questions[0],
      visibleIf: condition,
    };
    return document;
  }

  it("flags EQ against a multiChoice reference", () => {
    const document = makeDocument();
    document.pages[0].questions[1] = {
      id: "multi-1",
      type: "multiChoice",
      prompt: "Velg flere",
      options: [
        { value: "en", label: "En" },
        { value: "to", label: "To" },
      ],
    };
    document.pages[1].questions[0] = {
      ...document.pages[1].questions[0],
      visibleIf: { questionId: "multi-1", operator: "EQ", value: "en" },
    };
    const issues = findHandoffIssues(document);
    expect(
      issues.some((issue) => /vilkår som ikke passer/i.test(issue.message)),
    ).toBe(true);
    expect(issues[0].questionId).toBe("choice-1");
  });

  it("flags a value outside the referenced choice options", () => {
    const issues = findHandoffIssues(
      withCondition({
        questionId: "rating-1",
        operator: "EQ",
        value: 99,
      }),
    );
    expect(issues.some((issue) => /utenfor skalaen/i.test(issue.message))).toBe(
      true,
    );
  });

  it("accepts a valid CONTAINS condition and EXISTS", () => {
    expect(
      findHandoffIssues(
        withCondition({ questionId: "rating-1", operator: "EXISTS" }),
      ),
    ).toEqual([]);
    expect(
      findHandoffIssues(
        withCondition({ questionId: "rating-1", operator: "EQ", value: 3 }),
      ),
    ).toEqual([]);
  });

  it("requires string values against text references", () => {
    const issues = findHandoffIssues(
      withCondition({ questionId: "text-1", operator: "EQ", value: 3 }),
    );
    expect(issues.some((issue) => /må være tekst/i.test(issue.message))).toBe(
      true,
    );
    expect(
      findHandoffIssues(
        withCondition({ questionId: "text-1", operator: "EQ", value: "3" }),
      ),
    ).toEqual([]);
  });

  it("rejects empty and whitespace-only values against text references", () => {
    // Blank text answers are stripped from runtime answer state, so EQ ""
    // can never match, NEQ "" is true before any answer, and CONTAINS ""
    // matches every non-empty answer.
    for (const value of ["", "   "]) {
      const issues = findHandoffIssues(
        withCondition({ questionId: "text-1", operator: "CONTAINS", value }),
      );
      expect(
        issues.some((issue) => /kan ikke være tom/i.test(issue.message)),
      ).toBe(true);
    }
  });

  it("validates ANSWER semantics when the leaf carries a stray metadata key", () => {
    const stray = {
      field: "ANSWER" as const,
      questionId: "text-1",
      key: "ekstra-felt",
      operator: "GT" as const,
      value: 2,
    };
    const issues = findHandoffIssues(withCondition(stray));
    expect(
      issues.some((issue) => /vilkår som ikke passer/i.test(issue.message)),
    ).toBe(true);
  });

  it("flags contradictory targets in both directions", () => {
    const answerWithKey = {
      field: "ANSWER" as const,
      questionId: "rating-1",
      key: "ekstra-felt",
      operator: "EXISTS" as const,
    };
    expect(
      findHandoffIssues(withCondition(answerWithKey)).some((issue) =>
        /metadata-nøkkel/i.test(issue.message),
      ),
    ).toBe(true);

    const metadataWithQuestionId = {
      field: "METADATA" as const,
      key: "flow",
      questionId: "rating-1",
      operator: "EXISTS" as const,
    };
    expect(
      findHandoffIssues(withCondition(metadataWithQuestionId)).some((issue) =>
        /spørsmålsreferanse/i.test(issue.message),
      ),
    ).toBe(true);
  });

  it("validates leaves inside groups too", () => {
    const issues = findHandoffIssues(
      withCondition({
        any: [
          { questionId: "rating-1", operator: "EQ", value: 3 },
          { questionId: "rating-1", operator: "EQ", value: 42 },
        ],
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/utenfor skalaen/i);
  });
});

describe("updateOptionValue condition migration", () => {
  it("migrates later leaf conditions referencing the renamed value", () => {
    const document = makeDocument();
    document.pages[1].questions[0] = {
      ...document.pages[1].questions[0],
      visibleIf: undefined,
    };
    const withFollowUp: SurveyDocumentV1 = {
      ...document,
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          questions: [
            document.pages[1].questions[0],
            {
              id: "text-2",
              type: "text",
              prompt: "Utdyp",
              visibleIf: {
                questionId: "choice-1",
                operator: "EQ",
                value: "soke",
              },
            },
          ],
        },
      ] as SurveyDocumentV1["pages"],
    };
    const next = updateOptionValue(
      withFollowUp,
      "side-b",
      "choice-1",
      0,
      "sok-om-stotte",
    );
    expect(next.pages[1].questions[1].visibleIf).toEqual({
      questionId: "choice-1",
      operator: "EQ",
      value: "sok-om-stotte",
    });
  });

  it("migrates a leaf that carries a stray metadata key", () => {
    const document = makeDocument();
    const stray = {
      field: "ANSWER" as const,
      questionId: "choice-1",
      key: "ekstra-felt",
      operator: "EQ" as const,
      value: "soke",
    };
    document.pages[1].questions[0] = {
      ...document.pages[1].questions[0],
      visibleIf: stray,
    };
    const next = updateOptionValue(document, "side-b", "choice-1", 0, "ny-id");
    const condition = next.pages[1].questions[0].visibleIf;
    if (!condition || !("questionId" in condition)) {
      throw new Error("expected answer leaf");
    }
    expect(condition.value).toBe("ny-id");
  });

  it("never rewrites group conditions implicitly", () => {
    const document = makeDocument();
    const group = {
      any: [{ questionId: "choice-1", operator: "EQ" as const, value: "soke" }],
    };
    const withGroup: SurveyDocumentV1 = {
      ...document,
      pages: [
        document.pages[0],
        {
          ...document.pages[1],
          questions: [
            document.pages[1].questions[0],
            {
              id: "text-2",
              type: "text",
              prompt: "Utdyp",
              visibleIf: group,
            },
          ],
        },
      ] as SurveyDocumentV1["pages"],
    };
    const next = updateOptionValue(
      withGroup,
      "side-b",
      "choice-1",
      0,
      "ny-verdi",
    );
    expect(next.pages[1].questions[1].visibleIf).toEqual(group);
  });
});

describe("locateQuestion", () => {
  it("finds page and question numbers by question id", () => {
    const document = makeDocument();
    expect(locateQuestion(document, "text-1")).toEqual({
      pageNumber: 1,
      questionNumber: 2,
      pageId: "side-a",
    });
    expect(locateQuestion(document, "choice-1")).toEqual({
      pageNumber: 2,
      questionNumber: 1,
      pageId: "side-b",
    });
  });

  it("returns null for unknown ids", () => {
    const document = makeDocument();
    expect(locateQuestion(document, "finnes-ikke")).toBeNull();
  });
});
