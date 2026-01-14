import { describe, expect, it } from "vitest";
import {
  generateSurveyData,
  getMockBlockerStats,
  getMockDiscoveryStats,
  getMockTaskPriorityStats,
  getMockTopTasksStats,
} from "~/mock/mockData";

describe("Mock Data Generation", () => {
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
    expect(stats.wordFrequency.length).toBeGreaterThan(0);
    expect(stats.recentResponses.length).toBeGreaterThan(0);

    // Check structure of a response
    const firstResponse = stats.recentResponses[0];
    expect(firstResponse).toHaveProperty("task");
    expect(firstResponse).toHaveProperty("success");
    expect(["yes", "partial", "no"]).toContain(firstResponse.success);
  });

  it("should include sourceResponses in discovery wordFrequency for context examples", () => {
    const params = new URLSearchParams();
    const stats = getMockDiscoveryStats(params);

    expect(stats.wordFrequency.length).toBeGreaterThan(0);

    // Every word in the frequency list should have sourceResponses
    for (const wordData of stats.wordFrequency) {
      expect(wordData.word).toBeDefined();
      expect(wordData.count).toBeGreaterThan(0);
      expect(wordData.sourceResponses).toBeDefined();
      expect(Array.isArray(wordData.sourceResponses)).toBe(true);
      // At least one source response should be present
      expect(wordData.sourceResponses?.length).toBeGreaterThan(0);

      // Each source response should have text and submittedAt
      if (wordData.sourceResponses) {
        for (const response of wordData.sourceResponses) {
          expect(response.text).toBeDefined();
          expect(response.submittedAt).toBeDefined();
          // The word should appear in the response text (case insensitive)
          expect(response.text.toLowerCase()).toContain(
            wordData.word.toLowerCase(),
          );
        }
      }
    }
  });

  it("should include sourceResponses in blocker wordFrequency for context examples", () => {
    const params = new URLSearchParams();
    const stats = getMockBlockerStats(params);

    // Only test if there are blocker responses
    if (stats.totalBlockers > 0 && stats.wordFrequency.length > 0) {
      for (const wordData of stats.wordFrequency) {
        expect(wordData.word).toBeDefined();
        expect(wordData.count).toBeGreaterThan(0);
        expect(wordData.sourceResponses).toBeDefined();
        expect(Array.isArray(wordData.sourceResponses)).toBe(true);

        // At least one source response should be present
        expect(wordData.sourceResponses?.length).toBeGreaterThan(0);

        // Each source response should have text and submittedAt
        if (wordData.sourceResponses) {
          for (const response of wordData.sourceResponses) {
            expect(response.text).toBeDefined();
            expect(response.submittedAt).toBeDefined();
            // Note: We don't check if word appears exactly in response text
            // because punctuation is stripped when extracting words
            // (e.g., "chat-boten" becomes "chatboten")
          }
        }
      }
    }
  });

  it("should limit sourceResponses to 5 per word to keep response size reasonable", () => {
    const params = new URLSearchParams();
    const discoveryStats = getMockDiscoveryStats(params);
    const blockerStats = getMockBlockerStats(params);

    for (const wordData of discoveryStats.wordFrequency) {
      expect(wordData.sourceResponses?.length ?? 0).toBeLessThanOrEqual(5);
    }

    for (const wordData of blockerStats.wordFrequency) {
      expect(wordData.sourceResponses?.length ?? 0).toBeLessThanOrEqual(5);
    }
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
    it("should filter Top Tasks stats by task name", () => {
      // First get all tasks without filter
      const unfiltered = getMockTopTasksStats(new URLSearchParams());
      expect(unfiltered.tasks.length).toBeGreaterThan(1);

      // Pick a task to filter by
      const targetTask = unfiltered.tasks[0].task;
      const params = new URLSearchParams({ task: targetTask });
      const filtered = getMockTopTasksStats(params);

      // Should only have the filtered task
      expect(filtered.tasks.length).toBe(1);
      expect(filtered.tasks[0].task).toBe(targetTask);

      // Total submissions should be reduced
      expect(filtered.totalSubmissions).toBeLessThanOrEqual(
        unfiltered.totalSubmissions,
      );
    });

    it("should filter Blocker stats by task name", () => {
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

      const params = new URLSearchParams({ task: targetTask });
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
