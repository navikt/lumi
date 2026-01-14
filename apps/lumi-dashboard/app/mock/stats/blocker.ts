/**
 * Blocker stats calculation for Top Tasks.
 *
 * Analyzes blocker text from failed/partial tasks using theme clustering.
 */

import type { BlockerResponse, FeedbackDto } from "~/types/api";
import { mockThemes } from "../themes";
import { STOP_WORDS, applyFeedbackFilters, stemNorwegian } from "./common";

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
    blocker: string;
    task: string;
    submittedAt: string;
  }> = [];

  for (const item of filtered) {
    const blockerAnswer = item.answers.find((a) => a.fieldId === "blocker");
    const taskAnswer = item.answers.find((a) => a.fieldId === "task");

    if (blockerAnswer?.fieldType === "TEXT" && blockerAnswer.value.text) {
      const taskOption = taskAnswer?.question.options?.find(
        (o) =>
          taskAnswer.fieldType === "SINGLE_CHOICE" &&
          o.id === taskAnswer.value.selectedOptionId,
      );
      const task = taskOption?.label ?? "Ukjent oppgave";

      // Task filter: skip if task doesn't match the filter
      if (taskFilter && task !== taskFilter) continue;

      blockerResponses.push({
        blocker: blockerAnswer.value.text,
        task,
        submittedAt: item.submittedAt,
      });
    }
  }

  // Calculate word frequency from blocker text
  const wordData = new Map<
    string,
    {
      count: number;
      sourceResponses: Array<{ text: string; submittedAt: string }>;
    }
  >();

  for (const response of blockerResponses) {
    const words = response.blocker
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
            text: response.blocker,
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
    const blockerWords = response.blocker
      .toLowerCase()
      .replace(/[^\wæøå\s]/g, "")
      .split(/\s+/)
      .map(stemNorwegian);

    let matchedAny = false;

    for (const themeStat of themeStats) {
      if (themeStat.themeId === "blocker-annet") continue;

      const theme = blockerThemes.find((t) => t.id === themeStat.themeId);
      if (!theme) continue;

      const keywordStems = theme.keywords.map((k) =>
        stemNorwegian(k.toLowerCase()),
      );

      if (keywordStems.some((kStem) => blockerWords.includes(kStem))) {
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
    wordFrequency,
    themes: themeStats
      .filter((t) => t.count > 0)
      .map(({ usedExamples, ...rest }) => rest)
      .sort((a, b) => b.count - a.count),
    recentBlockers: blockerResponses
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      )
      .slice(0, 10),
  };
}
