import { describe, expect, it } from "vitest";
import { evaluateBranching } from "../../core/branchingEngine";
import { createTopTasksSurvey } from "../index";

describe("createTopTasksSurvey", () => {
  it("uses SKIP to bypass otherTask when task is not 'other'", () => {
    const survey = createTopTasksSurvey({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
      includeOtherTask: true,
      includeBlockerQuestion: true,
    });

    const [taskQuestion, otherTaskQuestion, taskSuccessQuestion] =
      survey.questions;

    expect(taskQuestion.id).toBe("task");
    expect(otherTaskQuestion.id).toBe("otherTask");
    expect(taskSuccessQuestion.id).toBe("taskSuccess");

    expect(taskQuestion.logic?.[0]?.action.type).toBe("SKIP");

    const result = evaluateBranching(
      taskQuestion,
      "t1",
      undefined,
      survey.questions,
      0,
    );

    // SKIP should take us from index 0 -> index 2
    expect(result.nextIndex).toBe(2);
    expect(result.triggeredByRule).toBe(true);
  });

  it("does not skip otherTask when task is 'other'", () => {
    const survey = createTopTasksSurvey({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
      includeOtherTask: true,
      includeBlockerQuestion: true,
    });

    const taskQuestion = survey.questions[0];

    const result = evaluateBranching(
      taskQuestion,
      "other",
      undefined,
      survey.questions,
      0,
    );

    // No rule match; defaults to next question (otherTask at index 1)
    expect(result.nextIndex).toBe(1);
    expect(result.triggeredByRule).toBe(false);
  });
});
