import { describe, expect, it } from "vitest";
import {
  evaluateBranching,
  surveyHasBranchingLogic,
  validateBranchingTargets,
} from "../branchingEngine";
import type { FlexJarQuestion, LogicRule } from "../types";

// Helper to create a simple text question
function createQuestion(id: string, logic?: LogicRule[]): FlexJarQuestion {
  return {
    id,
    type: "text",
    prompt: `Question ${id}`,
    logic,
  };
}

// Helper to create a singleChoice question
function createChoiceQuestion(
  id: string,
  options: string[],
  logic?: LogicRule[],
): FlexJarQuestion {
  return {
    id,
    type: "singleChoice",
    prompt: `Question ${id}`,
    options: options.map((opt) => ({ value: opt, label: opt })),
    logic,
  };
}

describe("evaluateBranching", () => {
  describe("default behavior (no logic)", () => {
    it("returns next index when no logic is defined", () => {
      const questions = [
        createQuestion("q1"),
        createQuestion("q2"),
        createQuestion("q3"),
      ];
      const result = evaluateBranching(
        questions[0],
        "some answer",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(1);
      expect(result.triggeredByRule).toBe(false);
      expect(result.matchedRule).toBeUndefined();
    });

    it("returns next index when logic array is empty", () => {
      const questions = [createQuestion("q1", []), createQuestion("q2")];
      const result = evaluateBranching(
        questions[0],
        "answer",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(1);
      expect(result.triggeredByRule).toBe(false);
    });
  });

  describe("ANSWER-based conditions", () => {
    it("EQ: jumps to target when answer matches", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "EQ", value: "YES" },
          action: { type: "JUMP_TO", targetId: "q3" },
        },
      ];
      const questions = [
        createChoiceQuestion("q1", ["YES", "NO"], logic),
        createQuestion("q2"),
        createQuestion("q3"),
      ];

      const result = evaluateBranching(
        questions[0],
        "YES",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(2);
      expect(result.triggeredByRule).toBe(true);
      expect(result.matchedRule).toEqual(logic[0]);
    });

    it("EQ: goes to next when answer does not match", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "EQ", value: "YES" },
          action: { type: "JUMP_TO", targetId: "q3" },
        },
      ];
      const questions = [
        createChoiceQuestion("q1", ["YES", "NO"], logic),
        createQuestion("q2"),
        createQuestion("q3"),
      ];

      const result = evaluateBranching(
        questions[0],
        "NO",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(1);
      expect(result.triggeredByRule).toBe(false);
    });

    it("NEQ: jumps when answer is different", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "NEQ", value: "HAPPY" },
          action: { type: "JUMP_TO", targetId: "q_unhappy" },
        },
      ];
      const questions = [
        createChoiceQuestion("q1", ["HAPPY", "SAD"], logic),
        createQuestion("q2"),
        createQuestion("q_unhappy"),
      ];

      const result = evaluateBranching(
        questions[0],
        "SAD",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(2);
      expect(result.triggeredByRule).toBe(true);
    });

    it("GT: works with numeric rating", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "GT", value: 3 },
          action: { type: "JUMP_TO", targetId: "q_positive" },
        },
      ];
      const questions: FlexJarQuestion[] = [
        { id: "rating", type: "rating", prompt: "Rate us", logic },
        createQuestion("q_negative"),
        createQuestion("q_positive"),
      ];

      expect(
        evaluateBranching(questions[0], 5, undefined, questions, 0).nextIndex,
      ).toBe(2);
      expect(
        evaluateBranching(questions[0], 4, undefined, questions, 0).nextIndex,
      ).toBe(2);
      expect(
        evaluateBranching(questions[0], 3, undefined, questions, 0).nextIndex,
      ).toBe(1);
      expect(
        evaluateBranching(questions[0], 2, undefined, questions, 0).nextIndex,
      ).toBe(1);
    });

    it("LT: works with numeric rating", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "LT", value: 3 },
          action: { type: "JUMP_TO", targetId: "q_followup" },
        },
      ];
      const questions: FlexJarQuestion[] = [
        { id: "rating", type: "rating", prompt: "Rate us", logic },
        createQuestion("q_end"),
        createQuestion("q_followup"),
      ];

      expect(
        evaluateBranching(questions[0], 1, undefined, questions, 0).nextIndex,
      ).toBe(2);
      expect(
        evaluateBranching(questions[0], 2, undefined, questions, 0).nextIndex,
      ).toBe(2);
      expect(
        evaluateBranching(questions[0], 3, undefined, questions, 0).nextIndex,
      ).toBe(1);
    });

    it("CONTAINS: works with text answers", () => {
      const logic: LogicRule[] = [
        {
          condition: {
            field: "ANSWER",
            operator: "CONTAINS",
            value: "problem",
          },
          action: { type: "JUMP_TO", targetId: "q_details" },
        },
      ];
      const questions: FlexJarQuestion[] = [
        { id: "feedback", type: "text", prompt: "Tell us more", logic },
        createQuestion("q_end"),
        createQuestion("q_details"),
      ];

      expect(
        evaluateBranching(
          questions[0],
          "I have a problem with login",
          undefined,
          questions,
          0,
        ).nextIndex,
      ).toBe(2);
      expect(
        evaluateBranching(
          questions[0],
          "Everything is fine",
          undefined,
          questions,
          0,
        ).nextIndex,
      ).toBe(1);
    });

    it("EQ: works with multiChoice arrays", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "EQ", value: "urgent" },
          action: { type: "JUMP_TO", targetId: "q_urgent" },
        },
      ];
      const questions: FlexJarQuestion[] = [
        {
          id: "tags",
          type: "multiChoice",
          prompt: "Select tags",
          options: [
            { value: "urgent", label: "Urgent" },
            { value: "bug", label: "Bug" },
          ],
          logic,
        },
        createQuestion("q_normal"),
        createQuestion("q_urgent"),
      ];

      // Array includes "urgent"
      expect(
        evaluateBranching(
          questions[0],
          ["urgent", "bug"],
          undefined,
          questions,
          0,
        ).nextIndex,
      ).toBe(2);
      // Array does not include "urgent"
      expect(
        evaluateBranching(questions[0], ["bug"], undefined, questions, 0)
          .nextIndex,
      ).toBe(1);
    });
  });

  describe("METADATA-based conditions", () => {
    it("EQ: jumps based on metadata value", () => {
      const logic: LogicRule[] = [
        {
          condition: {
            field: "METADATA",
            key: "userRole",
            operator: "EQ",
            value: "admin",
          },
          action: { type: "JUMP_TO", targetId: "q_admin" },
        },
      ];
      const questions = [
        createQuestion("q1", logic),
        createQuestion("q_user"),
        createQuestion("q_admin"),
      ];

      const adminMetadata = { userRole: "admin" };
      const userMetadata = { userRole: "user" };

      expect(
        evaluateBranching(questions[0], "any", adminMetadata, questions, 0)
          .nextIndex,
      ).toBe(2);
      expect(
        evaluateBranching(questions[0], "any", userMetadata, questions, 0)
          .nextIndex,
      ).toBe(1);
    });

    it("EQ: handles boolean metadata", () => {
      const logic: LogicRule[] = [
        {
          condition: {
            field: "METADATA",
            key: "harDialogmote",
            operator: "EQ",
            value: true,
          },
          action: { type: "SKIP" },
        },
      ];
      const questions = [
        createQuestion("q1", logic),
        createQuestion("q2"),
        createQuestion("q3"),
      ];

      expect(
        evaluateBranching(
          questions[0],
          "any",
          { harDialogmote: true },
          questions,
          0,
        ).nextIndex,
      ).toBe(2); // SKIP goes to +2
      expect(
        evaluateBranching(
          questions[0],
          "any",
          { harDialogmote: false },
          questions,
          0,
        ).nextIndex,
      ).toBe(1);
    });

    it("handles missing metadata key gracefully", () => {
      const logic: LogicRule[] = [
        {
          condition: {
            field: "METADATA",
            key: "nonexistent",
            operator: "EQ",
            value: "test",
          },
          action: { type: "JUMP_TO", targetId: "q3" },
        },
      ];
      const questions = [
        createQuestion("q1", logic),
        createQuestion("q2"),
        createQuestion("q3"),
      ];

      expect(
        evaluateBranching(questions[0], "any", {}, questions, 0).nextIndex,
      ).toBe(1);
      expect(
        evaluateBranching(questions[0], "any", undefined, questions, 0)
          .nextIndex,
      ).toBe(1);
    });
  });

  describe("action types", () => {
    it("SKIP: skips next question", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "EQ", value: "SKIP" },
          action: { type: "SKIP" },
        },
      ];
      const questions = [
        createChoiceQuestion("q1", ["SKIP", "CONTINUE"], logic),
        createQuestion("q2"),
        createQuestion("q3"),
        createQuestion("q4"),
      ];

      const result = evaluateBranching(
        questions[0],
        "SKIP",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(2); // Skips q2, goes to q3
      expect(result.triggeredByRule).toBe(true);
    });

    it("SUBMIT: returns -1 to signal submission", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "GT", value: 4 },
          action: { type: "SUBMIT" },
        },
      ];
      const questions: FlexJarQuestion[] = [
        { id: "rating", type: "rating", prompt: "Rate us", logic },
        createQuestion("q_followup"),
      ];

      const result = evaluateBranching(
        questions[0],
        5,
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(-1);
      expect(result.triggeredByRule).toBe(true);
    });
  });

  describe("rule priority", () => {
    it("first matching rule wins", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "EQ", value: "A" },
          action: { type: "JUMP_TO", targetId: "q_a" },
        },
        {
          condition: { field: "ANSWER", operator: "EQ", value: "A" }, // Same condition
          action: { type: "JUMP_TO", targetId: "q_b" }, // Different target
        },
      ];
      const questions = [
        createChoiceQuestion("q1", ["A", "B"], logic),
        createQuestion("q2"),
        createQuestion("q_a"),
        createQuestion("q_b"),
      ];

      const result = evaluateBranching(
        questions[0],
        "A",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(2); // q_a, not q_b
    });
  });

  describe("error handling", () => {
    it("ignores JUMP_TO with invalid targetId (target doesn't exist)", () => {
      const logic: LogicRule[] = [
        {
          condition: { field: "ANSWER", operator: "EQ", value: "TEST" },
          action: { type: "JUMP_TO", targetId: "nonexistent" },
        },
      ];
      const questions = [
        createChoiceQuestion("q1", ["TEST"], logic),
        createQuestion("q2"),
      ];

      const result = evaluateBranching(
        questions[0],
        "TEST",
        undefined,
        questions,
        0,
      );

      expect(result.nextIndex).toBe(1); // Falls through to default
    });
  });
});

describe("surveyHasBranchingLogic", () => {
  it("returns false for surveys without logic", () => {
    const questions = [createQuestion("q1"), createQuestion("q2")];
    expect(surveyHasBranchingLogic(questions)).toBe(false);
  });

  it("returns false for surveys with empty logic arrays", () => {
    const questions = [createQuestion("q1", []), createQuestion("q2", [])];
    expect(surveyHasBranchingLogic(questions)).toBe(false);
  });

  it("returns true for surveys with at least one logic rule", () => {
    const logic: LogicRule[] = [
      {
        condition: { field: "ANSWER", operator: "EQ", value: "YES" },
        action: { type: "SKIP" },
      },
    ];
    const questions = [createQuestion("q1", logic), createQuestion("q2")];
    expect(surveyHasBranchingLogic(questions)).toBe(true);
  });
});

describe("validateBranchingTargets", () => {
  it("returns empty array when all targets are valid", () => {
    const logic: LogicRule[] = [
      {
        condition: { field: "ANSWER", operator: "EQ", value: "YES" },
        action: { type: "JUMP_TO", targetId: "q2" },
      },
    ];
    const questions = [createQuestion("q1", logic), createQuestion("q2")];

    expect(validateBranchingTargets(questions)).toEqual([]);
  });

  it("returns invalid targetIds", () => {
    const logic: LogicRule[] = [
      {
        condition: { field: "ANSWER", operator: "EQ", value: "YES" },
        action: { type: "JUMP_TO", targetId: "nonexistent" },
      },
    ];
    const questions = [createQuestion("q1", logic), createQuestion("q2")];

    expect(validateBranchingTargets(questions)).toEqual(["nonexistent"]);
  });

  it("ignores non-JUMP_TO actions", () => {
    const logic: LogicRule[] = [
      {
        condition: { field: "ANSWER", operator: "EQ", value: "YES" },
        action: { type: "SKIP" },
      },
      {
        condition: { field: "ANSWER", operator: "EQ", value: "NO" },
        action: { type: "SUBMIT" },
      },
    ];
    const questions = [createQuestion("q1", logic)];

    expect(validateBranchingTargets(questions)).toEqual([]);
  });
});
