import { describe, expect, it } from "vitest";
import {
  getMockDiscoveryStats as getMonolithicDiscoveryStats,
  getMockTaskPriorityStats as getMonolithicTaskPriorityStats,
  getMockTopTasksStats as getMonolithicTopTasksStats,
} from "~/mock/stats";
import { getMockDiscoveryStats } from "~/mock/stats/discovery";
import { getMockTaskPriorityStats } from "~/mock/stats/taskPriority";
import { getMockTopTasksStats } from "~/mock/stats/topTasks";
import type { FeedbackDto } from "~/types/api";

const base = {
  submittedAt: "2026-08-20T10:00:00Z",
  app: "test-app",
  surveyId: "legacy-specialized",
  sensitiveDataRedacted: false,
} as const;

describe("legacy specialized field aliases", () => {
  it("reads Discovery answers emitted by the deprecated builder", () => {
    const feedback: FeedbackDto = {
      ...base,
      id: "legacy-discovery",
      surveyType: "discovery",
      answers: [
        {
          fieldId: "discoveredTask",
          fieldType: "TEXT",
          question: { label: "Hva kom du for å gjøre?" },
          value: { type: "text", text: "Søke om sykepenger" },
        },
        {
          fieldId: "taskSuccess",
          fieldType: "SINGLE_CHOICE",
          question: {
            label: "Klarte du det?",
            options: [{ id: "yes", label: "Ja" }],
          },
          value: { type: "singleChoice", selectedOptionId: "yes" },
        },
      ],
    };

    for (const getStats of [
      getMockDiscoveryStats,
      getMonolithicDiscoveryStats,
    ]) {
      expect(
        getStats([feedback], new URLSearchParams()).recentResponses[0],
      ).toMatchObject({ task: "Søke om sykepenger", success: "yes" });
    }
  });

  it("reads the legacy Top Tasks success field", () => {
    const feedback: FeedbackDto = {
      ...base,
      id: "legacy-top-tasks",
      surveyType: "topTasks",
      answers: [
        {
          fieldId: "task",
          fieldType: "SINGLE_CHOICE",
          question: {
            label: "Hva skulle du gjøre?",
            options: [{ id: "apply", label: "Søke" }],
          },
          value: { type: "singleChoice", selectedOptionId: "apply" },
        },
        {
          fieldId: "taskSuccess",
          fieldType: "SINGLE_CHOICE",
          question: {
            label: "Klarte du det?",
            options: [{ id: "yes", label: "Ja" }],
          },
          value: { type: "singleChoice", selectedOptionId: "yes" },
        },
      ],
    };

    for (const getStats of [getMockTopTasksStats, getMonolithicTopTasksStats]) {
      expect(
        getStats([feedback], new URLSearchParams()).tasks[0],
      ).toMatchObject({ taskId: "apply", successCount: 1 });
    }
  });

  it("reads Task Priority answers emitted by the deprecated builder", () => {
    const feedback: FeedbackDto = {
      ...base,
      id: "legacy-priority",
      surveyType: "taskPriority",
      answers: [
        {
          fieldId: "priorities",
          fieldType: "MULTI_CHOICE",
          question: {
            label: "Hva er viktigst?",
            options: [{ id: "apply", label: "Søke" }],
          },
          value: { type: "multiChoice", selectedOptionIds: ["apply"] },
        },
      ],
    };

    for (const getStats of [
      getMockTaskPriorityStats,
      getMonolithicTaskPriorityStats,
    ]) {
      expect(
        getStats([feedback], new URLSearchParams()).tasks[0],
      ).toMatchObject({ taskId: "apply", task: "Søke", votes: 1 });
    }
  });

  it("shows the newest Task Priority label for a stable task id", () => {
    const feedback = (
      id: string,
      submittedAt: string,
      label: string,
    ): FeedbackDto => ({
      ...base,
      id,
      submittedAt,
      surveyType: "taskPriority",
      answers: [
        {
          fieldId: "priority",
          fieldType: "MULTI_CHOICE",
          question: {
            label: "Hva er viktigst?",
            options: [{ id: "apply", label }],
          },
          value: { type: "multiChoice", selectedOptionIds: ["apply"] },
        },
      ],
    });

    for (const getStats of [
      getMockTaskPriorityStats,
      getMonolithicTaskPriorityStats,
    ]) {
      const result = getStats(
        [
          feedback("new", "2026-08-20T10:00:00Z", "Sende søknad"),
          feedback("old", "2026-08-19T10:00:00Z", "Søke"),
        ],
        new URLSearchParams(),
      );
      expect(result.tasks[0]).toMatchObject({
        taskId: "apply",
        task: "Sende søknad",
        votes: 2,
      });
    }
  });
});
