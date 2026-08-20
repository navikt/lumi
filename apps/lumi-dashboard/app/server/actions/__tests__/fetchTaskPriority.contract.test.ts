import { describe, expect, it } from "vitest";

import { TaskPriorityResponseSchema } from "~/types/schemas";

describe("fetchTaskPriority contract", () => {
  it("validates real-world TaskPriority response shape", () => {
    const payload = {
      totalSubmissions: 200,
      tasks: [
        {
          taskId: "apply",
          task: "Søke om sykepenger",
          votes: 85,
          percentage: 42.5,
        },
        {
          taskId: "change",
          task: "Melde fra om endringer",
          votes: 45,
          percentage: 22.5,
        },
        {
          taskId: "info",
          task: "Finne informasjon",
          votes: 30,
          percentage: 15.0,
        },
        {
          taskId: "payment",
          task: "Sjekke utbetalinger",
          votes: 25,
          percentage: 12.5,
        },
        { taskId: "other", task: "Annet", votes: 15, percentage: 7.5 },
      ],
      longNeckCutoff: 2, // First 2 tasks = 65% (before 80% threshold)
      cumulativePercentageAt5: 100.0,
    };

    expect(() => TaskPriorityResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates Long Neck concept with correct cutoff", () => {
    // "Long Neck" = the top few tasks that account for ~80% of user needs
    const payload = {
      totalSubmissions: 100,
      tasks: [
        { taskId: "main", task: "Main Task", votes: 60, percentage: 60.0 },
        {
          taskId: "secondary",
          task: "Secondary Task",
          votes: 25,
          percentage: 25.0,
        },
        {
          taskId: "tertiary",
          task: "Tertiary Task",
          votes: 10,
          percentage: 10.0,
        },
        { taskId: "minor", task: "Minor Task", votes: 5, percentage: 5.0 },
      ],
      longNeckCutoff: 2, // First 2 tasks = 85% (> 80%)
      cumulativePercentageAt5: 100.0,
    };

    expect(() => TaskPriorityResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects response with missing required fields", () => {
    const invalidPayload = {
      totalSubmissions: 50,
      tasks: [{ taskId: "test", task: "Test", votes: 50, percentage: 100 }],
      // missing longNeckCutoff and cumulativePercentageAt5
    };

    expect(() => TaskPriorityResponseSchema.parse(invalidPayload)).toThrow();
  });

  it("rejects task with incorrect types", () => {
    const invalidPayload = {
      totalSubmissions: 100,
      tasks: [
        {
          taskId: "test",
          task: "Test",
          votes: "not-a-number", // should be number
          percentage: 100,
        },
      ],
      longNeckCutoff: 1,
      cumulativePercentageAt5: 100,
    };

    expect(() => TaskPriorityResponseSchema.parse(invalidPayload)).toThrow();
  });

  it("validates minimal response with single task", () => {
    const minimalPayload = {
      totalSubmissions: 1,
      tasks: [
        { taskId: "only", task: "Only Task", votes: 1, percentage: 100.0 },
      ],
      longNeckCutoff: 1,
      cumulativePercentageAt5: 100.0,
    };

    expect(() =>
      TaskPriorityResponseSchema.parse(minimalPayload),
    ).not.toThrow();
  });

  it("validates empty tasks array", () => {
    const emptyPayload = {
      totalSubmissions: 0,
      tasks: [],
      longNeckCutoff: 0,
      cumulativePercentageAt5: 0,
    };

    expect(() => TaskPriorityResponseSchema.parse(emptyPayload)).not.toThrow();
  });
});
