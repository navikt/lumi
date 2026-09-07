import {
  type SurveyDocumentV1,
  type SurveyPageV1,
  type SurveyQuestionV1,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import {
  deleteFromDocument,
  deletionPlan,
  insertQuestionPage,
  isSimpleCondition,
  joinedQuestions,
  moveDocumentPage,
  moveDocumentQuestion,
  orderConflict,
  placeQuestion,
  replaceQuestion,
  sources,
} from "../questionEditorModel";
import { findHandoffIssues } from "../surveyDocument";

function text(
  id: string,
  visibleIf?: SurveyQuestionV1["visibleIf"],
): SurveyQuestionV1 {
  return {
    id,
    type: "text",
    prompt: `Spørsmål ${id}`,
    maxLength: 1000,
    ...(visibleIf ? { visibleIf } : {}),
  };
}

const choice: SurveyQuestionV1 = {
  id: "choice",
  type: "multiChoice",
  prompt: "Hva trenger du?",
  options: [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ],
};
const followup = text("followup", {
  questionId: "choice",
  operator: "CONTAINS",
  value: "a",
});
const nested = text("nested", { questionId: "followup", operator: "EXISTS" });

function page(
  id: string,
  questions: SurveyPageV1["questions"],
  title?: string,
): SurveyPageV1 {
  return {
    id,
    questions,
    ...(title ? { title, description: `Hjelpetekst for ${title}` } : {}),
  };
}

function document(...pages: SurveyDocumentV1["pages"]): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: "custom",
    intro: {
      title: "Velkommen",
      body: "Før spørsmålene",
      startLabel: "Begynn",
    },
    success: { title: "Takk", body: "Etter innsending" },
    pages,
  };
}

function questionIds(value: SurveyDocumentV1) {
  return value.pages.map((item) =>
    item.questions.map((question) => question.id),
  );
}

function assertUniqueIds(value: SurveyDocumentV1) {
  expect(new Set(value.pages.map((item) => item.id)).size).toBe(
    value.pages.length,
  );
  const questions = value.pages.flatMap((item) => item.questions);
  expect(new Set(questions.map((item) => item.id)).size).toBe(questions.length);
  expect(() => validateSurveyDocumentV1(value)).not.toThrow();
}

describe("inserting and replacing questions", () => {
  it("inserts after the complete selected page without moving its grouped questions", () => {
    const before = document(
      page("group", [choice, followup], "Felles overskrift"),
      page("last", [text("last")]),
    );
    const snapshot = structuredClone(before);
    const next = insertQuestionPage(before, text("new"), "group");

    expect(questionIds(next)).toEqual([
      ["choice", "followup"],
      ["new"],
      ["last"],
    ]);
    expect(next.pages[0]).toEqual(before.pages[0]);
    expect(next.pages[2]).toEqual(before.pages[1]);
    expect(next.pages[1].title).toBeUndefined();
    expect(next.intro).toEqual(before.intro);
    expect(next.success).toEqual(before.success);
    expect(before).toEqual(snapshot);
    assertUniqueIds(next);
  });

  it("appends to the end when no insertion page is selected", () => {
    const before = document(page("first", [choice]), page("last", [followup]));
    const next = insertQuestionPage(before, text("new"));
    expect(questionIds(next)).toEqual([["choice"], ["followup"], ["new"]]);
    assertUniqueIds(next);
  });

  it("edits presentation without rewriting advanced conditions or page metadata", () => {
    const advanced = text("advanced", {
      any: [
        { questionId: "choice", operator: "CONTAINS", value: "a" },
        { field: "METADATA", key: "role", operator: "EQ", value: "employer" },
      ],
    });
    const before = document(
      page("first", [choice]),
      page("details", [advanced], "Detaljer"),
    );
    const next = replaceQuestion(before, { ...advanced, prompt: "Ny tekst" });
    expect(next.pages[1]).toEqual({
      ...before.pages[1],
      questions: [{ ...advanced, prompt: "Ny tekst" }],
    });
    expect(next.pages[0]).toEqual(before.pages[0]);
    expect(before.pages[1].questions[0].prompt).toBe("Spørsmål advanced");
    assertUniqueIds(next);
  });
});

describe("placing questions on pages", () => {
  it("joins a separate question while retaining the previous page and the answer rule", () => {
    const before = document(
      page("first", [choice], "Behov"),
      page("followup", [followup]),
      page("last", [nested]),
    );
    const next = placeQuestion(before, "followup", true);
    expect(questionIds(next)).toEqual([["choice", "followup"], ["nested"]]);
    expect(next.pages[0]).toEqual({
      ...before.pages[0],
      questions: [choice, followup],
    });
    expect(next.pages[1]).toEqual(before.pages[2]);
    expect(joinedQuestions(next.pages.map((item) => item.questions))).toEqual(
      new Set(["followup"]),
    );
    expect(questionIds(before)).toEqual([["choice"], ["followup"], ["nested"]]);
    assertUniqueIds(next);
  });

  it("refuses a join that would silently discard a page heading or help text", () => {
    const before = document(
      page("first", [choice]),
      page("followup", [followup], "Oppfølging"),
    );
    expect(() => placeQuestion(before, "followup", true)).toThrow(
      /overskrift eller hjelpetekst/,
    );
    const helpOnly = {
      ...before,
      pages: [before.pages[0], { ...before.pages[1], title: undefined }],
    } as SurveyDocumentV1;
    expect(() => placeQuestion(helpOnly, "followup", true)).toThrow(
      /overskrift eller hjelpetekst/,
    );
    expect(before.pages[1].questions).toEqual([followup]);
  });

  it("keeps the remaining group and its metadata when joining its first question to the previous page", () => {
    const before = document(
      page("first", [choice]),
      page("group", [followup, nested], "Detaljer"),
    );
    const next = placeQuestion(before, "followup", true);
    expect(questionIds(next)).toEqual([["choice", "followup"], ["nested"]]);
    expect(next.pages[1]).toEqual({ ...before.pages[1], questions: [nested] });
    assertUniqueIds(next);
  });

  it("splits a middle question out without reordering questions or duplicating page metadata", () => {
    const before = document(
      page("group", [choice, followup, nested], "Detaljer"),
    );
    const next = placeQuestion(before, "followup", false);
    expect(questionIds(next)).toEqual([["choice"], ["followup"], ["nested"]]);
    expect(next.pages[0]).toEqual({ ...before.pages[0], questions: [choice] });
    expect(
      next.pages.slice(1).every((item) => !item.title && !item.description),
    ).toBe(true);
    expect(next.pages[1].questions[0].visibleIf).toEqual(followup.visibleIf);
    expect(next.pages[2].questions[0].visibleIf).toEqual(nested.visibleIf);
    assertUniqueIds(next);
  });

  it("preserves the remaining group's identity when its first question gets a separate page", () => {
    const before = document(
      page("group", [choice, followup, nested], "Detaljer"),
    );
    const next = placeQuestion(before, "choice", false);
    expect(questionIds(next)).toEqual([["choice"], ["followup", "nested"]]);
    expect(next.pages[1]).toEqual({
      ...before.pages[0],
      questions: [followup, nested],
    });
    expect(next.pages[0].title).toBeUndefined();
    assertUniqueIds(next);
  });

  it("keeps no-op placements unchanged", () => {
    const before = document(
      page("group", [choice, followup]),
      page("single", [nested]),
    );
    expect(placeQuestion(before, "choice", true)).toBe(before);
    expect(placeQuestion(before, "followup", true)).toBe(before);
    expect(placeQuestion(before, "nested", false)).toBe(before);
    expect(placeQuestion(before, "missing", false)).toBe(before);
  });
});

describe("reordering and source safety", () => {
  it("moves whole pages with their IDs, headings, grouped questions and conditions", () => {
    const before = document(
      page("group", [choice, followup], "Behov"),
      page("independent", [text("independent")], "Andre spørsmål"),
    );
    const next = moveDocumentPage(before, "independent", -1);
    expect(next.pages).toEqual([before.pages[1], before.pages[0]]);
    expect(orderConflict(next.pages.map((item) => item.questions))).toBeNull();
    expect(before.pages[0].id).toBe("group");
    assertUniqueIds(next);
  });

  it("detects a page move that would put an advanced multi-source question before one source", () => {
    const secondSource = text("second");
    const advanced = text("advanced", {
      any: [
        { questionId: "choice", operator: "CONTAINS", value: "a" },
        { questionId: "second", operator: "EXISTS" },
      ],
    });
    const before = document(
      page("first", [choice]),
      page("second", [secondSource]),
      page("advanced", [advanced]),
    );
    const candidate = moveDocumentPage(before, "advanced", -1);
    expect(
      orderConflict(candidate.pages.map((item) => item.questions)),
    ).toEqual({ question: advanced, source: "second" });
    expect(candidate.pages[1].questions[0].visibleIf).toEqual(
      advanced.visibleIf,
    );
    expect(sources(advanced)).toEqual(["choice", "second"]);
  });

  it("detects moving an in-page follow-up ahead of its source without changing either condition", () => {
    const before = document(
      page("group", [choice, followup, nested], "Detaljer"),
    );
    const candidate = moveDocumentQuestion(before, "followup", -1);
    expect(questionIds(candidate)).toEqual([["followup", "choice", "nested"]]);
    expect(candidate.pages[0].title).toBe("Detaljer");
    expect(candidate.pages[0].id).toBe("group");
    expect(
      orderConflict(candidate.pages.map((item) => item.questions)),
    ).toEqual({ question: followup, source: "choice" });
    expect(before.pages[0].questions).toEqual([choice, followup, nested]);
  });

  it("ignores metadata-only conditions but detects a missing question source", () => {
    const metadata = text("metadata", {
      field: "METADATA",
      key: "role",
      operator: "EQ",
      value: "employer",
    });
    expect(sources(metadata)).toEqual([]);
    expect(orderConflict([[metadata]])).toBeNull();
    expect(orderConflict([[followup]])).toEqual({
      question: followup,
      source: "choice",
    });
  });

  it("does not move a question across a page boundary or a page beyond the document", () => {
    const before = document(page("first", [choice]), page("last", [followup]));
    expect(moveDocumentQuestion(before, "followup", -1)).toBe(before);
    expect(moveDocumentPage(before, "first", -1)).toBe(before);
    expect(moveDocumentPage(before, "last", 1)).toBe(before);
    expect(moveDocumentPage(before, "missing", -1)).toBe(before);
  });
});

describe("deletion and advanced conditions", () => {
  it.each([
    { variant: "emoji", operator: "LT", value: 3 },
    { variant: "stars", operator: "GT", value: 3 },
    { variant: "thumbs", operator: "EQ", value: 1 },
    { variant: "thumbs", operator: "EQ", value: 2 },
    { variant: "nps", operator: "LT", value: 7 },
    { variant: "nps", operator: "GT", value: 8 },
  ] as const)("allows cascading a $variant shortcut ($operator $value), including its descendants", ({
    variant,
    operator,
    value,
  }) => {
    const rating: SurveyQuestionV1 = {
      id: "rating",
      type: "rating",
      prompt: "Hva synes du?",
      variant,
    };
    const ratingFollowup = text("rating-followup", {
      questionId: "rating",
      operator,
      value,
    });
    const child = text("child", {
      questionId: "rating-followup",
      operator: "EXISTS",
    });
    const plan = deletionPlan([rating, ratingFollowup, child], "rating");
    expect(plan.blockers).toEqual([]);
    expect(plan.affected).toEqual(
      new Set(["rating", "rating-followup", "child"]),
    );
    // Numeric comparisons must still open the full condition editor.
    expect(isSimpleCondition(ratingFollowup, [rating, ratingFollowup])).toBe(
      false,
    );
  });

  it.each([
    { any: [{ questionId: "rating", operator: "LT", value: 7 }] },
    {
      all: [
        { questionId: "rating", operator: "GT", value: 6 },
        { questionId: "rating", operator: "LT", value: 9 },
      ],
    },
    {
      any: [
        { questionId: "rating", operator: "LT", value: 7 },
        { field: "METADATA", key: "role", operator: "EXISTS" },
      ],
    },
    { questionId: "rating", operator: "EQ", value: 5 },
  ] satisfies NonNullable<
    SurveyQuestionV1["visibleIf"]
  >[])("keeps grouped, mixed and non-shortcut rating conditions blocked: %j", (visibleIf) => {
    const rating: SurveyQuestionV1 = {
      id: "rating",
      type: "rating",
      prompt: "Hva synes du?",
      variant: "nps",
    };
    const advanced = text("advanced", visibleIf);
    const plan = deletionPlan([rating, advanced], "rating");
    expect(plan.blockers).toEqual([advanced]);
    expect(advanced.visibleIf).toEqual(visibleIf);
  });

  it("includes all nested simple follow-ups in the deletion plan, independent of array order", () => {
    const independent = text("independent");
    const plan = deletionPlan(
      [nested, choice, independent, followup],
      "choice",
    );
    expect(plan.affected).toEqual(new Set(["choice", "followup", "nested"]));
    expect(plan.dependents).toEqual([nested, followup]);
    expect(plan.blockers).toEqual([]);
  });

  it("blocks a cascade through a multi-source rule and keeps its independent source intact", () => {
    const other = text("other");
    const advanced = text("advanced", {
      any: [
        { questionId: "choice", operator: "CONTAINS", value: "a" },
        { questionId: "other", operator: "EXISTS" },
      ],
    });
    const downstream = text("downstream", {
      questionId: "advanced",
      operator: "EXISTS",
    });
    const plan = deletionPlan([choice, other, advanced, downstream], "choice");
    expect(plan.blockers).toEqual([advanced]);
    expect(plan.affected).toEqual(
      new Set(["choice", "advanced", "downstream"]),
    );
    expect(isSimpleCondition(advanced, [choice, other, advanced])).toBe(false);
  });

  it("blocks a cascade through an advanced all-of rule even when it has only one source", () => {
    const advanced = text("advanced", {
      all: [
        { questionId: "choice", operator: "CONTAINS", value: "a" },
        { questionId: "choice", operator: "CONTAINS", value: "b" },
      ],
    });
    expect(isSimpleCondition(advanced, [choice, advanced])).toBe(false);
    expect(deletionPlan([choice, advanced], "choice").blockers).toEqual([
      advanced,
    ]);
  });

  it("blocks a cascade through a mixed metadata rule", () => {
    const advanced = text("advanced", {
      any: [
        { questionId: "choice", operator: "CONTAINS", value: "a" },
        { field: "METADATA", key: "role", operator: "EQ", value: "employer" },
      ],
    });
    expect(deletionPlan([choice, advanced], "choice").blockers).toEqual([
      advanced,
    ]);
    expect(isSimpleCondition(advanced, [choice, advanced])).toBe(false);
  });

  it("allows any-of answers on a single source as a simple follow-up", () => {
    const simple = text("simple", {
      any: [
        { questionId: "choice", operator: "CONTAINS", value: "a" },
        { questionId: "choice", operator: "CONTAINS", value: "b" },
      ],
    });
    expect(isSimpleCondition(simple, [choice, simple])).toBe(true);
    expect(deletionPlan([choice, simple], "choice").blockers).toEqual([]);
  });

  it("deletes a group's first question without moving the remaining questions to the preceding page", () => {
    const before = document(
      page("first", [choice]),
      page("group", [text("removed"), followup, nested], "Detaljer"),
    );
    const next = deleteFromDocument(before, new Set(["removed"]));
    expect(questionIds(next)).toEqual([["choice"], ["followup", "nested"]]);
    expect(next.pages[1]).toEqual({
      ...before.pages[1],
      questions: [followup, nested],
    });
    assertUniqueIds(next);
  });

  it("removes empty pages but preserves unaffected page identity, metadata and advanced rules", () => {
    const advanced = text("advanced", {
      field: "METADATA",
      key: "role",
      operator: "EXISTS",
    });
    const before = document(
      page("removed", [choice, followup]),
      page("kept", [advanced], "Felles overskrift"),
    );
    const next = deleteFromDocument(before, new Set(["choice", "followup"]));
    expect(next.pages).toEqual([before.pages[1]]);
    expect(next.intro).toEqual(before.intro);
    expect(next.success).toEqual(before.success);
    assertUniqueIds(next);
  });

  it("seeds a fresh editable blank draft after deleting all questions, still blocked from handoff", () => {
    const before = document(
      page("group", [choice, followup, nested], "Detaljer"),
    );
    const next = deleteFromDocument(
      before,
      deletionPlan(before.pages[0].questions, "choice").affected,
    );
    expect(next.pages).toHaveLength(1);
    expect(next.pages[0].questions).toHaveLength(1);
    const seeded = next.pages[0].questions[0];
    expect(seeded).toMatchObject({ type: "text", prompt: "", maxLength: 1000 });
    expect(seeded.visibleIf).toBeUndefined();
    expect(["choice", "followup", "nested"]).not.toContain(seeded.id);
    expect(next.pages[0].id).not.toBe("group");
    expect(next.pages[0].title).toBeUndefined();
    expect(next.intro).toEqual(before.intro);
    expect(next.success).toEqual(before.success);
    assertUniqueIds(next);
    expect(
      findHandoffIssues(next).some((issue) => issue.questionId === seeded.id),
    ).toBe(true);
  });
});
