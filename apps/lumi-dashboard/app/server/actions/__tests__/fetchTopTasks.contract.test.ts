import { describe, expect, it } from "vitest";

import { TopTasksResponseSchema } from "~/types/schemas";

describe("fetchTopTasks contract", () => {
  it("validates real-world TopTasks response shape", () => {
    const payload = {
      totalSubmissions: 150,
      tasks: [
        {
          taskId: "apply",
          task: "Søke om sykepenger",
          totalCount: 45,
          successCount: 32,
          partialCount: 8,
          failureCount: 5,
          successRate: 0.711,
          formattedSuccessRate: "71%",
          blockerCounts: {
            "Fant ikke skjema": 3,
            "Teknisk feil": 2,
          },
        },
        {
          taskId: "parental-benefit",
          task: "Finne informasjon om foreldrepenger",
          totalCount: 30,
          successCount: 25,
          partialCount: 3,
          failureCount: 2,
          successRate: 0.833,
          formattedSuccessRate: "83%",
          blockerCounts: {},
        },
      ],
      dailyStats: {
        "2026-01-20": { total: 50, success: 35 },
        "2026-01-21": { total: 100, success: 72 },
      },
      questionText: "Hva kom du hit for å gjøre i dag?",
    };

    expect(() => TopTasksResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects response with missing required fields", () => {
    const invalidPayload = {
      totalSubmissions: 100,
      // missing tasks and dailyStats
    };

    expect(() => TopTasksResponseSchema.parse(invalidPayload)).toThrow();
  });

  it("rejects task with incorrect types", () => {
    const invalidPayload = {
      totalSubmissions: 100,
      tasks: [
        {
          task: "Test",
          totalCount: "not-a-number", // should be number
          successCount: 10,
          partialCount: 5,
          failureCount: 2,
          successRate: 0.5,
          formattedSuccessRate: "50%",
          blockerCounts: {},
        },
      ],
      dailyStats: {},
    };

    expect(() => TopTasksResponseSchema.parse(invalidPayload)).toThrow();
  });

  it("validates TPI metrics when present", () => {
    const payloadWithTpi = {
      totalSubmissions: 100,
      tasks: [
        {
          taskId: "main-task",
          task: "Hovedoppgave",
          totalCount: 100,
          successCount: 80,
          partialCount: 10,
          failureCount: 10,
          successRate: 0.8,
          formattedSuccessRate: "80%",
          blockerCounts: {},
        },
      ],
      dailyStats: {},
      overallTpi: 75.5,
      avgCompletionTimeMs: 45000,
      otherTasksPercentage: 12.5,
    };

    // TPI fields are optional in the schema
    expect(() => TopTasksResponseSchema.parse(payloadWithTpi)).not.toThrow();
  });
});
