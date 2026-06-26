import { describe, expect, it } from "vitest";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../../core/types.js";
import {
  findLastVisibleInHistory,
  findNextVisibleIndex,
  findRedirectTarget,
  hasReachableQuestionsAfter,
  isAnswered,
} from "../stepNavigationUtils.js";

const VISIBLE_IF_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "q1",
    type: "singleChoice",
    prompt: "Steg 1",
    required: true,
    options: [
      { value: "show", label: "Vis" },
      { value: "show-q3", label: "Vis kun q3" },
      { value: "hide", label: "Skjul" },
    ],
  },
  {
    id: "q2",
    type: "text",
    prompt: "Steg 2",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "ANSWER",
      questionId: "q1",
      operator: "EQ",
      value: "show",
    },
  },
  {
    id: "q3",
    type: "text",
    prompt: "Steg 3",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "ANSWER",
      questionId: "q1",
      operator: "EQ",
      value: "show-q3",
    },
  },
  {
    id: "q4",
    type: "text",
    prompt: "Steg 4",
    required: false,
    maxLength: 500,
  },
];

const ALL_VISIBLE_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "a1",
    type: "text",
    prompt: "A1",
    required: false,
    maxLength: 500,
  },
  {
    id: "a2",
    type: "text",
    prompt: "A2",
    required: false,
    maxLength: 500,
  },
  {
    id: "a3",
    type: "text",
    prompt: "A3",
    required: false,
    maxLength: 500,
  },
];

const METADATA_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "m1",
    type: "text",
    prompt: "M1",
    required: false,
    maxLength: 500,
  },
  {
    id: "m2",
    type: "text",
    prompt: "M2",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "METADATA",
      key: "showStep2",
      operator: "EQ",
      value: true,
    },
  },
];

const ALL_HIDDEN_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "h1",
    type: "text",
    prompt: "Hidden 1",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "METADATA",
      key: "show",
      operator: "EQ",
      value: "yes",
    },
  },
  {
    id: "h2",
    type: "text",
    prompt: "Hidden 2",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "METADATA",
      key: "show",
      operator: "EQ",
      value: "yes",
    },
  },
];

describe("isAnswered", () => {
  it.each([
    { label: "undefined", value: undefined },
    { label: "null (defensive)", value: null },
    { label: 'empty string ""', value: "" },
    { label: '"   " (whitespace-only string)', value: "   " },
    { label: "empty array []", value: [] },
  ])("returns false for $label", ({ value }) => {
    // biome-ignore lint/suspicious/noExplicitAny: testing defensive null handling
    expect(isAnswered(value as any)).toBe(false);
  });

  it.each([
    { label: '"a" (non-empty string)', value: "a" },
    { label: "0 (NPS-rating)", value: 0 },
    { label: "5 (numeric value)", value: 5 },
    { label: '["x", "y"] (multiChoice)', value: ["x", "y"] },
  ])("returns true for $label", ({ value }) => {
    expect(isAnswered(value)).toBe(true);
  });
});

describe("findNextVisibleIndex", () => {
  it("returns 0 for all-visible questions starting from index 0", () => {
    const result = findNextVisibleIndex(
      ALL_VISIBLE_QUESTIONS,
      {},
      undefined,
      0,
    );
    expect(result).toBe(0);
  });

  it("skips hidden questions and returns the first visible one", () => {
    const answers: Record<string, LumiSurveyAnswerValue> = { q1: "show-q3" };
    const result = findNextVisibleIndex(
      VISIBLE_IF_QUESTIONS,
      answers,
      undefined,
      1,
    );
    expect(result).toBe(2);
  });

  it("returns -1 when no visible questions exist", () => {
    const result = findNextVisibleIndex(ALL_HIDDEN_QUESTIONS, {}, undefined, 0);
    expect(result).toBe(-1);
  });

  it("respects startIndex and scans from that index", () => {
    const answers: Record<string, LumiSurveyAnswerValue> = { q1: "hide" };
    const result = findNextVisibleIndex(
      VISIBLE_IF_QUESTIONS,
      answers,
      undefined,
      2,
    );
    expect(result).toBe(3);
  });

  it("returns -1 when startIndex is beyond array bounds", () => {
    const result = findNextVisibleIndex(
      ALL_VISIBLE_QUESTIONS,
      {},
      undefined,
      99,
    );
    expect(result).toBe(-1);
  });

  it("clamps negative startIndex to 0", () => {
    const result = findNextVisibleIndex(
      ALL_VISIBLE_QUESTIONS,
      {},
      undefined,
      -5,
    );
    expect(result).toBe(0);
  });

  it("works with METADATA-based visibleIf conditions", () => {
    const result = findNextVisibleIndex(
      METADATA_QUESTIONS,
      {},
      { showStep2: true },
      1,
    );
    expect(result).toBe(1);
  });
});

describe("findLastVisibleInHistory", () => {
  it("returns the last step in history when all steps are visible", () => {
    const result = findLastVisibleInHistory(
      [0, 1, 2],
      ALL_VISIBLE_QUESTIONS,
      {},
      undefined,
    );
    expect(result).toEqual({ step: 2, history: [0, 1, 2] });
  });

  it("skips hidden steps and returns the last visible one with trimmed history", () => {
    const answers: Record<string, LumiSurveyAnswerValue> = { q1: "show" };
    const result = findLastVisibleInHistory(
      [0, 1, 2],
      VISIBLE_IF_QUESTIONS,
      answers,
      undefined,
    );
    expect(result).toEqual({ step: 1, history: [0, 1] });
  });

  it("returns null when no steps in history are visible", () => {
    const result = findLastVisibleInHistory(
      [0, 1],
      ALL_HIDDEN_QUESTIONS,
      {},
      undefined,
    );
    expect(result).toBeNull();
  });

  it("returns null for empty history", () => {
    const result = findLastVisibleInHistory(
      [],
      ALL_VISIBLE_QUESTIONS,
      {},
      undefined,
    );
    expect(result).toBeNull();
  });
});

describe("hasReachableQuestionsAfter", () => {
  it("returns true when a later question has no visibleIf", () => {
    const result = hasReachableQuestionsAfter(
      VISIBLE_IF_QUESTIONS,
      0,
      "q1",
      {},
      undefined,
    );
    expect(result).toBe(true);
  });

  it("returns true when a later question is currently visible", () => {
    const answers: Record<string, LumiSurveyAnswerValue> = { q1: "show" };
    const result = hasReachableQuestionsAfter(
      VISIBLE_IF_QUESTIONS,
      0,
      "q1",
      answers,
      undefined,
    );
    expect(result).toBe(true);
  });

  it("returns true when a later visibleIf depends on current question", () => {
    // Isolated fixture: q2 depends on q1, and q1's answer doesn't satisfy q2's
    // condition yet — but because q2 *references* q1, it's reachable.
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "singleChoice",
        prompt: "Q1",
        required: false,
        options: [{ value: "a", label: "A" }],
      },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "show",
        },
      },
    ];

    const result = hasReachableQuestionsAfter(
      questions,
      0,
      "q1",
      { q1: "hide" },
      undefined,
    );
    expect(result).toBe(true);
  });

  it("returns false when all later questions are hidden by unrelated conditions", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "text",
        prompt: "Q1",
        required: false,
        maxLength: 500,
      },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "otherQuestion",
          operator: "EQ",
          value: "show",
        },
      },
      {
        id: "q3",
        type: "text",
        prompt: "Q3",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "METADATA",
          key: "otherFlag",
          operator: "EQ",
          value: true,
        },
      },
    ];

    const result = hasReachableQuestionsAfter(
      questions,
      0,
      "q1",
      {},
      { otherFlag: false },
    );
    expect(result).toBe(false);
  });

  it("returns false for the last question", () => {
    const result = hasReachableQuestionsAfter(
      ALL_VISIBLE_QUESTIONS,
      2,
      "a3",
      {},
      undefined,
    );
    expect(result).toBe(false);
  });

  it("returns true for METADATA-based visibleIf that is currently visible", () => {
    const result = hasReachableQuestionsAfter(
      METADATA_QUESTIONS,
      0,
      "m1",
      {},
      { showStep2: true },
    );
    expect(result).toBe(true);
  });

  it("returns true when a later question's any-group references the current question (#333)", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "rating", prompt: "Rate", required: true },
      {
        id: "later",
        type: "text",
        prompt: "Why?",
        visibleIf: {
          any: [
            {
              field: "ANSWER",
              questionId: "other",
              operator: "EQ",
              value: "x",
            },
            { field: "ANSWER", questionId: "q1", operator: "EQ", value: "nei" },
          ],
        },
      },
    ] as unknown as LumiSurveyQuestion[];
    // current question is q1 at index 0; the group references q1 as its 2nd leaf
    // the group does NOT currently evaluate visible (no answers match), but because
    // a leaf references the current question the navigation bar must stay visible
    expect(hasReachableQuestionsAfter(questions, 0, "q1", {}, undefined)).toBe(
      true,
    );
  });

  it("does not crash on a malformed group member (#333)", () => {
    const questions = [
      { id: "q1", type: "rating", prompt: "Rate", required: true },
      {
        id: "q2",
        type: "text",
        prompt: "Why?",
        visibleIf: { any: [null] },
      },
    ] as unknown as LumiSurveyQuestion[];
    expect(() =>
      hasReachableQuestionsAfter(questions, 0, "q1", {}, undefined),
    ).not.toThrow();
  });
});

describe("findRedirectTarget", () => {
  it("returns the next visible forward question when one exists", () => {
    const answers: Record<string, LumiSurveyAnswerValue> = { q1: "show" };
    const result = findRedirectTarget(
      VISIBLE_IF_QUESTIONS,
      answers,
      undefined,
      0,
      [0],
    );
    expect(result).toBe(1);
  });

  it("falls back to the last visible step in history when nothing is visible forward", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "singleChoice",
        prompt: "Q1",
        required: true,
        options: [{ value: "yes", label: "Yes" }],
      },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "yes",
        },
      },
      {
        id: "q3",
        type: "text",
        prompt: "Q3",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "no",
        },
      },
    ];

    const result = findRedirectTarget(
      questions,
      { q1: "yes" },
      undefined,
      2,
      [0, 1, 2],
    );
    expect(result).toBe(1);
  });

  it("falls back to first visible overall when history has no visible steps", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "text",
        prompt: "Q1",
        required: false,
        maxLength: 500,
      },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "METADATA",
          key: "showSecond",
          operator: "EQ",
          value: true,
        },
      },
    ];

    const result = findRedirectTarget(
      questions,
      {},
      { showSecond: false },
      1,
      [1],
    );
    expect(result).toBe(0);
  });

  it("returns -1 when no visible questions exist at all", () => {
    const result = findRedirectTarget(
      ALL_HIDDEN_QUESTIONS,
      {},
      undefined,
      0,
      [0],
    );
    expect(result).toBe(-1);
  });

  it("prefers next visible forward over visible step in history", () => {
    // Both q1 (in history) and q3 (forward) are visible.
    // Current step q2 is hidden. Redirect should pick q3 (forward), not q1 (history).
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "text",
        prompt: "Q1",
        required: false,
        maxLength: 500,
      },
      {
        id: "q2",
        type: "text",
        prompt: "Q2 (hidden)",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "METADATA",
          key: "show",
          operator: "EQ",
          value: "yes",
        },
      },
      {
        id: "q3",
        type: "text",
        prompt: "Q3",
        required: false,
        maxLength: 500,
      },
    ];

    const result = findRedirectTarget(questions, {}, undefined, 1, [0, 1]);
    expect(result).toBe(2);
  });
});
