import { describe, expect, it } from "vitest";
import { getMockTopTasksStats as getMonolithicTopTasksStats } from "~/mock/stats";
import { getMockTopTasksStats } from "~/mock/stats/topTasks";
import type { FeedbackDto } from "~/types/api";

function topTaskFeedback(
  id: string,
  submittedAt: string,
  taskLabel: string,
): FeedbackDto {
  return {
    id,
    submittedAt,
    app: "test-app",
    surveyId: "top-tasks-test",
    surveyType: "topTasks",
    sensitiveDataRedacted: false,
    answers: [
      {
        fieldId: "task",
        fieldType: "SINGLE_CHOICE",
        question: {
          label: "Hva skulle du gjøre?",
          options: [{ id: "apply", label: taskLabel }],
        },
        value: { type: "singleChoice", selectedOptionId: "apply" },
      },
      {
        fieldId: "success",
        fieldType: "SINGLE_CHOICE",
        question: {
          label: "Fikk du gjort det?",
          options: [
            { id: "yes", label: "Ja" },
            { id: "partial", label: "Delvis" },
            { id: "no", label: "Nei" },
          ],
        },
        value: { type: "singleChoice", selectedOptionId: "yes" },
      },
    ],
  };
}

describe("mock Top Tasks identity", () => {
  it("groups by option id and keeps the newest displayed label", () => {
    for (const getStats of [getMockTopTasksStats, getMonolithicTopTasksStats]) {
      const result = getStats(
        [
          topTaskFeedback("old", "2025-10-26T02:30:00+02:00", "Søke"),
          topTaskFeedback("new", "2025-10-26T02:15:00+01:00", "Sende søknad"),
        ],
        new URLSearchParams(),
      );

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]).toMatchObject({
        taskId: "apply",
        task: "Sende søknad",
        totalCount: 2,
        successCount: 2,
      });
    }
  });
});
