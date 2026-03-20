import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BranchingResult } from "../../../../core/branchingEngine.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../../core/types.js";
import { useStepNavigation } from "../useStepNavigation.js";

const ALL_HIDDEN_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "q1",
    type: "text",
    prompt: "Hidden 1",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "METADATA" as const,
      key: "show",
      operator: "EQ" as const,
      value: "yes",
    },
  },
  {
    id: "q2",
    type: "text",
    prompt: "Hidden 2",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "METADATA" as const,
      key: "show",
      operator: "EQ" as const,
      value: "yes",
    },
  },
];

// ============================================
// Fixtures
// ============================================

const LINEAR_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "q1",
    type: "singleChoice",
    prompt: "Spørsmål 1",
    required: true,
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  {
    id: "q2",
    type: "text",
    prompt: "Spørsmål 2",
    required: false,
    maxLength: 500,
  },
  {
    id: "q3",
    type: "singleChoice",
    prompt: "Spørsmål 3",
    required: true,
    options: [{ value: "x", label: "X" }],
  },
];

const BRANCHING_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "q1",
    type: "singleChoice",
    prompt: "Velg",
    required: true,
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    logic: [
      {
        condition: { field: "ANSWER", operator: "EQ", value: "a" },
        action: { type: "JUMP_TO", targetId: "q3" },
      },
      {
        condition: { field: "ANSWER", operator: "EXISTS" },
        action: { type: "SUBMIT" },
      },
    ],
  },
  {
    id: "q2",
    type: "text",
    prompt: "Spørsmål 2",
    required: true,
    maxLength: 500,
  },
  {
    id: "q3",
    type: "text",
    prompt: "Spørsmål 3",
    required: true,
    maxLength: 500,
  },
];

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

const JUMP_TO_VISIBLE_IF_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "q1",
    type: "singleChoice",
    prompt: "Steg 1",
    required: true,
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    logic: [
      {
        condition: { field: "ANSWER", operator: "EQ", value: "a" },
        action: { type: "JUMP_TO", targetId: "q2" },
      },
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
      value: "visible-q2",
    },
  },
  {
    id: "q3",
    type: "text",
    prompt: "Steg 3",
    required: false,
    maxLength: 500,
  },
];

const MULTI_CHOICE_VISIBLE_IF_QUESTIONS: LumiSurveyQuestion[] = [
  {
    id: "q1",
    type: "multiChoice",
    prompt: "Velg flere",
    required: true,
    options: [
      { value: "alpha", label: "Alpha" },
      { value: "beta", label: "Beta" },
    ],
  },
  {
    id: "q2",
    type: "text",
    prompt: "Vises kun når alpha er valgt",
    required: false,
    maxLength: 500,
    visibleIf: {
      field: "ANSWER",
      questionId: "q1",
      operator: "CONTAINS",
      value: "alpha",
    },
  },
  {
    id: "q3",
    type: "text",
    prompt: "Fallback",
    required: false,
    maxLength: 500,
  },
];

// ============================================
// Tests
// ============================================

describe("useStepNavigation", () => {
  // ------------------------------------------
  // 1. Grunnleggende navigering
  // ------------------------------------------
  describe("basic linear navigation", () => {
    it("starts at step 0", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: {},
          forceStepMode: true,
        }),
      );

      expect(result.current.currentStep).toBe(0);
      expect(result.current.currentQuestion?.id).toBe("q1");
    });

    it("goToNext advances to the next step when answer is provided", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello", q3: "x" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentStep).toBe(1);
      expect(result.current.currentQuestion?.id).toBe("q2");
    });

    it("goToPrevious goes back to the previous step", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello", q3: "x" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });
      expect(result.current.currentStep).toBe(1);

      act(() => {
        result.current.goToPrevious();
      });
      expect(result.current.currentStep).toBe(0);
    });
  });

  // ------------------------------------------
  // 2. visitedSteps deduplisering
  // ------------------------------------------
  describe("visitedSteps deduplication", () => {
    it("does not accumulate duplicates on back-and-forth navigation", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello", q3: "x" },
          forceStepMode: true,
        }),
      );

      // 0 → 1
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.visitedSteps).toEqual([0, 1]);

      // 1 → 0 (back)
      act(() => {
        result.current.goToPrevious();
      });
      expect(result.current.visitedSteps).toEqual([0]);

      // 0 → 1 again
      act(() => {
        result.current.goToNext();
      });
      // Should be [0, 1], not [0, 1, 0, 1]
      expect(result.current.visitedSteps).toEqual([0, 1]);
    });

    it("truncates visited history when revisiting an earlier step via forward navigation", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello", q3: "x" },
          forceStepMode: true,
        }),
      );

      // Navigate 0 → 1 → 2
      act(() => {
        result.current.goToNext();
      });
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.visitedSteps).toEqual([0, 1, 2]);

      // Go back to 1
      act(() => {
        result.current.goToPrevious();
      });
      expect(result.current.visitedSteps).toEqual([0, 1]);

      // Forward to 2 again – should not duplicate
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.visitedSteps).toEqual([0, 1, 2]);
    });
  });

  // ------------------------------------------
  // 3. isLastStep with branching (SUBMIT action)
  // ------------------------------------------
  describe("isLastStep with branching", () => {
    it("returns true when evaluateBranching gives SUBMIT action", () => {
      // Answer "b" on q1 → matches EXISTS rule → SUBMIT
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "b" },
        }),
      );

      // currentStep is 0, which is NOT the last index (2), but branching says SUBMIT
      expect(result.current.currentStep).toBe(0);
      expect(result.current.isLastStep).toBe(true);
    });

    it("returns false when branching gives JUMP_TO (not submit)", () => {
      // Answer "a" on q1 → matches EQ "a" → JUMP_TO q3
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "a" },
        }),
      );

      expect(result.current.currentStep).toBe(0);
      expect(result.current.isLastStep).toBe(false);
    });
  });

  // ------------------------------------------
  // 4. isLastStep without branching (lineær)
  // ------------------------------------------
  describe("isLastStep without branching", () => {
    it("returns true only on the last linear step", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello", q3: "x" },
          forceStepMode: true,
        }),
      );

      expect(result.current.isLastStep).toBe(false);

      // Navigate to step 1
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.isLastStep).toBe(false);

      // Navigate to step 2 (last)
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.isLastStep).toBe(true);
    });

    it("returns false when not on the last step", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a" },
          forceStepMode: true,
        }),
      );

      expect(result.current.currentStep).toBe(0);
      expect(result.current.isLastStep).toBe(false);
    });
  });

  // ------------------------------------------
  // 5. isStepMode with forceStepMode
  // ------------------------------------------
  describe("isStepMode with forceStepMode", () => {
    it("activates step mode even without branching logic", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: {},
          forceStepMode: true,
        }),
      );

      expect(result.current.hasBranching).toBe(false);
      expect(result.current.isStepMode).toBe(true);
    });

    it("is inactive when forceStepMode is false and no branching exists", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: {},
          forceStepMode: false,
        }),
      );

      expect(result.current.isStepMode).toBe(false);
    });

    it("is active when branching exists even without forceStepMode", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: {},
        }),
      );

      expect(result.current.hasBranching).toBe(true);
      expect(result.current.isStepMode).toBe(true);
    });
  });

  // ------------------------------------------
  // 6. canGoBack / canGoNext
  // ------------------------------------------
  describe("canGoBack and canGoNext", () => {
    it("canGoBack is false at the initial step", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a" },
          forceStepMode: true,
        }),
      );

      expect(result.current.canGoBack).toBe(false);
    });

    it("canGoBack is true after navigating forward", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.canGoBack).toBe(true);
    });

    it("canGoNext is false for a required question without an answer", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: {},
          forceStepMode: true,
        }),
      );

      // q1 is required and has no answer
      expect(result.current.canGoNext).toBe(false);
    });

    it("canGoNext is true for a required question with an answer", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a" },
          forceStepMode: true,
        }),
      );

      expect(result.current.canGoNext).toBe(true);
    });

    it("canGoNext is true for an optional question without an answer", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a" },
          forceStepMode: true,
        }),
      );

      // Navigate to q2 which is optional (required: false)
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.currentQuestion?.id).toBe("q2");

      // No answer for q2, but it's optional
      expect(result.current.canGoNext).toBe(true);
    });

    it("canGoNext is false when answer is an empty string", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "" },
          forceStepMode: true,
        }),
      );

      // q1 is required and answer is ""
      expect(result.current.canGoNext).toBe(false);
    });

    it("canGoNext is false when answer is an empty array", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: [] },
          forceStepMode: true,
        }),
      );

      // q1 is required and answer is []
      expect(result.current.canGoNext).toBe(false);
    });
  });

  // ------------------------------------------
  // 7. resetNavigation
  // ------------------------------------------
  describe("resetNavigation", () => {
    it("resets currentStep and visitedSteps", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "b" },
        }),
      );

      // isLastStep is true because branching evaluates to SUBMIT for answer "b"
      expect(result.current.isLastStep).toBe(true);

      act(() => {
        result.current.goToNext();
      });

      act(() => {
        result.current.resetNavigation();
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.visitedSteps).toEqual([0]);
    });

    it("resets after multi-step navigation", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello", q3: "x" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.currentStep).toBe(2);
      expect(result.current.visitedSteps).toEqual([0, 1, 2]);

      act(() => {
        result.current.resetNavigation();
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.visitedSteps).toEqual([0]);
    });
  });

  // ------------------------------------------
  // 8. hasBranching
  // ------------------------------------------
  describe("hasBranching", () => {
    it("returns true when survey has logic rules", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: {},
        }),
      );

      expect(result.current.hasBranching).toBe(true);
    });

    it("returns false when survey has no logic rules", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: {},
        }),
      );

      expect(result.current.hasBranching).toBe(false);
    });
  });

  // ------------------------------------------
  // 9. JUMP_TO branching
  // ------------------------------------------
  describe("JUMP_TO branching", () => {
    it("goToNext jumps to the correct step index based on logic rules", () => {
      // Answer "a" on q1 → JUMP_TO q3 (index 2)
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "a" },
        }),
      );

      expect(result.current.currentStep).toBe(0);

      act(() => {
        const branchingResult = result.current.goToNext();
        expect(branchingResult).not.toBeNull();
        expect(branchingResult?.triggeredByRule).toBe(true);
        expect(branchingResult?.nextIndex).toBe(2);
      });

      // Should jump directly to q3 (index 2), skipping q2
      expect(result.current.currentStep).toBe(2);
      expect(result.current.currentQuestion?.id).toBe("q3");
      expect(result.current.visitedSteps).toEqual([0, 2]);
    });

    it("SUBMIT action makes isLastStep true and goToNext returns nextIndex -1", () => {
      // Answer "b" on q1 → EXISTS matches → SUBMIT
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "b" },
        }),
      );

      // isLastStep should already be true (branching evaluates to SUBMIT)
      expect(result.current.isLastStep).toBe(true);

      act(() => {
        const branchingResult = result.current.goToNext();
        expect(branchingResult).not.toBeNull();
        expect(branchingResult?.nextIndex).toBe(-1);
        expect(branchingResult?.triggeredByRule).toBe(true);
      });

      // Step should remain at 0 since we didn't navigate
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe("visibleIf in step mode", () => {
    it("skips one invisible question", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: VISIBLE_IF_QUESTIONS,
          answers: { q1: "show-q3" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentQuestion?.id).toBe("q3");
    });

    it("skips multiple invisible questions in sequence", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: VISIBLE_IF_QUESTIONS,
          answers: { q1: "hide" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentStep).toBe(3);
      expect(result.current.currentQuestion?.id).toBe("q4");
    });

    it("returns submit signal when all remaining questions are invisible", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: VISIBLE_IF_QUESTIONS.slice(0, 3),
          answers: { q1: "hide" },
          forceStepMode: true,
        }),
      );

      act(() => {
        const navigation = result.current.goToNext();
        expect(navigation?.nextIndex).toBe(-1);
      });

      expect(result.current.currentStep).toBe(0);
    });

    it("scans forward when JUMP_TO targets an invisible question", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: JUMP_TO_VISIBLE_IF_QUESTIONS,
          answers: { q1: "a" },
        }),
      );

      act(() => {
        const branchingResult = result.current.goToNext();
        expect(branchingResult?.triggeredByRule).toBe(true);
      });

      expect(result.current.currentQuestion?.id).toBe("q3");
      expect(result.current.currentStep).toBe(2);
    });

    it("goToNext returns adjusted nextIndex when visibility skips questions", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: JUMP_TO_VISIBLE_IF_QUESTIONS,
          answers: { q1: "a" },
        }),
      );

      act(() => {
        const branchingResult: BranchingResult | null =
          result.current.goToNext();
        expect(branchingResult?.nextIndex).toBe(2);
      });

      // JUMP_TO targets q2 (index 1) but q2 is hidden, so actual navigation goes to q3 (index 2)
      expect(result.current.currentStep).toBe(2);
    });

    it("sets isLastStep=true when all later steps are invisible", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: VISIBLE_IF_QUESTIONS.slice(0, 3),
          answers: { q1: "hide" },
          forceStepMode: true,
        }),
      );

      expect(result.current.isLastStep).toBe(true);
    });

    it("isLastStep is true for unanswered optional question when all later steps are invisible", () => {
      const questions: LumiSurveyQuestion[] = [
        {
          id: "q1",
          type: "singleChoice",
          prompt: "Steg 1",
          required: true,
          options: [{ value: "a", label: "A" }],
        },
        {
          id: "q2",
          type: "text",
          prompt: "Steg 2 (valgfri)",
          required: false,
          maxLength: 500,
        },
        {
          id: "q3",
          type: "text",
          prompt: "Steg 3 (skjult)",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER",
            questionId: "q1",
            operator: "EQ",
            value: "show-q3",
          },
        },
      ];

      const { result } = renderHook(() =>
        useStepNavigation({
          questions,
          answers: { q1: "a" },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentQuestion?.id).toBe("q2");
      expect(result.current.isLastStep).toBe(true);
    });

    it("isLastStep is false for unanswered question when later step depends on current question", () => {
      const questions: LumiSurveyQuestion[] = [
        {
          id: "rating",
          type: "singleChoice",
          prompt: "Hvordan var opplevelsen?",
          required: false,
          options: [{ value: "5", label: "5" }],
        },
        {
          id: "feedback",
          type: "text",
          prompt: "Hva kan vi forbedre?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER",
            questionId: "rating",
            operator: "EXISTS",
          },
        },
      ];

      const { result } = renderHook(() =>
        useStepNavigation({
          questions,
          answers: {},
          forceStepMode: true,
        }),
      );

      expect(result.current.currentQuestion?.id).toBe("rating");
      expect(result.current.isLastStep).toBe(false);
    });

    it("supports CONTAINS operator for multiChoice visibleIf", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: MULTI_CHOICE_VISIBLE_IF_QUESTIONS,
          answers: { q1: ["alpha"] },
          forceStepMode: true,
        }),
      );

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentQuestion?.id).toBe("q2");
    });

    it("keeps back navigation safe when visited hidden steps", () => {
      const { result, rerender } = renderHook(
        ({ answers }) =>
          useStepNavigation({
            questions: VISIBLE_IF_QUESTIONS,
            answers,
            forceStepMode: true,
          }),
        {
          initialProps: { answers: { q1: "show", q2: "x", q3: "y" } },
        },
      );

      act(() => {
        result.current.goToNext();
      });
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.currentQuestion?.id).toBe("q4");

      rerender({ answers: { q1: "hide", q2: "x", q3: "y" } });

      act(() => {
        result.current.goToPrevious();
      });

      expect(result.current.currentQuestion?.id).toBe("q1");
      expect(result.current.currentStep).toBe(0);
    });

    it("auto-navigates when current step becomes invisible after answer changes", async () => {
      const { result, rerender } = renderHook(
        ({ answers }) =>
          useStepNavigation({
            questions: VISIBLE_IF_QUESTIONS,
            answers,
            forceStepMode: true,
          }),
        {
          initialProps: { answers: { q1: "show", q2: "text" } },
        },
      );

      act(() => {
        result.current.goToNext();
      });
      expect(result.current.currentQuestion?.id).toBe("q2");

      rerender({ answers: { q1: "hide", q2: "text" } });

      await waitFor(() => {
        expect(result.current.currentQuestion?.id).toBe("q4");
      });
    });

    it("auto-navigates to last visited step when current becomes invisible and no later steps visible", async () => {
      const questions: LumiSurveyQuestion[] = [
        {
          id: "q1",
          type: "singleChoice",
          prompt: "Steg 1",
          required: true,
          options: [
            { value: "show", label: "Vis" },
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
      ];

      const { result, rerender } = renderHook(
        ({ answers }) =>
          useStepNavigation({
            questions,
            answers,
            forceStepMode: true,
          }),
        {
          initialProps: {
            answers: {
              q1: "show",
              q2: "text",
            } as Record<string, LumiSurveyAnswerValue>,
          },
        },
      );

      // Navigate to q2
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.currentQuestion?.id).toBe("q2");

      // Change answer so q2 becomes hidden, no later steps
      rerender({
        answers: { q1: "hide", q2: "text" } as Record<
          string,
          LumiSurveyAnswerValue
        >,
      });

      await waitFor(() => {
        // Should fall back to q1 (last visited), not stay on hidden q2
        expect(result.current.currentQuestion?.id).toBe("q1");
      });
    });
  });

  // ------------------------------------------
  // onStepChange callback
  // ------------------------------------------
  describe("onStepChange callback", () => {
    it("fires onStepChange with visible step index and total visible count", () => {
      const onStepChange = vi.fn();

      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello" },
          forceStepMode: true,
          onStepChange,
        }),
      );

      // Called once on initial render (visible step 0 of 3)
      expect(onStepChange).toHaveBeenCalledWith(0, 3);

      act(() => {
        result.current.goToNext();
      });

      expect(onStepChange).toHaveBeenCalledWith(1, 3);
    });

    it("reports correct visible index when hidden questions are skipped", () => {
      const onStepChange = vi.fn();

      const { result } = renderHook(() =>
        useStepNavigation({
          questions: VISIBLE_IF_QUESTIONS,
          answers: { q1: "show-q3" },
          forceStepMode: true,
          onStepChange,
        }),
      );

      // q1 is visible (step 0 of 3 visible: q1, q3, q4)
      expect(onStepChange).toHaveBeenCalledWith(0, 3);

      act(() => {
        result.current.goToNext();
      });

      // Skips q2 (hidden), lands on q3 — visible step 1 of 3
      expect(onStepChange).toHaveBeenCalledWith(1, 3);
    });

    it("does not fire onStepChange when no questions are visible", () => {
      const onStepChange = vi.fn();

      renderHook(() =>
        useStepNavigation({
          questions: ALL_HIDDEN_QUESTIONS,
          answers: {},
          forceStepMode: true,
          onStepChange,
        }),
      );

      expect(onStepChange).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Edge cases: no visible questions
  // ------------------------------------------
  describe("no visible questions", () => {
    it("returns undefined currentQuestion when all questions are hidden", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: ALL_HIDDEN_QUESTIONS,
          answers: {},
          forceStepMode: true,
        }),
      );

      expect(result.current.currentQuestion).toBeUndefined();
      expect(result.current.currentStep).toBe(-1);
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.isLastStep).toBe(false);
    });

    it("goToNext returns null when all questions are hidden", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: ALL_HIDDEN_QUESTIONS,
          answers: {},
          forceStepMode: true,
        }),
      );

      act(() => {
        expect(result.current.goToNext()).toBeNull();
      });
    });

    it("returns undefined currentQuestion for empty questions array", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: [],
          answers: {},
          forceStepMode: true,
        }),
      );

      expect(result.current.currentQuestion).toBeUndefined();
      expect(result.current.currentStep).toBe(-1);
      expect(result.current.canGoNext).toBe(false);
    });

    it("recovers from -1 state when questions become visible", async () => {
      const { result, rerender } = renderHook(
        ({ metadata }) =>
          useStepNavigation({
            questions: ALL_HIDDEN_QUESTIONS,
            answers: {},
            metadata,
            forceStepMode: true,
          }),
        { initialProps: { metadata: {} as Record<string, unknown> } },
      );

      expect(result.current.currentStep).toBe(-1);
      expect(result.current.currentQuestion).toBeUndefined();

      // Metadata changes to make questions visible
      rerender({ metadata: { show: "yes" } });

      await waitFor(() => {
        expect(result.current.currentStep).toBe(0);
        expect(result.current.currentQuestion?.id).toBe("q1");
      });
    });

    it("transitions to -1 when all visible questions become hidden", async () => {
      const questions: LumiSurveyQuestion[] = [
        {
          id: "q1",
          type: "text",
          prompt: "Only question",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "METADATA" as const,
            key: "show",
            operator: "EQ" as const,
            value: "yes",
          },
        },
      ];

      const { result, rerender } = renderHook(
        ({ metadata }) =>
          useStepNavigation({
            questions,
            answers: {},
            metadata,
            forceStepMode: true,
          }),
        {
          initialProps: {
            metadata: { show: "yes" } as Record<string, unknown>,
          },
        },
      );

      expect(result.current.currentStep).toBe(0);
      expect(result.current.currentQuestion?.id).toBe("q1");

      // Metadata changes to hide all questions
      rerender({ metadata: { show: "no" } });

      await waitFor(() => {
        expect(result.current.currentStep).toBe(-1);
        expect(result.current.currentQuestion).toBeUndefined();
      });
    });
  });
  describe("goToNext guard", () => {
    it("returns null when required question is unanswered", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: {},
          forceStepMode: true,
        }),
      );

      expect(result.current.currentQuestion?.required).toBe(true);
      expect(result.current.canGoNext).toBe(false);

      act(() => {
        expect(result.current.goToNext()).toBeNull();
      });

      // Should not have moved
      expect(result.current.currentStep).toBe(0);
    });
  });

  // ------------------------------------------
  // Bug: progress total jumps with visibleIf
  // ------------------------------------------
  describe("progress with dynamically visible questions", () => {
    const CHAINED_QUESTIONS: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "singleChoice" as const,
        prompt: "First question",
        required: true,
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
      {
        id: "q2",
        type: "text" as const,
        prompt: "Second (visible after q1)",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EXISTS" as const,
        },
      },
      {
        id: "q3",
        type: "text" as const,
        prompt: "Third (visible after q2)",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER" as const,
          questionId: "q2",
          operator: "EXISTS" as const,
        },
      },
    ];
    const BRANCHED_QUESTIONS: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "singleChoice" as const,
        prompt: "Branch root",
        required: true,
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
      {
        id: "q2",
        type: "text" as const,
        prompt: "Branch A step 1",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EQ" as const,
          value: "a",
        },
      },
      {
        id: "q3",
        type: "text" as const,
        prompt: "Branch A step 2",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER" as const,
          questionId: "q2",
          operator: "EXISTS" as const,
        },
      },
      {
        id: "q4",
        type: "text" as const,
        prompt: "Branch B step 1",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER" as const,
          questionId: "q1",
          operator: "EQ" as const,
          value: "b",
        },
      },
    ];

    it("should not report totalSteps as 1 when only first question is visible", () => {
      const onStepChange = vi.fn();

      renderHook(() =>
        useStepNavigation({
          questions: CHAINED_QUESTIONS,
          answers: {},
          forceStepMode: true,
          onStepChange,
        }),
      );

      // Bug: onStepChange is called with (0, 1) because only q1 is visible.
      // This makes the progress bar show 100% complete on the first step.
      // Expected: totalSteps should account for questions that WILL become
      // visible as the user progresses, not just currently visible ones.
      const [, totalSteps] = onStepChange.mock.calls[0];
      expect(totalSteps).toBeGreaterThan(1);
    });

    it("should have monotonically increasing progress percentage through chained questions", () => {
      const onStepChange = vi.fn();

      const { rerender } = renderHook(
        ({ answers }: { answers: Record<string, LumiSurveyAnswerValue> }) =>
          useStepNavigation({
            questions: CHAINED_QUESTIONS,
            answers,
            forceStepMode: true,
            onStepChange,
          }),
        { initialProps: { answers: {} } },
      );

      const initialTotal = onStepChange.mock.calls[0][1];
      expect(initialTotal).toBeGreaterThan(1);

      // User answers q1 → q2 becomes visible
      rerender({ answers: { q1: "a" } });

      const calls = onStepChange.mock.calls;
      // Verify each step's percentage is >= previous
      for (let i = 1; i < calls.length; i++) {
        const [prevStep, prevTotal] = calls[i - 1];
        const [currStep, currTotal] = calls[i];
        const prevPct = (prevStep + 1) / prevTotal;
        const currPct = (currStep + 1) / currTotal;
        expect(currPct).toBeGreaterThanOrEqual(prevPct);
      }
    });

    it("should reflect actual reachable steps when user picks shorter branch", () => {
      const { result, rerender } = renderHook(
        ({ answers }: { answers: Record<string, LumiSurveyAnswerValue> }) =>
          useStepNavigation({
            questions: BRANCHED_QUESTIONS,
            answers,
            forceStepMode: true,
          }),
        { initialProps: { answers: {} } },
      );

      // Initial estimate assumes the longest reachable branch (q1 -> q2 -> q3)
      expect(result.current.totalVisibleSteps).toBe(3);

      // User picks shorter branch "b". Without HWM, estimate drops to actual path size.
      rerender({ answers: { q1: "b" } });
      expect(result.current.totalVisibleSteps).toBe(2);
    });

    it("should reflect new survey size when questions change", () => {
      const NEW_SURVEY_QUESTIONS: LumiSurveyQuestion[] = [
        {
          id: "new-q1",
          type: "text",
          prompt: "Only question in new survey",
          required: false,
          maxLength: 500,
        },
      ];

      const { result, rerender } = renderHook(
        ({
          questions,
          answers,
        }: {
          questions: LumiSurveyQuestion[];
          answers: Record<string, LumiSurveyAnswerValue>;
        }) =>
          useStepNavigation({
            questions,
            answers,
            forceStepMode: true,
          }),
        {
          initialProps: {
            questions: BRANCHED_QUESTIONS,
            answers: {},
          },
        },
      );

      expect(result.current.totalVisibleSteps).toBe(3);

      rerender({
        questions: BRANCHED_QUESTIONS,
        answers: { q1: "b" },
      });
      expect(result.current.totalVisibleSteps).toBe(2);

      rerender({
        questions: NEW_SURVEY_QUESTIONS,
        answers: {},
      });

      expect(result.current.totalVisibleSteps).toBe(1);
    });

    it("should reflect actual path size after questions change and answer updates", () => {
      const NEW_SURVEY_QUESTIONS: LumiSurveyQuestion[] = BRANCHED_QUESTIONS.map(
        (question) => ({ ...question }),
      );

      const { result, rerender } = renderHook(
        ({
          questions,
          answers,
        }: {
          questions: LumiSurveyQuestion[];
          answers: Record<string, LumiSurveyAnswerValue>;
        }) =>
          useStepNavigation({
            questions,
            answers,
            forceStepMode: true,
          }),
        {
          initialProps: {
            questions: CHAINED_QUESTIONS,
            answers: {},
          },
        },
      );

      expect(result.current.totalVisibleSteps).toBe(3);

      rerender({
        questions: NEW_SURVEY_QUESTIONS,
        answers: {},
      });
      expect(result.current.totalVisibleSteps).toBe(3);

      rerender({
        questions: NEW_SURVEY_QUESTIONS,
        answers: { q1: "b" },
      });

      expect(result.current.totalVisibleSteps).toBe(2);
    });

    it("should naturally reach 100% on the last step without isLastStep hack", () => {
      const { result, rerender } = renderHook(
        ({ answers }: { answers: Record<string, LumiSurveyAnswerValue> }) =>
          useStepNavigation({
            questions: CHAINED_QUESTIONS,
            answers,
            forceStepMode: true,
          }),
        { initialProps: { answers: {} } },
      );

      // Answer all questions and navigate to last step
      rerender({ answers: { q1: "a" } });
      act(() => {
        result.current.goToNext();
      });
      rerender({ answers: { q1: "a", q2: "b" } });
      act(() => {
        result.current.goToNext();
      });

      // On last step: visibleStepIndex + 1 should equal totalVisibleSteps
      const { visibleStepIndex, totalVisibleSteps, isLastStep } =
        result.current;
      expect(isLastStep).toBe(true);
      expect(visibleStepIndex + 1).toBe(totalVisibleSteps);
    });

    it("should reduce totalVisibleSteps when branch is definitively eliminated", () => {
      const { result, rerender } = renderHook(
        ({ answers }: { answers: Record<string, LumiSurveyAnswerValue> }) =>
          useStepNavigation({
            questions: BRANCHED_QUESTIONS,
            answers,
            forceStepMode: true,
          }),
        { initialProps: { answers: {} } },
      );

      // Before answering: estimates include longest branch
      const initialTotal = result.current.totalVisibleSteps;
      expect(initialTotal).toBe(3);

      // Answer q1 = "b" → q2 (EQ "a") is eliminated, only q3 remains
      rerender({ answers: { q1: "b" } });
      expect(result.current.totalVisibleSteps).toBe(2);
      // Total decreased because a branch was definitively eliminated
      expect(result.current.totalVisibleSteps).toBeLessThan(initialTotal);
    });

    it("should maintain monotonically increasing percentage with SM-style branching survey", () => {
      const SM_STYLE_QUESTIONS: LumiSurveyQuestion[] = [
        {
          id: "rating",
          type: "rating",
          variant: "emoji",
          prompt: "Rate",
          required: true,
        },
        {
          id: "choice",
          type: "singleChoice",
          prompt: "Choose",
          required: true,
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
            { value: "other", label: "Other" },
          ],
          visibleIf: {
            field: "ANSWER",
            questionId: "rating",
            operator: "EXISTS",
          },
        },
        {
          id: "other-detail",
          type: "text",
          prompt: "Detail",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER",
            questionId: "choice",
            operator: "EQ",
            value: "other",
          },
        },
        {
          id: "second-rating",
          type: "rating",
          variant: "emoji",
          prompt: "Rate 2",
          required: true,
          visibleIf: {
            field: "ANSWER",
            questionId: "choice",
            operator: "EXISTS",
          },
        },
        {
          id: "low-feedback",
          type: "text",
          prompt: "What was bad?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER",
            questionId: "second-rating",
            operator: "LT",
            value: 4,
          },
        },
        {
          id: "high-feedback",
          type: "text",
          prompt: "What was good?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER",
            questionId: "second-rating",
            operator: "GT",
            value: 3,
          },
        },
        {
          id: "final",
          type: "text",
          prompt: "Anything else?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER",
            questionId: "second-rating",
            operator: "EXISTS",
          },
        },
      ];

      const { result, rerender } = renderHook(
        ({ answers }: { answers: Record<string, LumiSurveyAnswerValue> }) =>
          useStepNavigation({
            questions: SM_STYLE_QUESTIONS,
            answers,
            forceStepMode: true,
          }),
        { initialProps: { answers: {} } },
      );

      // Track percentage at each step
      const percentages: number[] = [];
      const recordPercentage = () => {
        const { visibleStepIndex, totalVisibleSteps } = result.current;
        if (totalVisibleSteps > 0) {
          percentages.push((visibleStepIndex + 1) / totalVisibleSteps);
        }
      };

      // Step through the survey: rating=4, choice="a", second-rating=5, final
      recordPercentage(); // step 0

      rerender({ answers: { rating: 4 } });
      act(() => {
        result.current.goToNext();
      });
      recordPercentage(); // step 1

      rerender({ answers: { rating: 4, choice: "a" } });
      act(() => {
        result.current.goToNext();
      });
      recordPercentage(); // step 2 (other-detail skipped, second-rating)

      rerender({ answers: { rating: 4, choice: "a", "second-rating": 5 } });
      act(() => {
        result.current.goToNext();
      });
      recordPercentage(); // step 3 (high-feedback)

      rerender({
        answers: {
          rating: 4,
          choice: "a",
          "second-rating": 5,
          "high-feedback": "great",
        },
      });
      act(() => {
        result.current.goToNext();
      });
      recordPercentage(); // step 4 (final)

      // Verify monotonically increasing percentages
      for (let i = 1; i < percentages.length; i++) {
        expect(
          percentages[i],
          `Percentage decreased at step ${i}: ${(percentages[i - 1] * 100).toFixed(1)}% → ${(percentages[i] * 100).toFixed(1)}%`,
        ).toBeGreaterThanOrEqual(percentages[i - 1]);
      }

      // Verify last step reaches 100%
      expect(percentages[percentages.length - 1]).toBeCloseTo(1.0);
    });

    /**
     * Real-world reproduction: survey with deep chained visibleIf (like
     * oppfølgingsplan medvirkning-survey). 10 questions where each step
     * depends on the previous answer via EXISTS, plus conditional branches
     * (LT/GT on rating, EQ on singleChoice).
     *
     * The progress bar starts at 100%, jumps to 50%, then oscillates as
     * conditional text fields appear and disappear.
     */
    it("should handle real-world survey with deep chained visibleIf correctly", () => {
      const REAL_WORLD_SURVEY: LumiSurveyQuestion[] = [
        {
          id: "opplevelse",
          type: "rating" as const,
          variant: "emoji" as const,
          prompt: "Hvordan opplevde du å lage planen?",
          required: true,
        },
        {
          id: "samarbeid",
          type: "singleChoice" as const,
          prompt: "Hvordan var samarbeidet?",
          required: true,
          options: [
            { value: "sammen", label: "Sammen" },
            { value: "snakket", label: "Snakket" },
            { value: "uten-meg", label: "Uten meg" },
            { value: "annet", label: "Annet" },
          ],
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "opplevelse",
            operator: "EXISTS" as const,
          },
        },
        {
          id: "samarbeid-annet",
          type: "text" as const,
          prompt: "Fortell mer",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "samarbeid",
            operator: "EQ" as const,
            value: "annet",
          },
        },
        {
          id: "behov",
          type: "rating" as const,
          variant: "emoji" as const,
          prompt: "Tar planen opp det viktige?",
          required: true,
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "samarbeid",
            operator: "EXISTS" as const,
          },
        },
        {
          id: "hva-savner-du",
          type: "text" as const,
          prompt: "Hva savner du?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "behov",
            operator: "LT" as const,
            value: 4,
          },
        },
        {
          id: "hva-fungerer",
          type: "text" as const,
          prompt: "Hva fungerer bra?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "behov",
            operator: "GT" as const,
            value: 3,
          },
        },
        {
          id: "deling-kunnskap",
          type: "singleChoice" as const,
          prompt: "Visste du om delingen?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "nei", label: "Nei" },
          ],
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "behov",
            operator: "EXISTS" as const,
          },
        },
        {
          id: "deling-holdning",
          type: "singleChoice" as const,
          prompt: "Hvor greit er dette?",
          required: true,
          options: [
            { value: "helt-greit", label: "Helt greit" },
            { value: "ikke-greit", label: "Ikke greit" },
          ],
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "deling-kunnskap",
            operator: "EXISTS" as const,
          },
        },
        {
          id: "forbedring",
          type: "singleChoice" as const,
          prompt: "Hva ville vært viktigst?",
          required: false,
          options: [
            { value: "lese", label: "Kunne lese først" },
            { value: "ingen", label: "Ingen endring" },
          ],
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "deling-holdning",
            operator: "EXISTS" as const,
          },
        },
        {
          id: "annet",
          type: "text" as const,
          prompt: "Noe annet?",
          required: false,
          maxLength: 500,
          visibleIf: {
            field: "ANSWER" as const,
            questionId: "deling-holdning",
            operator: "EXISTS" as const,
          },
        },
      ];

      const onStepChange = vi.fn();

      const { rerender } = renderHook(
        ({ answers }: { answers: Record<string, LumiSurveyAnswerValue> }) =>
          useStepNavigation({
            questions: REAL_WORLD_SURVEY,
            answers,
            forceStepMode: true,
            onStepChange,
          }),
        { initialProps: { answers: {} } },
      );

      // Step 1: Only "opplevelse" is visible. Bug: totalSteps = 1 → 100%
      const [, initialTotal] = onStepChange.mock.calls[0];
      expect(initialTotal).toBeGreaterThan(1);

      // Simulate user progressing through the survey
      const progressPercentages: number[] = [];
      const initialCall =
        onStepChange.mock.calls[onStepChange.mock.calls.length - 1];
      progressPercentages.push((initialCall[0] + 1) / initialCall[1]);

      // Answer opplevelse → samarbeid appears
      rerender({ answers: { opplevelse: 4 } });
      let lastCall =
        onStepChange.mock.calls[onStepChange.mock.calls.length - 1];
      progressPercentages.push((lastCall[0] + 1) / lastCall[1]);

      // Answer samarbeid → behov appears
      rerender({ answers: { opplevelse: 4, samarbeid: "sammen" } });
      lastCall = onStepChange.mock.calls[onStepChange.mock.calls.length - 1];
      progressPercentages.push((lastCall[0] + 1) / lastCall[1]);

      // Answer behov with high rating → hva-fungerer + deling-kunnskap appear
      rerender({
        answers: { opplevelse: 4, samarbeid: "sammen", behov: 5 },
      });
      lastCall = onStepChange.mock.calls[onStepChange.mock.calls.length - 1];
      progressPercentages.push((lastCall[0] + 1) / lastCall[1]);

      // Progress percentage should never decrease
      for (let i = 1; i < progressPercentages.length; i++) {
        expect(
          progressPercentages[i],
          `Progress decreased from ${(progressPercentages[i - 1] * 100).toFixed(1)}% to ${(progressPercentages[i] * 100).toFixed(1)}% at step ${i}`,
        ).toBeGreaterThanOrEqual(progressPercentages[i - 1]);
      }
    });
  });
});
