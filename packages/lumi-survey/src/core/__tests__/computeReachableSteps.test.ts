import { describe, expect, it } from "vitest";
import { computeReachableSteps } from "../computeReachableSteps";
import type { LumiSurveyQuestion } from "../types";

describe("computeReachableSteps", () => {
  it("returns all questions for a linear survey", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "text", prompt: "Q1" },
      { id: "q2", type: "text", prompt: "Q2" },
      { id: "q3", type: "text", prompt: "Q3" },
    ];

    expect(computeReachableSteps(questions, {})).toBe(questions.length);
  });

  it("counts a simple EXISTS-chain as reachable without answers", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "text", prompt: "Q1" },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        visibleIf: { field: "ANSWER", questionId: "q1", operator: "EXISTS" },
      },
      {
        id: "q3",
        type: "text",
        prompt: "Q3",
        visibleIf: { field: "ANSWER", questionId: "q2", operator: "EXISTS" },
      },
    ];

    expect(computeReachableSteps(questions, {})).toBe(3);
  });

  it("counts max one branch per unanswered parent", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "text", prompt: "Q1" },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "a",
        },
      },
      {
        id: "q3",
        type: "text",
        prompt: "Q3",
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "b",
        },
      },
      { id: "q4", type: "text", prompt: "Q4" },
    ];

    expect(computeReachableSteps(questions, {})).toBe(3);
  });

  it("treats METADATA conditions as reachable", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "text",
        prompt: "Q1",
        visibleIf: {
          field: "METADATA",
          key: "role",
          operator: "EQ",
          value: "admin",
        },
      },
    ];

    expect(computeReachableSteps(questions, {}, { role: "user" })).toBe(1);
  });

  it("treats missing questionId as reachable", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "text",
        prompt: "Q1",
        visibleIf: {
          field: "ANSWER",
          operator: "EQ",
          value: "x",
        },
      },
    ];

    expect(computeReachableSteps(questions, {})).toBe(1);
  });

  it("terminates on cycles", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "q1",
        type: "text",
        prompt: "Q1",
        visibleIf: {
          field: "ANSWER",
          questionId: "q2",
          operator: "EQ",
          value: "yes",
        },
      },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "yes",
        },
      },
    ];

    const result = computeReachableSteps(questions, {});
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(questions.length);
  });

  it("evaluates normally when parent answer is present", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "text", prompt: "Q1" },
      {
        id: "q2",
        type: "text",
        prompt: "Q2",
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "a",
        },
      },
      {
        id: "q3",
        type: "text",
        prompt: "Q3",
        visibleIf: {
          field: "ANSWER",
          questionId: "q1",
          operator: "EQ",
          value: "b",
        },
      },
    ];

    expect(computeReachableSteps(questions, { q1: "a" })).toBe(2);
    expect(computeReachableSteps(questions, { q1: "b" })).toBe(2);
  });

  it("returns 0 for empty question array", () => {
    expect(computeReachableSteps([], {})).toBe(0);
  });

  it("counts a group-gated question as reachable (overestimate)", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "rating", prompt: "Rate", required: true },
      {
        id: "q2",
        type: "text",
        prompt: "Why?",
        visibleIf: {
          any: [
            { field: "ANSWER", questionId: "q1", operator: "EQ", value: 1 },
          ],
        },
      },
    ];
    // No answers yet: a group-gated question is treated as reachable.
    expect(computeReachableSteps(questions, {})).toBe(2);
  });

  it("excludes a group-gated question once answers falsify its group (#333)", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "q1", type: "rating", prompt: "Rate", required: true },
      {
        id: "q2",
        type: "text",
        prompt: "low",
        visibleIf: {
          any: [
            { field: "ANSWER", questionId: "q1", operator: "EQ", value: 1 },
          ],
        },
      },
      {
        id: "q3",
        type: "text",
        prompt: "high",
        visibleIf: {
          any: [
            { field: "ANSWER", questionId: "q1", operator: "EQ", value: 5 },
          ],
        },
      },
    ];
    // q1=1 → q2's group is true, q3's group is false. The old unconditional
    // overestimate counted both (3); resolved groups are now evaluated.
    expect(computeReachableSteps(questions, { q1: 1 })).toBe(2);
    expect(computeReachableSteps(questions, { q1: 5 })).toBe(2);
    // Still unresolved (no answer): both overestimated as reachable.
    expect(computeReachableSteps(questions, {})).toBe(3);
  });

  it("handles METADATA and all-group edge cases (#333)", () => {
    // A METADATA leaf keeps the group overestimated even when the answer leaf is
    // falsified, because metadata may arrive/change later.
    const withMeta: LumiSurveyQuestion[] = [
      { id: "q1", type: "rating", prompt: "Rate", required: true },
      {
        id: "q2",
        type: "text",
        prompt: "m",
        visibleIf: {
          any: [
            { field: "METADATA", key: "role", operator: "EQ", value: "admin" },
            { field: "ANSWER", questionId: "q1", operator: "EQ", value: 1 },
          ],
        },
      },
    ];
    expect(computeReachableSteps(withMeta, { q1: 2 }, { role: "user" })).toBe(
      2,
    );

    // all-group is evaluated once the referenced answer is present.
    const allGroup: LumiSurveyQuestion[] = [
      { id: "q1", type: "rating", prompt: "Rate", required: true },
      {
        id: "q2",
        type: "text",
        prompt: "a",
        visibleIf: {
          all: [
            { field: "ANSWER", questionId: "q1", operator: "GT", value: 2 },
            { field: "ANSWER", questionId: "q1", operator: "LT", value: 4 },
          ],
        },
      },
    ];
    expect(computeReachableSteps(allGroup, { q1: 3 })).toBe(2); // 2 < 3 < 4
    expect(computeReachableSteps(allGroup, { q1: 5 })).toBe(1); // 5 not < 4
  });

  it("does not count a group whose referenced parent is unreachable (#333)", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "gate",
        type: "singleChoice",
        prompt: "Gate",
        options: [{ value: "show", label: "s" }],
      },
      {
        id: "parent",
        type: "singleChoice",
        prompt: "Parent",
        options: [{ value: "yes", label: "y" }],
        visibleIf: {
          field: "ANSWER",
          questionId: "gate",
          operator: "EQ",
          value: "show",
        },
      },
      {
        id: "child",
        type: "text",
        prompt: "Child",
        visibleIf: {
          any: [
            {
              field: "ANSWER",
              questionId: "parent",
              operator: "EQ",
              value: "yes",
            },
          ],
        },
      },
    ];
    // gate=hide → parent unreachable → child's group can never be true. The old
    // overestimate counted child (2); now only `gate` counts.
    expect(computeReachableSteps(questions, { gate: "hide" })).toBe(1);
    // gate=show → parent reachable (still unanswered) → child stays a reachable
    // overestimate.
    expect(computeReachableSteps(questions, { gate: "show" })).toBe(3);
  });

  it("returns a realistic estimate for a real-world survey", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "opplevelse",
        type: "rating",
        variant: "emoji",
        prompt: "Hvordan opplevde du å lage planen?",
        required: true,
      },
      {
        id: "samarbeid",
        type: "singleChoice",
        prompt: "Hvordan var samarbeidet?",
        required: true,
        options: [
          { value: "sammen", label: "Sammen" },
          { value: "snakket", label: "Snakket" },
          { value: "uten-meg", label: "Uten meg" },
          { value: "annet", label: "Annet" },
        ],
        visibleIf: {
          field: "ANSWER",
          questionId: "opplevelse",
          operator: "EXISTS",
        },
      },
      {
        id: "samarbeid-annet",
        type: "text",
        prompt: "Fortell mer",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "samarbeid",
          operator: "EQ",
          value: "annet",
        },
      },
      {
        id: "behov",
        type: "rating",
        variant: "emoji",
        prompt: "Tar planen opp det viktige?",
        required: true,
        visibleIf: {
          field: "ANSWER",
          questionId: "samarbeid",
          operator: "EXISTS",
        },
      },
      {
        id: "hva-savner-du",
        type: "text",
        prompt: "Hva savner du?",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "behov",
          operator: "LT",
          value: 4,
        },
      },
      {
        id: "hva-fungerer",
        type: "text",
        prompt: "Hva fungerer bra?",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "behov",
          operator: "GT",
          value: 3,
        },
      },
      {
        id: "deling-kunnskap",
        type: "singleChoice",
        prompt: "Visste du om delingen?",
        required: true,
        options: [
          { value: "ja", label: "Ja" },
          { value: "nei", label: "Nei" },
        ],
        visibleIf: { field: "ANSWER", questionId: "behov", operator: "EXISTS" },
      },
      {
        id: "deling-holdning",
        type: "singleChoice",
        prompt: "Hvor greit er dette?",
        required: true,
        options: [
          { value: "helt-greit", label: "Helt greit" },
          { value: "ikke-greit", label: "Ikke greit" },
        ],
        visibleIf: {
          field: "ANSWER",
          questionId: "deling-kunnskap",
          operator: "EXISTS",
        },
      },
      {
        id: "forbedring",
        type: "singleChoice",
        prompt: "Hva ville vært viktigst?",
        required: false,
        options: [
          { value: "lese", label: "Kunne lese først" },
          { value: "ingen", label: "Ingen endring" },
        ],
        visibleIf: {
          field: "ANSWER",
          questionId: "deling-holdning",
          operator: "EXISTS",
        },
      },
      {
        id: "annet",
        type: "text",
        prompt: "Noe annet?",
        required: false,
        maxLength: 500,
        visibleIf: {
          field: "ANSWER",
          questionId: "deling-holdning",
          operator: "EXISTS",
        },
      },
    ];

    const estimate = computeReachableSteps(questions, {});

    expect(estimate).toBeGreaterThan(1);
    expect(estimate).toBeGreaterThanOrEqual(7);
    expect(estimate).toBeLessThanOrEqual(9);
  });
});
