import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LumiSurveyQuestion } from "../../../../core/types.js";
import { useStepNavigation } from "../useStepNavigation.js";

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
      expect(result.current.currentQuestion.id).toBe("q1");
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
      expect(result.current.currentQuestion.id).toBe("q2");
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
      expect(result.current.currentQuestion.id).toBe("q2");

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
    it("resets currentStep, visitedSteps, and shouldSubmit", () => {
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "b" },
        }),
      );

      // Navigate so shouldSubmit is set
      act(() => {
        result.current.goToNext();
      });
      expect(result.current.shouldSubmit).toBe(true);

      act(() => {
        result.current.resetNavigation();
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.visitedSteps).toEqual([0]);
      expect(result.current.shouldSubmit).toBe(false);
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
      expect(result.current.currentQuestion.id).toBe("q3");
      expect(result.current.visitedSteps).toEqual([0, 2]);
    });

    it("SUBMIT action sets shouldSubmit and returns nextIndex -1", () => {
      // Answer "b" on q1 → EXISTS matches → SUBMIT
      const { result } = renderHook(() =>
        useStepNavigation({
          questions: BRANCHING_QUESTIONS,
          answers: { q1: "b" },
        }),
      );

      act(() => {
        const branchingResult = result.current.goToNext();
        expect(branchingResult).not.toBeNull();
        expect(branchingResult?.nextIndex).toBe(-1);
        expect(branchingResult?.triggeredByRule).toBe(true);
      });

      expect(result.current.shouldSubmit).toBe(true);
      // Step should remain at 0 since we didn't navigate
      expect(result.current.currentStep).toBe(0);
    });
  });

  // ------------------------------------------
  // onStepChange callback
  // ------------------------------------------
  describe("onStepChange callback", () => {
    it("fires onStepChange when step changes in step mode", () => {
      const onStepChange = vi.fn();

      const { result } = renderHook(() =>
        useStepNavigation({
          questions: LINEAR_QUESTIONS,
          answers: { q1: "a", q2: "hello" },
          forceStepMode: true,
          onStepChange,
        }),
      );

      // Called once on initial render (step 0)
      expect(onStepChange).toHaveBeenCalledWith(0, 3);

      act(() => {
        result.current.goToNext();
      });

      expect(onStepChange).toHaveBeenCalledWith(1, 3);
    });
  });
});
