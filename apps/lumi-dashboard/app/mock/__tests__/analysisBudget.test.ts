import { SPECIALIZED_SURVEY_FIELD_IDS } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import {
  assertMockAnalysisBudget,
  MOCK_ANALYSIS_BUDGET,
  MOCK_ANALYSIS_BUDGET_SURVEY_ID,
  usesInMemoryFeedbackFilters,
} from "~/mock/analysisBudget";
import { createContext, createSingleChoiceAnswer } from "~/mock/helpers";
import { isAnalysisBudgetError } from "~/utils/analysisBudget";

const TASKS = [
  { id: "lage-oppfolgingsplan", label: "Lage oppfølgingsplan" },
  { id: "forberede-dialogmote", label: "Forberede dialogmøte" },
];

/** Like the E2E fixture: an answer every other day, the tasks taking turns. */
const answers = Array.from({ length: 45 }, (_, index) => {
  const submittedAt = new Date(Date.UTC(2026, 9, 22, 10));
  submittedAt.setUTCDate(submittedAt.getUTCDate() - index * 2);
  return {
    id: `analysegrense-${index + 1}`,
    submittedAt: submittedAt.toISOString(),
    app: "syfo-oppfolgingsplan-frontend",
    surveyId: MOCK_ANALYSIS_BUDGET_SURVEY_ID,
    surveyType: "topTasks" as const,
    context: createContext("/syk/oppfolgingsplaner", "desktop"),
    answers: [
      createSingleChoiceAnswer(
        SPECIALIZED_SURVEY_FIELD_IDS.task,
        "Hva prøvde du å gjøre?",
        TASKS[index % 2].id,
        undefined,
        TASKS,
      ),
    ],
    sensitiveDataRedacted: false,
  };
});

function refuses(filters: Parameters<typeof assertMockAnalysisBudget>[1]) {
  try {
    assertMockAnalysisBudget(answers, filters);
    return false;
  } catch (error) {
    expect(isAnalysisBudgetError(error)).toBe(true);
    return true;
  }
}

const LAST_90_DAYS = {
  surveyId: MOCK_ANALYSIS_BUDGET_SURVEY_ID,
  fromDate: "2026-07-25",
  toDate: "2026-10-22",
};

describe("assertMockAnalysisBudget", () => {
  it("refuses 90 days of the fixture survey and allows the last 30", () => {
    expect(answers.length).toBeGreaterThan(MOCK_ANALYSIS_BUDGET);
    expect(refuses(LAST_90_DAYS)).toBe(true);
    expect(refuses({ ...LAST_90_DAYS, fromDate: "2026-09-23" })).toBe(false);
  });

  it("counts only the answers left after the SQL filters", () => {
    expect(refuses({ ...LAST_90_DAYS, task: "lage-oppfolgingsplan" })).toBe(
      false,
    );
    expect(refuses({ ...LAST_90_DAYS, deviceType: "mobile" })).toBe(false);
    expect(refuses({ ...LAST_90_DAYS, app: "dialogmote-frontend" })).toBe(
      false,
    );
  });

  it("treats a task with only spaces as no task", () => {
    expect(refuses({ ...LAST_90_DAYS, task: " " })).toBe(true);
  });

  it("leaves other surveys alone", () => {
    expect(refuses({ ...LAST_90_DAYS, surveyId: "survey-top-tasks" })).toBe(
      false,
    );
  });
});

describe("usesInMemoryFeedbackFilters", () => {
  it("is true for a task, theme or phrase filter with text", () => {
    expect(usesInMemoryFeedbackFilters({ task: "a" })).toBe(true);
    expect(usesInMemoryFeedbackFilters({ theme: "b" })).toBe(true);
    expect(usesInMemoryFeedbackFilters({ phrase: "felt:to ord" })).toBe(true);
    expect(usesInMemoryFeedbackFilters({ task: " ", theme: "  " })).toBe(false);
  });
});
