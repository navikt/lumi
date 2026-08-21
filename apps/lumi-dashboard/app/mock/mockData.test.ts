import { describe, expect, it } from "vitest";
import {
  generateSurveyData,
  getMockBlockerStats,
  getMockDiscoveryStats,
  getMockFeedback,
  getMockStats,
  getMockTaskPriorityStats,
  getMockTopTasksStats,
} from "~/mock/mockData";

describe("Mock Data Generation", () => {
  it("excludes archived survey data unless includeArchived is enabled", () => {
    const activeOnly = new URLSearchParams({ surveyId: "survey-thumbs" });
    const withArchived = new URLSearchParams({
      surveyId: "survey-thumbs",
      includeArchived: "true",
    });

    expect(getMockFeedback(activeOnly).totalElements).toBe(0);
    expect(getMockStats(activeOnly).totalCount).toBe(0);
    expect(getMockFeedback(withArchived).totalElements).toBeGreaterThan(0);
    expect(getMockStats(withArchived).totalCount).toBeGreaterThan(0);
  });

  it("returns no feedback for a deleted theme in the server mock path", () => {
    expect(
      getMockFeedback(new URLSearchParams({ theme: "deleted-theme" }))
        .totalElements,
    ).toBe(0);
  });

  it("should generate items from topics", () => {
    const items = generateSurveyData(10, {
      app: "test-app",
      surveyId: "test-survey",
      basePath: "/test",
      topics: [
        { rating: 5, comments: ["Bra"], tags: ["Tag1"] },
        { rating: 1, comments: ["Dårlig"], tags: ["Tag2"] },
      ],
      questions: { ratingLabel: "Rating" },
    });

    expect(items).toHaveLength(10);
    expect(items[0].surveyId).toBe("test-survey");
    expect(items[0].answers).toHaveLength(1); // Only rating by default
  });

  it("should generate discovery stats correctly", () => {
    const params = new URLSearchParams();
    const stats = getMockDiscoveryStats(params);

    expect(stats.totalSubmissions).toBeGreaterThan(0);
    expect(stats.themes.length).toBeGreaterThan(0);
    expect(stats.recentResponses.length).toBeGreaterThan(0);
    expect(stats.phrases?.length).toBeGreaterThan(0);
    expect(stats.quotes?.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(stats.confidenceLevel);

    // Check structure of a response
    const firstResponse = stats.recentResponses[0];
    expect(firstResponse).toHaveProperty("task");
    expect(firstResponse).toHaveProperty("success");
    expect(["yes", "partial", "no"]).toContain(firstResponse.success);
  });

  it("should expose phrase insights for blocker responses", () => {
    const stats = getMockBlockerStats(new URLSearchParams());

    expect(stats.totalBlockers).toBeGreaterThan(0);
    expect(stats.phrases?.length).toBeGreaterThan(0);
    expect(stats.quotes?.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(stats.confidenceLevel);
  });

  it("should generate task priority stats correctly", () => {
    const params = new URLSearchParams();
    const stats = getMockTaskPriorityStats(params);

    expect(stats.totalSubmissions).toBeGreaterThan(0);
    expect(stats.tasks.length).toBeGreaterThan(0);
    expect(stats.longNeckCutoff).toBeGreaterThan(0);

    // Check that votes are counted
    const totalVotes = stats.tasks.reduce((acc, t) => acc + t.votes, 0);
    expect(totalVotes).toBeGreaterThan(0);

    // Check percentage calculation
    if (stats.tasks.length > 0) {
      const task = stats.tasks[0];
      expect(task.percentage).toBeDefined();
      expect(task.percentage).toBeLessThanOrEqual(100);
    }
  });

  it("should generate top tasks stats correctly with optimizations", () => {
    // const items = generateTopTasksMockData(); // implicit in stats
    const stats = getMockTopTasksStats(new URLSearchParams());

    expect(stats.totalSubmissions).toBeGreaterThan(0);
    expect(stats.tasks.length).toBeGreaterThan(0);

    // Check TPI fields
    expect(stats.overallTpi).toBeDefined();
    expect(stats.avgCompletionTimeMs).toBeDefined();
    expect(stats.tasks.some((task) => task.successCount > 0)).toBe(true);
    for (const task of stats.tasks) {
      expect(task.successCount + task.partialCount + task.failureCount).toBe(
        task.totalCount,
      );
    }

    // Check Other percentage calculation
    // We know "annet" is in the task list in generators.ts
    const hasOther = stats.tasks.some((t) =>
      t.task.toLowerCase().includes("annet"),
    );
    if (hasOther) {
      // Validation: percentage should be a number between 0 and 100
      expect(stats.otherTasksPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.otherTasksPercentage).toBeLessThanOrEqual(100);
    }

    // Check duration aggregation
    const taskWithDuration = stats.tasks.find((t) => t.totalCount > 0);
    expect(taskWithDuration?.avgTimeMs).toBeGreaterThan(0);
  });

  describe("Task Filter", () => {
    it("should filter Top Tasks stats by stable task id", () => {
      // First get all tasks without filter
      const unfiltered = getMockTopTasksStats(new URLSearchParams());
      expect(unfiltered.tasks.length).toBeGreaterThan(1);

      // Pick a task to filter by
      const targetTask = unfiltered.tasks[0];
      const params = new URLSearchParams({ task: targetTask.taskId });
      const filtered = getMockTopTasksStats(params);

      // Should only have the filtered task
      expect(filtered.tasks.length).toBe(1);
      expect(filtered.tasks[0].taskId).toBe(targetTask.taskId);
      expect(filtered.tasks[0].task).toBe(targetTask.task);

      // Total submissions should be reduced
      expect(filtered.totalSubmissions).toBeLessThanOrEqual(
        unfiltered.totalSubmissions,
      );
    });

    it("should filter Blocker stats by stable task id", () => {
      // First get all blockers without filter
      const unfiltered = getMockBlockerStats(new URLSearchParams());

      // Find a task with blockers
      const tasksWithBlockers = unfiltered.themes.filter((t) => t.count > 0);

      if (tasksWithBlockers.length === 0 || unfiltered.totalBlockers === 0) {
        // Skip if no blockers in mock data
        return;
      }

      // Get the first task from recent blockers
      const targetTask = unfiltered.recentBlockers[0]?.task;
      if (!targetTask) return;
      const targetTaskId = getMockTopTasksStats(
        new URLSearchParams(),
      ).tasks.find((task) => task.task === targetTask)?.taskId;
      if (!targetTaskId) return;

      const params = new URLSearchParams({ task: targetTaskId });
      const filtered = getMockBlockerStats(params);

      // All recent blockers should be for the filtered task
      if (filtered.recentBlockers.length > 0) {
        for (const blocker of filtered.recentBlockers) {
          expect(blocker.task).toBe(targetTask);
        }
      }
    });

    it("should return empty tasks array when filtering by non-existent task", () => {
      const params = new URLSearchParams({ task: "NonExistentTask123" });
      const filtered = getMockTopTasksStats(params);

      // Tasks array should be empty for non-existent task
      expect(filtered.tasks.length).toBe(0);
    });
  });
});
