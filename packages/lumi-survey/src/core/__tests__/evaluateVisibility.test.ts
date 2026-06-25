import { describe, expect, it } from "vitest";
import {
  evaluateVisibility,
  getVisibleQuestions,
  shouldShowSubmitButton,
} from "../evaluateVisibility";
import type { LumiSurveyQuestion, VisibleIfCondition } from "../types";

describe("evaluateVisibility", () => {
  describe("with no condition", () => {
    it("returns true when condition is undefined", () => {
      expect(evaluateVisibility(undefined, {})).toBe(true);
    });
  });

  describe("with EXISTS operator", () => {
    it("returns true when referenced answer exists", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "rating",
        operator: "EXISTS" as const,
      };
      expect(evaluateVisibility(condition, { rating: 5 })).toBe(true);
    });

    it("returns false when referenced answer does not exist", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "rating",
        operator: "EXISTS" as const,
      };
      expect(evaluateVisibility(condition, {})).toBe(false);
    });

    it("returns true when no questionId is specified", () => {
      const condition = {
        field: "ANSWER" as const,
        operator: "EXISTS" as const,
      };
      expect(evaluateVisibility(condition, {})).toBe(true);
    });
  });

  describe("with EQ operator", () => {
    it("returns true when values are equal", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "success",
        operator: "EQ" as const,
        value: "yes",
      };
      expect(evaluateVisibility(condition, { success: "yes" })).toBe(true);
    });

    it("returns false when values are not equal", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "success",
        operator: "EQ" as const,
        value: "yes",
      };
      expect(evaluateVisibility(condition, { success: "no" })).toBe(false);
    });
  });

  describe("with NEQ operator", () => {
    it("returns true when values are not equal", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "success",
        operator: "NEQ" as const,
        value: "yes",
      };
      expect(evaluateVisibility(condition, { success: "no" })).toBe(true);
    });

    it("returns false when values are equal", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "success",
        operator: "NEQ" as const,
        value: "yes",
      };
      expect(evaluateVisibility(condition, { success: "yes" })).toBe(false);
    });
  });

  describe("with numeric operators", () => {
    it("GT returns true when actual > expected", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "rating",
        operator: "GT" as const,
        value: 3,
      };
      expect(evaluateVisibility(condition, { rating: 5 })).toBe(true);
      expect(evaluateVisibility(condition, { rating: 3 })).toBe(false);
    });

    it("LT returns true when actual < expected", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "rating",
        operator: "LT" as const,
        value: 3,
      };
      expect(evaluateVisibility(condition, { rating: 2 })).toBe(true);
      expect(evaluateVisibility(condition, { rating: 3 })).toBe(false);
    });
  });

  describe("with CONTAINS operator", () => {
    it("returns true when array contains value", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "tasks",
        operator: "CONTAINS" as const,
        value: "apply",
      };
      expect(evaluateVisibility(condition, { tasks: ["apply", "check"] })).toBe(
        true,
      );
    });

    it("returns false when array does not contain value", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "tasks",
        operator: "CONTAINS" as const,
        value: "apply",
      };
      expect(
        evaluateVisibility(condition, { tasks: ["check", "status"] }),
      ).toBe(false);
    });

    it("returns true when string contains substring (case-insensitive)", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "feedback",
        operator: "CONTAINS" as const,
        value: "good",
      };
      expect(
        evaluateVisibility(condition, { feedback: "Very Good feedback" }),
      ).toBe(true);
    });

    it("returns false when string does not contain substring", () => {
      const condition = {
        field: "ANSWER" as const,
        questionId: "feedback",
        operator: "CONTAINS" as const,
        value: "bad",
      };
      expect(
        evaluateVisibility(condition, { feedback: "Very Good feedback" }),
      ).toBe(false);
    });
  });

  describe("with METADATA field", () => {
    it("evaluates metadata conditions", () => {
      const condition = {
        field: "METADATA" as const,
        key: "userType",
        operator: "EQ" as const,
        value: "employee",
      };
      expect(evaluateVisibility(condition, {}, { userType: "employee" })).toBe(
        true,
      );
      expect(evaluateVisibility(condition, {}, { userType: "employer" })).toBe(
        false,
      );
    });
  });
});

describe("getVisibleQuestions", () => {
  const questions: LumiSurveyQuestion[] = [
    {
      id: "rating",
      type: "rating",
      prompt: "How was it?",
      required: true,
    },
    {
      id: "feedback",
      type: "text",
      prompt: "Tell us more",
      visibleIf: {
        field: "ANSWER",
        questionId: "rating",
        operator: "EXISTS",
      },
    },
    {
      id: "blocker",
      type: "text",
      prompt: "What blocked you?",
      visibleIf: {
        field: "ANSWER",
        questionId: "rating",
        operator: "LT",
        value: 3,
      },
    },
  ];

  it("returns only the rating question when no answers", () => {
    const visible = getVisibleQuestions(questions, {});
    expect(visible.map((q) => q.id)).toEqual(["rating"]);
  });

  it("returns rating and feedback when rating is answered", () => {
    const visible = getVisibleQuestions(questions, { rating: 5 });
    expect(visible.map((q) => q.id)).toEqual(["rating", "feedback"]);
  });

  it("returns rating, feedback, and blocker when rating is low", () => {
    const visible = getVisibleQuestions(questions, { rating: 2 });
    expect(visible.map((q) => q.id)).toEqual(["rating", "feedback", "blocker"]);
  });
});

describe("shouldShowSubmitButton", () => {
  const questions: LumiSurveyQuestion[] = [
    { id: "rating", type: "rating", prompt: "Rate us", required: true },
    { id: "feedback", type: "text", prompt: "Comments", required: false },
  ];

  it("returns false when first required question has no answer", () => {
    expect(shouldShowSubmitButton(questions, {})).toBe(false);
  });

  it("returns true when first required question has an answer", () => {
    expect(shouldShowSubmitButton(questions, { rating: 4 })).toBe(true);
  });

  it("returns true when there are no required questions and at least one meaningful answer exists", () => {
    const optionalQuestions: LumiSurveyQuestion[] = [
      { id: "feedback", type: "text", prompt: "Comments", required: false },
    ];
    expect(shouldShowSubmitButton(optionalQuestions, {})).toBe(false);
    expect(shouldShowSubmitButton(optionalQuestions, { feedback: "" })).toBe(
      false,
    );
    expect(shouldShowSubmitButton(optionalQuestions, { feedback: "   " })).toBe(
      false,
    );
    expect(shouldShowSubmitButton(optionalQuestions, { feedback: "Hi" })).toBe(
      true,
    );
  });

  it("returns true once there is any meaningful answer, even if other required questions are missing", () => {
    const requiredQuestions: LumiSurveyQuestion[] = [
      { id: "rating", type: "rating", prompt: "Rate us", required: true },
      { id: "why", type: "text", prompt: "Why?", required: true },
    ];

    expect(shouldShowSubmitButton(requiredQuestions, {})).toBe(false);
    expect(shouldShowSubmitButton(requiredQuestions, { rating: 4 })).toBe(true);
    expect(
      shouldShowSubmitButton(requiredQuestions, { rating: 4, why: "" }),
    ).toBe(true);
    expect(
      shouldShowSubmitButton(requiredQuestions, { rating: 4, why: "Because" }),
    ).toBe(true);
  });
});

describe("evaluateVisibility with any/all groups", () => {
  it("any: visible when at least one leaf matches", () => {
    const condition = {
      any: [
        {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EQ" as const,
          value: "nei",
        },
        {
          field: "ANSWER" as const,
          questionId: "q2",
          operator: "EQ" as const,
          value: "nei",
        },
      ],
    };
    expect(evaluateVisibility(condition, { q1: "ja", q2: "nei" })).toBe(true);
  });

  it("any: hidden when no leaf matches", () => {
    const condition = {
      any: [
        {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EQ" as const,
          value: "nei",
        },
        {
          field: "ANSWER" as const,
          questionId: "q2",
          operator: "EQ" as const,
          value: "nei",
        },
      ],
    };
    expect(evaluateVisibility(condition, { q1: "ja", q2: "ja" })).toBe(false);
  });

  it("all: visible only when every leaf matches", () => {
    const condition = {
      all: [
        {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EQ" as const,
          value: "nei",
        },
        {
          field: "ANSWER" as const,
          questionId: "q2",
          operator: "EQ" as const,
          value: "nei",
        },
      ],
    };
    expect(evaluateVisibility(condition, { q1: "nei", q2: "nei" })).toBe(true);
    expect(evaluateVisibility(condition, { q1: "nei", q2: "ja" })).toBe(false);
  });

  it("mixes EXISTS and EQ leaves in one group", () => {
    const condition = {
      all: [
        {
          field: "ANSWER" as const,
          questionId: "rating",
          operator: "EXISTS" as const,
        },
        {
          field: "ANSWER" as const,
          questionId: "success",
          operator: "EQ" as const,
          value: "no",
        },
      ],
    };
    expect(evaluateVisibility(condition, { rating: 2, success: "no" })).toBe(
      true,
    );
    expect(evaluateVisibility(condition, { success: "no" })).toBe(false);
  });

  it("evaluates a METADATA leaf inside a group", () => {
    const condition = {
      any: [
        {
          field: "METADATA" as const,
          key: "userType",
          operator: "EQ" as const,
          value: "employee",
        },
        {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EQ" as const,
          value: "nei",
        },
      ],
    };
    expect(
      evaluateVisibility(condition, { q1: "ja" }, { userType: "employee" }),
    ).toBe(true);
    expect(
      evaluateVisibility(condition, { q1: "ja" }, { userType: "employer" }),
    ).toBe(false);
  });
});

describe("evaluateVisibility fail-closed guards (#333)", () => {
  it("fails closed when a group member is itself a group (nested, malformed input)", () => {
    const nested = {
      all: [{ any: [{ questionId: "a", operator: "EQ", value: "x" }] }],
    } as unknown as VisibleIfCondition;
    // Old behavior returned the inner group as a value-less leaf => always visible.
    expect(evaluateVisibility(nested, { a: "x" })).toBe(false);
    expect(evaluateVisibility(nested, { a: "WRONG" })).toBe(false);
  });
});
