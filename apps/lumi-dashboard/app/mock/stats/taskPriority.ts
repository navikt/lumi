/**
 * Task Priority stats calculation.
 *
 * Calculates vote distribution for priority tasks using the "long neck" methodology.
 */

import type { FeedbackDto, TaskPriorityResponse } from "~/types/api";
import { applyFeedbackFilters } from "./common";

/**
 * Calculate Task Priority stats from feedback items.
 * Uses "long neck" methodology to identify the most important tasks.
 */
export function getMockTaskPriorityStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): TaskPriorityResponse {
  const filtered = applyFeedbackFilters(items, params).filter(
    (item) => item.surveyType === "taskPriority",
  );

  const voteCounts = new Map<string, number>();
  const taskLabels = new Map<string, string>();

  for (const item of filtered) {
    const priorityAnswer = item.answers.find(
      (a) => a.fieldId === "priority" && a.fieldType === "MULTI_CHOICE",
    );

    if (priorityAnswer && priorityAnswer.fieldType === "MULTI_CHOICE") {
      // Cache labels
      if (priorityAnswer.question.options) {
        for (const opt of priorityAnswer.question.options) {
          if (!taskLabels.has(opt.id)) {
            taskLabels.set(opt.id, opt.label);
          }
        }
      }

      for (const taskId of priorityAnswer.value.selectedOptionIds) {
        voteCounts.set(taskId, (voteCounts.get(taskId) || 0) + 1);
      }
    }
  }

  const tasks = Array.from(voteCounts.entries())
    .map(([taskId, count]) => {
      return {
        task: taskLabels.get(taskId) || taskId,
        votes: count,
        percentage: 0,
      };
    })
    .sort((a, b) => b.votes - a.votes);

  const totalSubmissions = filtered.length;

  // Calculate percentages
  const totalVotes = tasks.reduce((acc, t) => acc + t.votes, 0);
  for (const task of tasks) {
    task.percentage = Math.round((task.votes / totalVotes) * 100);
  }

  // Find long neck cutoff (where cumulative percentage hits 80%)
  let cumulative = 0;
  let longNeckCutoff = 0;
  for (let i = 0; i < tasks.length; i++) {
    cumulative += tasks[i].percentage;
    if (cumulative >= 80) {
      longNeckCutoff = i + 1;
      break;
    }
  }

  // Calculate top 5 cumulative percentage
  const cumulativePercentageAt5 = tasks
    .slice(0, 5)
    .reduce((acc, t) => acc + t.percentage, 0);

  return {
    totalSubmissions,
    tasks,
    longNeckCutoff,
    cumulativePercentageAt5,
  };
}
