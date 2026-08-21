import {
  LEGACY_SPECIALIZED_SURVEY_FIELD_IDS,
  SPECIALIZED_SURVEY_FIELD_IDS,
} from "@navikt/lumi-survey";
import dayjs from "dayjs";
import { mockThemes } from "~/mock/themes";
import type {
  Answer,
  BlockerResponse,
  DiscoveryResponse,
  FeedbackDto,
  FeedbackStats,
  FieldStat,
  TaskPriorityResponse,
  TopTaskStats,
  TopTasksResponse,
} from "~/types/api";
import { parseChoiceParam } from "~/utils/choiceFilterUtils";
import { parseRatingParam } from "~/utils/ratingFilterUtils";
import { getScreenResolutionBucket } from "~/utils/screenResolution";
import { getRating, hasTextResponse } from "./helpers";
import { extractPhrases, extractTopKeywords } from "./stats/phrases";
import { getDiscoveryTaskText } from "./utils/extractors";
import { matchesThemeKeywords } from "./utils/textAnalysis";

const isDiscoveryTaskField = (fieldId: string) =>
  fieldId === SPECIALIZED_SURVEY_FIELD_IDS.task ||
  fieldId === LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.discoveryTask;
const isSuccessField = (fieldId: string) =>
  fieldId === SPECIALIZED_SURVEY_FIELD_IDS.success ||
  fieldId === LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.success;
const isPriorityField = (fieldId: string) =>
  fieldId === SPECIALIZED_SURVEY_FIELD_IDS.priority ||
  fieldId === LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.priority;

// Note: circular dependency if we import mockFeedbackItems here directly while mockData imports stats.
// To avoid this, we will accept items as arguments in the functions.

// ============================================
// Stats calculation
// ============================================

export function calculatePeriod(
  fromDate: string | null,
  toDate: string | null,
): { fromDate: string | null; toDate: string | null; days: number } {
  const today = dayjs();
  // Default to 30 days (start = today - 29 days)
  const defaultFrom = today.subtract(29, "day").format("YYYY-MM-DD");
  const defaultTo = today.format("YYYY-MM-DD");

  const actualFrom = fromDate || defaultFrom;
  const actualTo = toDate || defaultTo;

  const fromDayjs = dayjs(actualFrom);
  const toDayjs = dayjs(actualTo);

  // Diff in days + 1 for inclusive range
  const diffDays = toDayjs.diff(fromDayjs, "day") + 1;

  return {
    fromDate: actualFrom,
    toDate: actualTo,
    days: diffDays,
  };
}

interface TextResponseWithTimestamp {
  text: string;
  submittedAt: string;
}

export function calculateFieldStats(items: FeedbackDto[]): FieldStat[] {
  // Collect all unique fields across all items
  const fieldMap = new Map<
    string,
    {
      fieldId: string;
      fieldType: string;
      label: string;
      values: Answer["value"][];
      textResponses: TextResponseWithTimestamp[];
    }
  >();

  for (const item of items) {
    for (const answer of item.answers) {
      const key = answer.fieldId;
      if (!fieldMap.has(key)) {
        fieldMap.set(key, {
          fieldId: answer.fieldId,
          fieldType: answer.fieldType,
          label: answer.question.label,
          values: [],
          textResponses: [],
        });
      }
      const fieldData = fieldMap.get(key);
      fieldData?.values.push(answer.value);

      // Track text responses with timestamps for sorting
      if (answer.fieldType === "TEXT" && answer.value.type === "text") {
        fieldData?.textResponses.push({
          text: answer.value.text,
          submittedAt: item.submittedAt,
        });
      }
    }
  }

  // Calculate stats for each field
  const fieldStats: FieldStat[] = [];

  for (const [, field] of fieldMap) {
    if (field.fieldType === "RATING") {
      const ratingValues = field.values.filter((v) => v.type === "rating");
      const ratings = ratingValues.map(
        (v) => (v as { type: "rating"; rating: number }).rating,
      );

      // Extract variant and scale from first rating answer
      const firstRating = ratingValues[0] as
        | {
            type: "rating";
            rating: number;
            ratingVariant?: string;
            ratingScale?: number;
          }
        | undefined;
      const ratingVariant = firstRating?.ratingVariant || "emoji";
      const ratingScale = firstRating?.ratingScale || 5;

      // Build distribution based on variant
      let distribution: Record<number, number> = {};
      if (ratingVariant === "thumbs") {
        distribution = { 1: 0, 2: 0 };
      } else if (ratingVariant === "nps") {
        distribution = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          10: 0,
        };
      } else {
        distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }

      let sum = 0;
      for (const r of ratings) {
        distribution[r] = (distribution[r] || 0) + 1;
        sum += r;
      }

      fieldStats.push({
        fieldId: field.fieldId,
        fieldType: "RATING",
        label: field.label,
        stats: {
          type: "rating",
          average: ratings.length > 0 ? sum / ratings.length : 0,
          distribution,
          // Include variant info for display components
          ratingVariant,
          ratingScale,
        } as {
          type: "rating";
          average: number;
          distribution: Record<number, number>;
          ratingVariant: string;
          ratingScale: number;
        },
      });
    } else if (field.fieldType === "TEXT") {
      const texts = field.values
        .filter((v) => v.type === "text")
        .map((v) => (v as { type: "text"; text: string }).text);

      const nonEmpty = texts.filter((t) => t && t.trim().length > 0);

      // Get top keywords from text responses
      const topKeywords = extractTopKeywords(nonEmpty, 10);

      // Get 3 most recent non-empty responses, sorted by date descending
      const recentResponses = field.textResponses
        .filter((r) => r.text && r.text.trim().length > 0)
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() -
            new Date(a.submittedAt).getTime(),
        )
        .slice(0, 3);

      // Extract top bigram phrases from text responses
      const { phrases } = extractPhrases(field.textResponses);
      const topPhrases = phrases
        .slice(0, 10)
        .map((p) => ({ text: p.text, count: p.count }));

      fieldStats.push({
        fieldId: field.fieldId,
        fieldType: "TEXT",
        label: field.label,
        stats: {
          type: "text",
          responseCount: nonEmpty.length,
          // responseRate is calculated in UI based on totalCount
          responseRate: 0,
          topKeywords,
          recentResponses,
          ...(topPhrases.length > 0 ? { topPhrases } : {}),
        },
      });
    } else if (
      field.fieldType === "SINGLE_CHOICE" ||
      field.fieldType === "MULTI_CHOICE"
    ) {
      // Get options from first answer with options
      const firstAnswerWithOptions = items
        .flatMap((i) => i.answers)
        .find((a) => a.fieldId === field.fieldId && a.question.options?.length);
      const options = firstAnswerWithOptions?.question.options || [];

      // Count selections
      const selectionCounts: Record<string, number> = {};
      for (const opt of options) {
        selectionCounts[opt.id] = 0;
      }

      for (const value of field.values) {
        if (value.type === "singleChoice") {
          const id = value.selectedOptionId;
          selectionCounts[id] = (selectionCounts[id] || 0) + 1;
        } else if (value.type === "multiChoice") {
          for (const id of value.selectedOptionIds) {
            selectionCounts[id] = (selectionCounts[id] || 0) + 1;
          }
        }
      }

      const totalSelections = Object.values(selectionCounts).reduce(
        (sum, c) => sum + c,
        0,
      );
      const responseCount = field.values.filter((value) => {
        if (value.type === "singleChoice") {
          return value.selectedOptionId.length > 0;
        }
        if (value.type === "multiChoice") {
          return value.selectedOptionIds.length > 0;
        }
        return false;
      }).length;

      const distribution: Record<
        string,
        { label: string; count: number; percentage: number }
      > = {};
      for (const opt of options) {
        const count = selectionCounts[opt.id] || 0;
        distribution[opt.id] = {
          label: opt.label,
          count,
          percentage:
            responseCount > 0 ? Math.round((count / responseCount) * 100) : 0,
        };
      }

      fieldStats.push({
        fieldId: field.fieldId,
        fieldType: field.fieldType as "SINGLE_CHOICE" | "MULTI_CHOICE",
        label: field.label,
        stats: {
          type: "choice",
          responseCount,
          responseRate: items.length > 0 ? responseCount / items.length : 0,
          totalSelections,
          distribution,
        },
      });
    }
  }

  return fieldStats;
}

export function calculateStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): FeedbackStats {
  // Filter items based on params
  let filtered = [...items];

  const app = params.get("app");
  const fromDate = params.get("fromDate");
  const toDate = params.get("toDate");
  const surveyId = params.get("surveyId");
  const deviceType = params.get("deviceType");
  const rating = params.get("rating");

  if (app) {
    filtered = filtered.filter((item) => item.app === app);
  }
  if (fromDate) {
    filtered = filtered.filter((item) => item.submittedAt >= fromDate);
  }
  if (toDate) {
    filtered = filtered.filter(
      (item) => item.submittedAt <= `${toDate}T23:59:59Z`,
    );
  }
  if (surveyId) {
    filtered = filtered.filter((item) => item.surveyId === surveyId);
  }
  if (deviceType) {
    filtered = filtered.filter(
      (item) => item.context?.deviceType === deviceType,
    );
  }

  const ratingFilters = Object.entries(parseRatingParam(rating ?? undefined));
  if (ratingFilters.length > 0) {
    filtered = filtered.filter((item) =>
      ratingFilters.every(([fieldId, ratingValue]) => {
        const parsed = Number.parseInt(ratingValue, 10);
        if (Number.isNaN(parsed)) {
          return false;
        }

        return item.answers.some(
          (answer) =>
            answer.fieldType === "RATING" &&
            answer.fieldId === fieldId &&
            answer.value.type === "rating" &&
            answer.value.rating === parsed,
        );
      }),
    );
  }

  const choice = params.get("choice");
  const choiceFilters = Object.entries(parseChoiceParam(choice ?? undefined));
  if (choiceFilters.length > 0) {
    filtered = filtered.filter((item) =>
      choiceFilters.every(([fieldId, optionId]) =>
        item.answers.some((answer) => {
          if (answer.fieldId !== fieldId) return false;
          if (
            answer.fieldType === "SINGLE_CHOICE" &&
            answer.value.type === "singleChoice"
          ) {
            return answer.value.selectedOptionId === optionId;
          }
          if (
            answer.fieldType === "MULTI_CHOICE" &&
            answer.value.type === "multiChoice"
          ) {
            return answer.value.selectedOptionIds.includes(optionId);
          }
          return false;
        }),
      ),
    );
  }

  // Filter by segment (context.tags format: "key:value,key:value")
  const segment = params.get("segment");
  if (segment) {
    const segmentFilters = segment.split(",").map((t) => {
      const [key, value] = t.split(":");
      return { key, value };
    });
    filtered = filtered.filter((item) => {
      // Check if item.metadata matches all segment filters
      if (!item.metadata) return false;
      return segmentFilters.every(
        (filter) => item.metadata?.[filter.key] === filter.value,
      );
    });
  }

  // Task filter: use the stable option id so label edits keep one history.
  const taskFilter = params.get("task");
  if (taskFilter) {
    filtered = filtered.filter((item) => {
      // Only applies to topTasks survey type
      if (item.surveyType !== "topTasks") return false;

      const taskAnswer = item.answers.find(
        (a) => a.fieldId === SPECIALIZED_SURVEY_FIELD_IDS.task,
      );
      if (!taskAnswer || taskAnswer.fieldType !== "SINGLE_CHOICE") return false;

      return taskAnswer.value.selectedOptionId === taskFilter;
    });
  }

  // Legacy aggregations
  const byRating: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  const byApp: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  const bySurveyId: Record<string, number> = {};
  const ratingByDateAccum: Record<string, { total: number; count: number }> =
    {};
  const byDeviceAccum: Record<string, { total: number; count: number }> = {};
  const byScreenResolution: Record<string, number> = {};
  const byPathnameAccum: Record<string, { total: number; count: number }> = {};

  let totalRating = 0;
  let ratingCount = 0;
  let countWithText = 0;

  for (const item of filtered) {
    // Device stats - always track regardless of rating
    const device = item.context?.deviceType || "unknown";
    if (!byDeviceAccum[device]) {
      byDeviceAccum[device] = { total: 0, count: 0 };
    }
    byDeviceAccum[device].count++;

    const screenResolutionBucket = getScreenResolutionBucket(
      item.context?.screenWidth,
      item.context?.screenHeight,
    );
    if (screenResolutionBucket) {
      byScreenResolution[screenResolutionBucket] =
        (byScreenResolution[screenResolutionBucket] ?? 0) + 1;
    }

    // Pathname stats - always track regardless of rating
    const pathname = item.context?.pathname || "unknown";
    if (!byPathnameAccum[pathname]) {
      byPathnameAccum[pathname] = { total: 0, count: 0 };
    }
    byPathnameAccum[pathname].count++;

    // Rating
    const rating = getRating(item);
    if (rating !== null) {
      byRating[String(rating)]++;
      totalRating += rating;
      ratingCount++;

      // Rating by date
      const date = item.submittedAt.split("T")[0];
      if (!ratingByDateAccum[date]) {
        ratingByDateAccum[date] = { total: 0, count: 0 };
      }
      ratingByDateAccum[date].total += rating;
      ratingByDateAccum[date].count++;

      // Add rating to device stats
      byDeviceAccum[device].total += rating;

      // Add rating to pathname stats
      byPathnameAccum[pathname].total += rating;
    }

    // App
    const appName = item.app || "unknown";
    byApp[appName] = (byApp[appName] || 0) + 1;

    // Date
    const date = item.submittedAt.split("T")[0];
    byDate[date] = (byDate[date] || 0) + 1;

    // Survey
    const currentSurveyId = item.surveyId || "unknown";
    bySurveyId[currentSurveyId] = (bySurveyId[currentSurveyId] || 0) + 1;

    // Text
    if (hasTextResponse(item)) {
      countWithText++;
    }
  }

  // Convert ratingByDateAccum to ratingByDate with averages
  const ratingByDate: Record<string, { average: number; count: number }> = {};
  for (const [date, data] of Object.entries(ratingByDateAccum)) {
    ratingByDate[date] = {
      average: Math.round((data.total / data.count) * 10) / 10,
      count: data.count,
    };
  }

  // Convert device accum to byDevice
  const byDevice: Record<string, { count: number; averageRating: number }> = {};
  for (const [device, data] of Object.entries(byDeviceAccum)) {
    byDevice[device] = {
      count: data.count,
      averageRating: Math.round((data.total / data.count) * 10) / 10,
    };
  }

  // Convert pathname accum to byPathname (top 10)
  const byPathname: Record<string, { count: number; averageRating: number }> =
    {};
  const sortedPathnames = Object.entries(byPathnameAccum)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  for (const [pathname, data] of sortedPathnames) {
    byPathname[pathname] = {
      count: data.count,
      averageRating: Math.round((data.total / data.count) * 10) / 10,
    };
  }

  // Calculate lowestRatingPaths - paths with low average rating (< 3.0) and at least 3 submissions
  const lowestRatingPaths: Record<
    string,
    { count: number; averageRating: number }
  > = {};
  const lowRatingPathEntries = Object.entries(byPathnameAccum)
    .filter(([pathname, data]) => {
      // Exclude unknown paths and require at least 3 submissions
      if (pathname === "unknown" || data.count < 3) return false;
      const avg = data.total / data.count;
      return avg < 3.0 && avg > 0; // Low rating but not zero (which means no ratings)
    })
    .map(([pathname, data]) => ({
      pathname,
      count: data.count,
      averageRating: Math.round((data.total / data.count) * 10) / 10,
    }))
    .sort((a, b) => a.averageRating - b.averageRating) // Lowest first
    .slice(0, 5); // Top 5 worst

  for (const entry of lowRatingPathEntries) {
    lowestRatingPaths[entry.pathname] = {
      count: entry.count,
      averageRating: entry.averageRating,
    };
  }

  // Calculate new field stats
  const fieldStats = calculateFieldStats(filtered);

  // Privacy threshold check
  const MIN_AGGREGATION_THRESHOLD = 5;
  const totalCount = filtered.length;
  const shouldMask = totalCount > 0 && totalCount < MIN_AGGREGATION_THRESHOLD;

  const privacy = shouldMask
    ? {
        masked: true,
        reason: `Antall svar (${totalCount}) er under ${MIN_AGGREGATION_THRESHOLD}. Statistikk vises ikke av hensyn til personvern.`,
        threshold: MIN_AGGREGATION_THRESHOLD,
      }
    : undefined;

  return {
    totalCount,
    countWithText,
    countWithoutText: totalCount - countWithText,
    byRating: shouldMask ? {} : byRating,
    byApp: shouldMask ? {} : byApp,
    byDate: shouldMask ? {} : byDate,
    bySurveyId: shouldMask ? {} : bySurveyId,
    averageRating: shouldMask
      ? null
      : ratingCount > 0
        ? totalRating / ratingCount
        : null,
    ratingByDate: shouldMask ? {} : ratingByDate,
    byDevice: shouldMask ? {} : byDevice,
    byScreenResolution: shouldMask ? {} : byScreenResolution,
    byPathname: shouldMask ? {} : byPathname,
    lowestRatingPaths: shouldMask ? {} : lowestRatingPaths,
    fieldStats: shouldMask ? [] : fieldStats,
    period: calculatePeriod(fromDate, toDate),
    surveyType: totalCount > 0 ? filtered[0].surveyType || "rating" : undefined,
    privacy,
  };
}

function applyFiltersToItems(
  items: FeedbackDto[],
  params: URLSearchParams,
): FeedbackDto[] {
  let filtered = [...items];
  const app = params.get("app");
  const fromDate = params.get("fromDate");
  const toDate = params.get("toDate");
  const surveyId = params.get("surveyId");
  const deviceType = params.get("deviceType");
  if (app) filtered = filtered.filter((item) => item.app === app);
  if (fromDate)
    filtered = filtered.filter((item) => item.submittedAt >= fromDate);
  if (toDate)
    filtered = filtered.filter(
      (item) => item.submittedAt <= `${toDate}T23:59:59Z`,
    );
  if (surveyId)
    filtered = filtered.filter((item) => item.surveyId === surveyId);
  if (deviceType)
    filtered = filtered.filter(
      (item) => item.context?.deviceType === deviceType,
    );

  // Filter by rating answers (multi-value: "fieldId:value,fieldId2:value2")
  const ratingFilters = Object.entries(
    parseRatingParam(params.get("rating") ?? undefined),
  );
  if (ratingFilters.length > 0) {
    filtered = filtered.filter((item) =>
      ratingFilters.every(([fieldId, ratingValue]) => {
        const parsed = Number.parseInt(ratingValue, 10);
        if (Number.isNaN(parsed)) return false;
        return item.answers.some(
          (a) =>
            a.fieldType === "RATING" &&
            a.fieldId === fieldId &&
            a.value.type === "rating" &&
            a.value.rating === parsed,
        );
      }),
    );
  }

  // Filter by choice answers (multi-value: "fieldId:value,fieldId2:value2")
  const choiceFilters = Object.entries(
    parseChoiceParam(params.get("choice") ?? undefined),
  );
  if (choiceFilters.length > 0) {
    filtered = filtered.filter((item) =>
      choiceFilters.every(([fieldId, optionId]) =>
        item.answers.some((a) => {
          if (a.fieldId !== fieldId) return false;
          if (
            a.fieldType === "SINGLE_CHOICE" &&
            a.value.type === "singleChoice"
          )
            return a.value.selectedOptionId === optionId;
          if (a.fieldType === "MULTI_CHOICE" && a.value.type === "multiChoice")
            return a.value.selectedOptionIds.includes(optionId);
          return false;
        }),
      ),
    );
  }

  // Filter by segment (context.tags format: "key:value,key:value")
  const segment = params.get("segment");
  if (segment) {
    const segmentFilters = segment.split(",").map((t) => {
      const [key, value] = t.split(":");
      return { key, value };
    });
    filtered = filtered.filter((item) => {
      if (!item.metadata) return false;
      return segmentFilters.every(
        (filter) => item.metadata?.[filter.key] === filter.value,
      );
    });
  }

  return filtered;
}

export function getMockDiscoveryStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): DiscoveryResponse {
  // Import the dynamic mock themes from themes.ts (they can be mutated by CRUD operations)

  const filtered = applyFiltersToItems(items, params).filter(
    (item) => item.surveyType === "discovery",
  );

  const responses = filtered.map((item) => {
    const taskAnswer = item.answers.find((answer) =>
      isDiscoveryTaskField(answer.fieldId),
    );
    const successAnswer = item.answers.find((answer) =>
      isSuccessField(answer.fieldId),
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

  // Dynamic theme clustering based on mockThemes from themes.ts
  // Only use GENERAL_FEEDBACK themes - BLOCKER themes are for Top Tasks analysis
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

  // Track unique examples per theme to avoid duplicates within each theme
  const usedExamplesPerTheme = new Map<string, Set<string>>();
  for (const theme of themes) {
    usedExamplesPerTheme.set(theme.theme, new Set());
  }

  // INCLUSIVE MATCHING: Each response can match multiple themes (multi-tagging)
  // This ensures dashboard counts match feedback filter results
  for (const response of responses) {
    let matchedAnyTheme = false;

    // Check ALL themes (no break - response can belong to multiple themes)
    for (const theme of themes) {
      if (!theme.keywords || theme.keywords.length === 0) continue; // Skip "Annet"

      if (matchesThemeKeywords(response.task, theme.keywords)) {
        theme.totalCount++;
        if (response.success === "yes") theme.successCount++;
        if (response.success === "partial") theme.partialCount++;
        // Add unique examples per theme
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
        // NO BREAK - continue checking other themes (inclusive matching)
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
        // Success rate: full success = 1, partial = 0.5
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

export function getMockTaskPriorityStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): TaskPriorityResponse {
  const filtered = applyFiltersToItems(items, params).filter(
    (item) => item.surveyType === "taskPriority",
  );

  const voteCounts = new Map<string, number>();
  const taskLabels = new Map<string, string>();

  for (const item of [...filtered].sort(
    (left, right) =>
      new Date(left.submittedAt).getTime() -
      new Date(right.submittedAt).getTime(),
  )) {
    const priorityAnswer = item.answers.find(
      (a) => isPriorityField(a.fieldId) && a.fieldType === "MULTI_CHOICE",
    );

    if (priorityAnswer && priorityAnswer.fieldType === "MULTI_CHOICE") {
      // Cache labels
      if (priorityAnswer.question.options) {
        for (const opt of priorityAnswer.question.options) {
          taskLabels.set(opt.id, opt.label);
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
        taskId,
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

// Internal type for aggregation with additional fields
interface InternalTaskStats
  extends Omit<
    TopTaskStats,
    "avgTimeMs" | "targetTimeMs" | "tpiScore" | "blockersByTheme"
  > {
  totalDurationMs: number;
  durationCount: number;
  blockerTexts: string[]; // Raw blocker texts for theme matching
  latestSubmittedAt: string;
}

export function getMockTopTasksStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): TopTasksResponse {
  const filtered = applyFiltersToItems(items, params);
  const taskFilter = params.get("task");
  const taskMap = new Map<string, InternalTaskStats>();
  const dailyStats: Record<string, { total: number; success: number }> = {};

  for (const item of filtered) {
    if (item.surveyType !== "topTasks") continue;

    const taskAnswer = item.answers.find(
      (a) => a.fieldId === SPECIALIZED_SURVEY_FIELD_IDS.task,
    );
    if (!taskAnswer || taskAnswer.fieldType !== "SINGLE_CHOICE") continue;

    const taskOption = taskAnswer.question.options?.find(
      (o) => o.id === taskAnswer.value.selectedOptionId,
    );
    const taskId = taskAnswer.value.selectedOptionId;
    const task = taskOption ? taskOption.label : taskId;

    // Task filter: skip if task doesn't match the filter
    if (taskFilter && taskId !== taskFilter) continue;

    const successAnswer = item.answers.find((answer) =>
      isSuccessField(answer.fieldId),
    );
    const successValue =
      successAnswer?.fieldType === "SINGLE_CHOICE"
        ? successAnswer.value.selectedOptionId
        : "unknown";

    const blockerAnswer = item.answers.find(
      (a) => a.fieldId === SPECIALIZED_SURVEY_FIELD_IDS.blocker,
    );
    const blocker =
      blockerAnswer?.fieldType === "TEXT" && blockerAnswer.value.text
        ? blockerAnswer.value.text
        : null;

    if (!taskMap.has(taskId)) {
      taskMap.set(taskId, {
        taskId,
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
        latestSubmittedAt: item.submittedAt,
      });
    }

    const stats = taskMap.get(taskId);
    if (stats) {
      if (
        new Date(item.submittedAt).getTime() >=
        new Date(stats.latestSubmittedAt).getTime()
      ) {
        stats.task = task;
        stats.latestSubmittedAt = item.submittedAt;
      }
      stats.totalCount++;

      if (successValue === "yes") stats.successCount++;
      else if (successValue === "partial") stats.partialCount++;
      else if (successValue === "no") stats.failureCount++;

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
    if (successValue === "yes") {
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

    // Use aggregated duration if available, otherwise fallback
    const totalDuration = stats.totalDurationMs || 0;
    const durationCount = stats.durationCount || 0;

    let avgTimeMs = 0;
    if (durationCount > 0) {
      avgTimeMs = Math.round(totalDuration / durationCount);
    } else {
      // Fallback if no duration data (shouldn't happen with new generator)
      avgTimeMs = 60000;
    }

    // Target time is arbitrary for now, but in real app would be configured per task
    const targetTimeMs = 45000;

    // TPI Formula: Success Rate * Efficiency
    // Efficiency = Target / Actual (capped at 1) or similar.
    // McGovern TPI is often just a weighted score, but let's stick to the current logic:
    const timeEfficiency = Math.min(1, targetTimeMs / (avgTimeMs || 1));
    const tpiScore = Math.round(rate * timeEfficiency * 100);

    // Calculate blockersByTheme for this task
    const blockersByTheme: Record<
      string,
      { themeName: string; color: string; count: number; examples: string[] }
    > = {};

    // Initialize theme stats
    for (const theme of blockerThemes) {
      blockersByTheme[theme.id] = {
        themeName: theme.name,
        color: theme.color ?? "#3b82f6",
        count: 0,
        examples: [],
      };
    }
    // Add "Annet" category
    blockersByTheme.annet = {
      themeName: "Annet",
      color: "#9ca3af",
      count: 0,
      examples: [],
    };

    // Categorize each blocker
    for (const blockerText of stats.blockerTexts) {
      let matchedAny = false;

      for (const theme of blockerThemes) {
        if (matchesThemeKeywords(blockerText, theme.keywords)) {
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
            // NO BREAK - continue for inclusive matching
          }
        }
      }

      // Add to "Annet" if no theme matched
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

    // Filter out themes with no matches and remove internal fields
    const filteredBlockersByTheme: typeof blockersByTheme = {};
    for (const [key, value] of Object.entries(blockersByTheme)) {
      if (value.count > 0) {
        filteredBlockersByTheme[key] = value;
      }
    }

    // Remove internal aggregation fields before returning
    const {
      totalDurationMs,
      durationCount: dc,
      blockerTexts,
      latestSubmittedAt,
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

  // Calculate "Other" percentage
  // Use sum of filtered tasks for accurate count after task filter
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
      ?.answers.find((a) => a.fieldId === SPECIALIZED_SURVEY_FIELD_IDS.task)
      ?.question.label,
    overallTpi,
    avgCompletionTimeMs,
    otherTasksPercentage,
  };
}

/**
 * Get blocker pattern statistics for Top Tasks.
 * Uses the same text analysis engine as Discovery, but analyzes blocker text
 * and uses themes with analysisContext = "BLOCKER".
 */
export function getMockBlockerStats(
  items: FeedbackDto[],
  params: URLSearchParams,
): BlockerResponse {
  // Filter for Top Tasks items that have blockers (failed or partial tasks)
  const filtered = applyFiltersToItems(items, params).filter(
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

  // Get blocker themes only (analysisContext = "BLOCKER")
  const blockerThemes = mockThemes.filter(
    (t) => t.analysisContext === "BLOCKER",
  );

  // Theme clustering using inclusive matching (multi-tagging)
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
        // NO BREAK - continue for inclusive matching
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
      .map(({ usedExamples, ...rest }) => rest) // Remove internal Set
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
