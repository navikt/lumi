/**
 * Discovery stats calculation.
 *
 * Analyzes discovery survey responses for theme clustering and word frequency.
 */

import type { DiscoveryResponse, FeedbackDto } from "~/types/api";
import { mockThemes } from "../themes";
import { STOP_WORDS, applyFeedbackFilters, stemNorwegian } from "./common";

/**
 * Calculate Discovery stats from feedback items.
 * Uses theme clustering and word frequency analysis.
 */
export function getMockDiscoveryStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): DiscoveryResponse {
  const filtered = applyFeedbackFilters(items, params).filter(
    (item) => item.surveyType === "discovery",
  );

  const responses = filtered.map((item) => {
    const taskAnswer = item.answers.find((a) => a.fieldId === "task");
    const successAnswer = item.answers.find((a) => a.fieldId === "success");

    let task = "Ukjent oppgave";
    if (taskAnswer) {
      if (taskAnswer.fieldType === "TEXT") {
        task = taskAnswer.value.text || "Ukjent oppgave";
      } else if (taskAnswer.fieldType === "SINGLE_CHOICE") {
        const option = taskAnswer.question.options?.find(
          (o) => o.id === taskAnswer.value.selectedOptionId,
        );
        task = option ? option.label : taskAnswer.value.selectedOptionId;
      }
    }

    let success: "yes" | "partial" | "no" = "no";
    if (successAnswer && successAnswer.fieldType === "SINGLE_CHOICE") {
      const val = successAnswer.value.selectedOptionId;
      if (val === "yes" || val === "partial" || val === "no") {
        success = val;
      }
    }

    return {
      task,
      success,
      submittedAt: item.submittedAt,
    };
  });

  // Calculate word frequency
  const wordData = new Map<
    string,
    {
      count: number;
      sourceResponses: Array<{ text: string; submittedAt: string }>;
    }
  >();

  for (const response of responses) {
    const words = response.task
      .toLowerCase()
      .replace(/[^\wæøå\s]/g, "")
      .split(/\s+/);
    const seenWordsInResponse = new Set<string>();
    for (const word of words) {
      if (word.length > 2 && !STOP_WORDS.has(word)) {
        if (!wordData.has(word)) {
          wordData.set(word, { count: 0, sourceResponses: [] });
        }
        const data = wordData.get(word);
        if (!data) continue;
        data.count++;
        if (!seenWordsInResponse.has(word) && data.sourceResponses.length < 5) {
          data.sourceResponses.push({
            text: response.task,
            submittedAt: response.submittedAt,
          });
          seenWordsInResponse.add(word);
        }
      }
    }
  }

  const wordFrequency = Array.from(wordData.entries())
    .map(([word, data]) => ({
      word,
      count: data.count,
      sourceResponses: data.sourceResponses,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

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
    const taskWords = response.task
      .toLowerCase()
      .replace(/[^\wæøå\s]/g, "")
      .split(/\s+/)
      .map(stemNorwegian);
    let matchedAnyTheme = false;

    for (const theme of themes) {
      if (!theme.keywords || theme.keywords.length === 0) continue;

      const keywordStems = theme.keywords.map((k) =>
        stemNorwegian(k.toLowerCase()),
      );
      if (keywordStems.some((kStem) => taskWords.includes(kStem))) {
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
    wordFrequency,
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
      .slice(0, 10),
  };
}
