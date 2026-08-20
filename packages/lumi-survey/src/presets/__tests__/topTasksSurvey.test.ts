import { describe, expect, it } from "vitest";
import { evaluateVisibility } from "../../core/evaluateVisibility";
import type { VisibleIfCondition } from "../../core/types";
import { createTopTasksSurveyDocument } from "../index";

describe("createTopTasksSurveyDocument", () => {
  it("uses visibleIf to show otherTask only when task is 'other'", () => {
    const survey = createTopTasksSurveyDocument({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
      includeOtherTask: true,
      includeBlockerQuestion: true,
    });

    const questions = survey.pages.flatMap((page) => page.questions);
    const [taskQuestion, otherTaskQuestion, successQuestion] = questions;

    expect(taskQuestion.id).toBe("task");
    expect(otherTaskQuestion.id).toBe("otherTask");
    expect(successQuestion.id).toBe("success");

    expect(questions.every((question) => !("logic" in question))).toBe(true);
    expect(otherTaskQuestion.visibleIf).toEqual({
      questionId: "task",
      operator: "EQ",
      value: "other",
    });
    expect(
      evaluateVisibility(otherTaskQuestion.visibleIf as VisibleIfCondition, {
        task: "t1",
      }),
    ).toBe(false);
    expect(
      evaluateVisibility(otherTaskQuestion.visibleIf as VisibleIfCondition, {
        task: "other",
      }),
    ).toBe(true);
  });

  it("guards blocker visibility until success exists and is not 'yes'", () => {
    const survey = createTopTasksSurveyDocument({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
      includeOtherTask: true,
      includeBlockerQuestion: true,
    });

    const blockerQuestion = survey.pages
      .flatMap((page) => page.questions)
      .find((question) => question.id === "blocker");

    expect(blockerQuestion?.visibleIf).toEqual({
      all: [
        { questionId: "success", operator: "EXISTS" },
        { questionId: "success", operator: "NEQ", value: "yes" },
      ],
    });
    expect(
      evaluateVisibility(blockerQuestion?.visibleIf as VisibleIfCondition, {}),
    ).toBe(false);
    expect(
      evaluateVisibility(blockerQuestion?.visibleIf as VisibleIfCondition, {
        success: "yes",
      }),
    ).toBe(false);
    expect(
      evaluateVisibility(blockerQuestion?.visibleIf as VisibleIfCondition, {
        success: "partial",
      }),
    ).toBe(true);
  });
});
