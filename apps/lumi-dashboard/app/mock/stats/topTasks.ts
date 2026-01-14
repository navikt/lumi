/**
 * Top Tasks stats calculation.
 *
 * Calculates task completion rates, TPI scores, and blocker themes.
 */

import type { FeedbackDto, TopTaskStats, TopTasksResponse } from "~/types/api";
import { mockThemes } from "../themes";
import { applyFeedbackFilters, stemNorwegian } from "./common";

// Internal type for aggregation with additional fields
interface InternalTaskStats
  extends Omit<
    TopTaskStats,
    "avgTimeMs" | "targetTimeMs" | "tpiScore" | "blockersByTheme"
  > {
  totalDurationMs: number;
  durationCount: number;
  blockerTexts: string[];
}

/**
 * Calculate Top Tasks stats from feedback items.
 * Includes task completion rates, TPI scores, and blocker theme analysis.
 */
export function getMockTopTasksStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): TopTasksResponse {
  const filtered = applyFeedbackFilters(items, params);
  const taskFilter = params.get("task");
  const taskMap = new Map<string, InternalTaskStats>();
  const dailyStats: Record<string, { total: number; success: number }> = {};

  for (const item of filtered) {
    if (item.surveyType !== "topTasks") continue;

    const taskAnswer = item.answers.find(
      (a) => a.fieldId === "task" || a.fieldId === "category",
    );
    if (!taskAnswer || taskAnswer.fieldType !== "SINGLE_CHOICE") continue;

    const taskOption = taskAnswer.question.options?.find(
      (o) => o.id === taskAnswer.value.selectedOptionId,
    );
    const task = taskOption
      ? taskOption.label
      : taskAnswer.value.selectedOptionId;

    // Task filter: skip if task doesn't match the filter
    if (taskFilter && task !== taskFilter) continue;

    const successAnswer = item.answers.find(
      (a) => a.fieldId === "taskSuccess" || a.fieldId === "success",
    );
    const successValue =
      successAnswer?.fieldType === "SINGLE_CHOICE"
        ? successAnswer.value.selectedOptionId
        : "unknown";

    const blockerAnswer = item.answers.find(
      (a) => a.fieldId === "blocker" || a.fieldId === "hindring",
    );
    const blocker =
      blockerAnswer?.fieldType === "TEXT" && blockerAnswer.value.text
        ? blockerAnswer.value.text
        : null;

    if (!taskMap.has(task)) {
      taskMap.set(task, {
        task,
        totalCount: 0,
        successCount: 0,
        partialCount: 0,
        failureCount: 0,
        successRate: 0,
        formattedSuccessRate: "0%",
        blockerCounts: {},
        totalDurationMs: 0,
        durationCount: 0,
        blockerTexts: [],
      });
    }

    const stats = taskMap.get(task);
    if (stats) {
      stats.totalCount++;

      if (successValue === "Ja") stats.successCount++;
      else if (successValue === "Delvis") stats.partialCount++;
      else if (successValue === "Nei") stats.failureCount++;

      if (blocker) {
        stats.blockerCounts[blocker] = (stats.blockerCounts[blocker] || 0) + 1;
        stats.blockerTexts.push(blocker);
      }

      // Aggregate duration
      if (item.durationMs) {
        stats.totalDurationMs = stats.totalDurationMs + item.durationMs;
        stats.durationCount = stats.durationCount + 1;
      }
    }

    // Daily stats
    const date = item.submittedAt.split("T")[0];
    if (!dailyStats[date]) {
      dailyStats[date] = { total: 0, success: 0 };
    }
    dailyStats[date].total++;
    if (successValue === "Ja") {
      dailyStats[date].success++;
    }
  }

  // Get blocker themes for categorization
  const blockerThemes = mockThemes.filter(
    (t) => t.analysisContext === "BLOCKER",
  );

  const tasks: TopTaskStats[] = Array.from(taskMap.values()).map((stats) => {
    const rate =
      stats.totalCount > 0 ? stats.successCount / stats.totalCount : 0;

    const totalDuration = stats.totalDurationMs || 0;
    const durationCount = stats.durationCount || 0;

    let avgTimeMs = 0;
    if (durationCount > 0) {
      avgTimeMs = Math.round(totalDuration / durationCount);
    } else {
      avgTimeMs = 60000; // Fallback
    }

    const targetTimeMs = 45000;
    const timeEfficiency = Math.min(1, targetTimeMs / (avgTimeMs || 1));
    const tpiScore = Math.round(rate * timeEfficiency * 100);

    // Calculate blockersByTheme for this task
    const blockersByTheme: Record<
      string,
      { themeName: string; color: string; count: number; examples: string[] }
    > = {};

    for (const theme of blockerThemes) {
      blockersByTheme[theme.id] = {
        themeName: theme.name,
        color: theme.color ?? "#3b82f6",
        count: 0,
        examples: [],
      };
    }
    blockersByTheme.annet = {
      themeName: "Annet",
      color: "#9ca3af",
      count: 0,
      examples: [],
    };

    for (const blockerText of stats.blockerTexts) {
      const blockerWords = blockerText
        .toLowerCase()
        .replace(/[^\wæøå\s]/g, "")
        .split(/\s+/)
        .map(stemNorwegian);

      let matchedAny = false;

      for (const theme of blockerThemes) {
        const keywordStems = theme.keywords.map((k) =>
          stemNorwegian(k.toLowerCase()),
        );

        if (keywordStems.some((kStem) => blockerWords.includes(kStem))) {
          const themeEntry = blockersByTheme[theme.id];
          if (themeEntry) {
            themeEntry.count++;
            if (
              themeEntry.examples.length < 2 &&
              !themeEntry.examples.includes(blockerText)
            ) {
              themeEntry.examples.push(blockerText);
            }
            matchedAny = true;
          }
        }
      }

      if (!matchedAny) {
        const annetEntry = blockersByTheme.annet;
        if (annetEntry) {
          annetEntry.count++;
          if (
            annetEntry.examples.length < 2 &&
            !annetEntry.examples.includes(blockerText)
          ) {
            annetEntry.examples.push(blockerText);
          }
        }
      }
    }

    const filteredBlockersByTheme: typeof blockersByTheme = {};
    for (const [key, value] of Object.entries(blockersByTheme)) {
      if (value.count > 0) {
        filteredBlockersByTheme[key] = value;
      }
    }

    const {
      totalDurationMs: _,
      durationCount: __,
      blockerTexts: ___,
      ...rest
    } = stats;

    return {
      ...rest,
      successRate: rate,
      formattedSuccessRate: `${Math.round(rate * 100)}%`,
      avgTimeMs,
      targetTimeMs,
      tpiScore,
      blockersByTheme:
        Object.keys(filteredBlockersByTheme).length > 0
          ? filteredBlockersByTheme
          : undefined,
    };
  });

  tasks.sort((a, b) => b.totalCount - a.totalCount);

  const tasksWithTpi = tasks.filter((t) => t.tpiScore !== undefined);
  const overallTpi =
    tasksWithTpi.length > 0
      ? Math.round(
          tasksWithTpi.reduce((acc, t) => acc + (t.tpiScore ?? 0), 0) /
            tasksWithTpi.length,
        )
      : undefined;

  const avgCompletionTimeMs =
    tasksWithTpi.length > 0
      ? Math.round(
          tasksWithTpi.reduce((acc, t) => acc + (t.avgTimeMs ?? 0), 0) /
            tasksWithTpi.length,
        )
      : undefined;

  const totalCount = tasks.reduce((acc, t) => acc + t.totalCount, 0);
  const otherTask = tasks.find(
    (t) =>
      t.task.toLowerCase().includes("annet") ||
      t.task.toLowerCase().includes("other"),
  );
  const otherCount = otherTask ? otherTask.totalCount : 0;
  const otherTasksPercentage =
    totalCount > 0 ? Math.round((otherCount / totalCount) * 100) : 0;

  return {
    totalSubmissions: totalCount,
    tasks,
    dailyStats,
    questionText: filtered
      .find((i) => i.surveyType === "topTasks")
      ?.answers.find((a) => a.fieldId === "task")?.question.label,
    overallTpi,
    avgCompletionTimeMs,
    otherTasksPercentage,
  };
}
