import { describe, expect, it } from "vitest";
import { resolveDocumentVisibility } from "../documentVisibility.js";
import { getVisibleQuestions } from "../evaluateVisibility.js";
import type { LumiSurveyQuestion, VisibleIfCondition } from "../types.js";

const question = (
  id: string,
  visibleIf?: VisibleIfCondition,
): LumiSurveyQuestion => ({
  id,
  type: "text",
  prompt: id,
  visibleIf,
});
const branch = { questionId: "root", operator: "EQ", value: "open" } as const;
const exists = { questionId: "branch", operator: "EXISTS" } as const;
const negative = {
  questionId: "branch",
  operator: "NEQ",
  value: "no",
} as const;

describe("document visibility", () => {
  it("closes nested branches without destroying cached answers", () => {
    const questions = [
      question("root"),
      question("branch", branch),
      question("child", exists),
      question("grandchild", { questionId: "child", operator: "EXISTS" }),
    ];
    const answers = {
      root: "closed",
      branch: "yes",
      child: "cached",
      grandchild: "cached too",
    };
    expect(
      resolveDocumentVisibility(questions, answers).visibleAnswers,
    ).toEqual({ root: "closed" });
    expect(
      resolveDocumentVisibility(questions, { ...answers, root: "open" })
        .visibleQuestions,
    ).toEqual(questions);
    expect(answers.child).toBe("cached");
    // The legacy helper deliberately retains its existing flat semantics.
    expect(getVisibleQuestions(questions, answers).map(({ id }) => id)).toEqual(
      ["root", "child", "grandchild"],
    );
  });

  it("distinguishes hidden sources from visible unanswered sources for NEQ", () => {
    const questions = [
      question("root"),
      question("branch", branch),
      question("negative", negative),
    ];
    expect(
      resolveDocumentVisibility(questions, {
        root: "closed",
        branch: "yes",
      }).visibleQuestions.map(({ id }) => id),
    ).toEqual(["root"]);
    expect(
      resolveDocumentVisibility(questions, {
        root: "open",
      }).visibleQuestions.map(({ id }) => id),
    ).toEqual(["root", "branch", "negative"]);
  });

  it("evaluates hidden references per leaf without disabling valid any alternatives", () => {
    const metadata = {
      field: "METADATA",
      key: "audience",
      operator: "EQ",
      value: "employer",
    } as const;
    const questions = [
      question("root"),
      question("branch", branch),
      question("anyAnswer", {
        any: [exists, { questionId: "root", operator: "EQ", value: "closed" }],
      }),
      question("anyMetadata", { any: [negative, metadata] }),
      question("allMetadata", { all: [negative, metadata] }),
      question("metadataOnly", metadata),
    ];
    expect(
      resolveDocumentVisibility(
        questions,
        { root: "closed", branch: "cached" },
        { audience: "employer" },
      ).visibleQuestions.map(({ id }) => id),
    ).toEqual(["root", "anyAnswer", "anyMetadata", "metadataOnly"]);
  });
});
