import { describe, expect, it } from "vitest";
import { evaluateVisibility } from "../../core/evaluateVisibility";
import { createTopTasksSurvey } from "../index";

describe("createTopTasksSurvey", () => {
  it("uses visibleIf to show otherTask only when task is 'other'", () => {
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

    expect(survey.questions.every((question) => !question.logic)).toBe(true);
    expect(otherTaskQuestion.visibleIf).toEqual({
      questionId: "task",
      operator: "EQ",
      value: "other",
    });
    expect(
      evaluateVisibility(otherTaskQuestion.visibleIf, { task: "t1" }),
    ).toBe(false);
    expect(
      evaluateVisibility(otherTaskQuestion.visibleIf, { task: "other" }),
    ).toBe(true);
  });

  it("guards blocker visibility until taskSuccess exists and is not 'yes'", () => {
    const survey = createTopTasksSurvey({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
      includeOtherTask: true,
      includeBlockerQuestion: true,
    });

    const blockerQuestion = survey.questions.find(
      (question) => question.id === "blocker",
    );

    expect(blockerQuestion?.visibleIf).toEqual({
      all: [
        { questionId: "taskSuccess", operator: "EXISTS" },
        { questionId: "taskSuccess", operator: "NEQ", value: "yes" },
      ],
    });
    expect(evaluateVisibility(blockerQuestion?.visibleIf, {})).toBe(false);
    expect(
      evaluateVisibility(blockerQuestion?.visibleIf, { taskSuccess: "yes" }),
    ).toBe(false);
    expect(
      evaluateVisibility(blockerQuestion?.visibleIf, {
        taskSuccess: "partial",
      }),
    ).toBe(true);
  });
});
