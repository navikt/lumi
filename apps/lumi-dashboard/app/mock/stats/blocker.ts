/**
 * Blocker stats calculation for Top Tasks.
 *
 * Analyzes blocker text from failed/partial tasks using theme clustering.
 */

import { SPECIALIZED_SURVEY_FIELD_IDS } from "@navikt/lumi-survey";
import type { BlockerResponse, FeedbackDto } from "~/types/api";
import { mockThemes } from "../themes";
import { matchesThemeKeywords } from "../utils/textAnalysis";
import { applyFeedbackFilters } from "./common";
import { extractPhrases } from "./phrases";

/**
 * Calculate blocker pattern statistics from Top Tasks feedback.
 * Uses the same text analysis engine as Discovery, but for blocker text.
 */
export function getMockBlockerStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): BlockerResponse {
  const filtered = applyFeedbackFilters(items, params).filter(
    (item) => item.surveyType === "topTasks",
  );
  const taskFilter = params.get("task");

  // Extract blocker responses
  const blockerResponses: Array<{
    id: string;
    blocker: string;
    task: string;
    submittedAt: string;
  }> = [];

  for (const item of filtered) {
    const blockerAnswer = item.answers.find(
      (a) => a.fieldId === SPECIALIZED_SURVEY_FIELD_IDS.blocker,
    );
    const taskAnswer = item.answers.find(
      (a) => a.fieldId === SPECIALIZED_SURVEY_FIELD_IDS.task,
    );

    if (blockerAnswer?.fieldType === "TEXT" && blockerAnswer.value.text) {
      const taskOption = taskAnswer?.question.options?.find(
        (o) =>
          taskAnswer.fieldType === "SINGLE_CHOICE" &&
          o.id === taskAnswer.value.selectedOptionId,
      );
      const task = taskOption?.label ?? "Ukjent oppgave";
      const taskId =
        taskAnswer?.fieldType === "SINGLE_CHOICE"
          ? taskAnswer.value.selectedOptionId
          : undefined;

      // Task filter: skip if task doesn't match the filter
      if (taskFilter && taskId !== taskFilter) continue;

      blockerResponses.push({
        id: item.id,
        blocker: blockerAnswer.value.text,
        task,
        submittedAt: item.submittedAt,
      });
    }
  }

  const textInsights = extractPhrases(
    blockerResponses.map((response) => ({
      id: response.id,
      text: response.blocker,
      submittedAt: response.submittedAt,
    })),
  );

  // Get blocker themes only
  const blockerThemes = mockThemes.filter(
    (t) => t.analysisContext === "BLOCKER",
  );

  const themeStats = blockerThemes.map((t) => ({
    theme: t.name,
    themeId: t.id,
    color: t.color,
    examples: [] as string[],
    count: 0,
    usedExamples: new Set<string>(),
  }));

  // Add "Annet" for uncategorized blockers
  themeStats.push({
    theme: "Annet",
    themeId: "blocker-annet",
    color: "#9ca3af",
    examples: [],
    count: 0,
    usedExamples: new Set<string>(),
  });

  // Theme clustering with inclusive matching
  for (const response of blockerResponses) {
    let matchedAny = false;

    for (const themeStat of themeStats) {
      if (themeStat.themeId === "blocker-annet") continue;

      const theme = blockerThemes.find((t) => t.id === themeStat.themeId);
      if (!theme) continue;

      if (matchesThemeKeywords(response.blocker, theme.keywords)) {
        themeStat.count++;
        if (
          themeStat.examples.length < 3 &&
          !themeStat.usedExamples.has(response.blocker)
        ) {
          themeStat.examples.push(response.blocker);
          themeStat.usedExamples.add(response.blocker);
        }
        matchedAny = true;
      }
    }

    // Add to "Annet" if no theme matched
    if (!matchedAny) {
      const annetStat = themeStats.find((t) => t.themeId === "blocker-annet");
      if (annetStat) {
        annetStat.count++;
        if (
          annetStat.examples.length < 3 &&
          !annetStat.usedExamples.has(response.blocker)
        ) {
          annetStat.examples.push(response.blocker);
          annetStat.usedExamples.add(response.blocker);
        }
      }
    }
  }

  return {
    totalBlockers: blockerResponses.length,
    themes: themeStats
      .filter((t) => t.count > 0)
      .map(({ usedExamples, ...rest }) => rest)
      .sort((a, b) => b.count - a.count),
    recentBlockers: blockerResponses
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      )
      .slice(0, 10)
      .map(({ blocker, task, submittedAt }) => ({
        blocker,
        task,
        submittedAt,
      })),
    ...textInsights,
  };
}
