/**
 * Discovery stats calculation.
 *
 * Analyzes discovery survey responses for themes, phrases, and quotes.
 */

import type { DiscoveryResponse, FeedbackDto } from "~/types/api";
import { mockThemes } from "../themes";
import { DiscoveryFieldIds, getDiscoveryTaskText } from "../utils/extractors";
import { matchesThemeKeywords } from "../utils/textAnalysis";
import { applyFeedbackFilters } from "./common";
import { extractPhrases } from "./phrases";

/**
 * Calculate Discovery stats from feedback items.
 * Uses theme clustering and phrase analysis.
 */
export function getMockDiscoveryStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): DiscoveryResponse {
  const filtered = applyFeedbackFilters(items, params).filter(
    (item) => item.surveyType === "discovery",
  );

  const responses = filtered.map((item) => {
    const taskAnswer = item.answers.find((answer) =>
      DiscoveryFieldIds.task.includes(
        answer.fieldId as (typeof DiscoveryFieldIds.task)[number],
      ),
    );
    const successAnswer = item.answers.find((answer) =>
      DiscoveryFieldIds.success.includes(
        answer.fieldId as (typeof DiscoveryFieldIds.success)[number],
      ),
    );

    let task = getDiscoveryTaskText(item) ?? "Ukjent oppgave";
    if (taskAnswer?.fieldType === "SINGLE_CHOICE") {
      const option = taskAnswer.question.options?.find(
        (o) => o.id === taskAnswer.value.selectedOptionId,
      );
      task = option ? option.label : taskAnswer.value.selectedOptionId;
    }

    let success: "yes" | "partial" | "no" = "no";
    if (successAnswer && successAnswer.fieldType === "SINGLE_CHOICE") {
      const val = successAnswer.value.selectedOptionId;
      if (val === "yes" || val === "partial" || val === "no") {
        success = val;
      }
    }

    return {
      id: item.id,
      task,
      success,
      submittedAt: item.submittedAt,
    };
  });

  const textInsights = extractPhrases(
    responses.map((response) => ({
      id: response.id,
      text: response.task,
      submittedAt: response.submittedAt,
    })),
    { maxSourceIds: 3 },
  );

  // Theme clustering - only use GENERAL_FEEDBACK themes
  const generalThemes = mockThemes.filter(
    (t) => t.analysisContext !== "BLOCKER",
  );
  const themes = generalThemes.map((t) => ({
    theme: t.name,
    keywords: t.keywords,
    priority: t.priority,
    examples: [] as string[],
    successCount: 0,
    partialCount: 0,
    totalCount: 0,
  }));

  // Add catch-all "Annet" theme
  themes.push({
    theme: "Annet",
    keywords: [],
    priority: -1,
    examples: [],
    successCount: 0,
    partialCount: 0,
    totalCount: 0,
  });

  const usedExamplesPerTheme = new Map<string, Set<string>>();
  for (const theme of themes) {
    usedExamplesPerTheme.set(theme.theme, new Set());
  }

  // INCLUSIVE MATCHING: Each response can match multiple themes
  for (const response of responses) {
    let matchedAnyTheme = false;

    for (const theme of themes) {
      if (!theme.keywords || theme.keywords.length === 0) continue;

      if (matchesThemeKeywords(response.task, theme.keywords)) {
        theme.totalCount++;
        if (response.success === "yes") theme.successCount++;
        if (response.success === "partial") theme.partialCount++;
        const themeExamples = usedExamplesPerTheme.get(theme.theme);
        if (
          themeExamples &&
          theme.examples.length < 3 &&
          !themeExamples.has(response.task)
        ) {
          theme.examples.push(response.task);
          themeExamples.add(response.task);
        }
        matchedAnyTheme = true;
      }
    }

    // If no theme matched, add to "Annet"
    if (!matchedAnyTheme) {
      const annetTheme = themes.find((t) => t.theme === "Annet");
      if (annetTheme) {
        annetTheme.totalCount++;
        if (response.success === "yes") annetTheme.successCount++;
        if (response.success === "partial") annetTheme.partialCount++;
        const annetExamples = usedExamplesPerTheme.get("Annet");
        if (
          annetExamples &&
          annetTheme.examples.length < 3 &&
          !annetExamples.has(response.task)
        ) {
          annetTheme.examples.push(response.task);
          annetExamples.add(response.task);
        }
      }
    }
  }

  return {
    totalSubmissions: responses.length,
    themes: themes
      .filter((t) => t.totalCount > 0)
      .map((t) => ({
        theme: t.theme,
        count: t.totalCount,
        successRate:
          t.totalCount > 0
            ? (t.successCount + t.partialCount * 0.5) / t.totalCount
            : 0,
        examples: t.examples,
      }))
      .sort((a, b) => b.count - a.count),
    recentResponses: responses
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      )
      .slice(0, 10)
      .map(({ task, success, submittedAt }) => ({
        task,
        success,
        submittedAt,
      })),
    ...textInsights,
  };
}
