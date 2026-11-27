import { describe, expect, it } from "vitest";
import type {
  SurveyDocumentV1,
  SurveyQuestionV1,
} from "../../components/surveyTypes.js";
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
  it("reads the questions of a SurveyDocumentV1 as they are, also metadata that only has to exist", () => {
    const document: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "page",
          questions: [
            {
              id: "tagged",
              type: "text",
              prompt: "Hvordan var resultatlisten?",
              visibleIf: {
                field: "METADATA",
                key: "placement",
                operator: "EXISTS",
              },
            },
          ],
        },
      ],
    };
    const questions = document.pages.flatMap((page) => page.questions);
    const shown: SurveyQuestionV1[] = resolveDocumentVisibility(
      questions,
      {},
      {
        placement: "under-listen",
      },
    ).visibleQuestions;
    expect(shown).toEqual(questions);
    expect(
      resolveDocumentVisibility(questions, {}, {}).visibleQuestionIds.size,
    ).toBe(0);
  });

  it("takes a question id or a metadata key that every object inherits for no answer", () => {
    const questions = [
      question("constructor"),
      question("toString"),
      question("follows", { questionId: "constructor", operator: "EXISTS" }),
      question("tagged", {
        field: "METADATA",
        key: "hasOwnProperty",
        operator: "EXISTS",
        value: "",
      }),
      question("__proto__"),
      question("follows-proto", {
        questionId: "__proto__",
        operator: "EXISTS",
      }),
    ];
    const unanswered = resolveDocumentVisibility(questions, {}, {});
    expect(unanswered.visibleQuestions.map(({ id }) => id)).toEqual([
      "constructor",
      "toString",
      "__proto__",
    ]);
    expect(Object.keys(unanswered.visibleAnswers)).toEqual([]);

    const answers = JSON.parse('{"constructor":"ja","__proto__":"ja"}');
    const answered = resolveDocumentVisibility(questions, answers, {
      hasOwnProperty: "yes",
    });
    expect(answered.visibleQuestions.map(({ id }) => id)).toEqual([
      "constructor",
      "toString",
      "follows",
      "tagged",
      "__proto__",
      "follows-proto",
    ]);
    expect(Object.keys(answered.visibleAnswers)).toEqual([
      "constructor",
      "__proto__",
    ]);
  });

  it("gives back only answers: a question without one gives undefined, whatever its id", () => {
    const { visibleAnswers } = resolveDocumentVisibility(
      [question("constructor"), question("toString"), question("svar")],
      { svar: "ja" },
    );
    expect(visibleAnswers.constructor).toBeUndefined();
    expect(visibleAnswers.toString).toBeUndefined();
    expect(visibleAnswers.svar).toBe("ja");
    expect(Object.getPrototypeOf(visibleAnswers)).toBeNull();
    // It is still a plain object to read and send on.
    expect(JSON.stringify(visibleAnswers)).toBe('{"svar":"ja"}');
    expect({ ...visibleAnswers }).toEqual({ svar: "ja" });
  });
});
