import type {
  BlockerResponse,
  DiscoveryResponse,
  FeedbackDto,
  FeedbackPage,
  FeedbackStats,
  TaskPriorityResponse,
  TeamsAndApps,
  TopTasksResponse,
} from "~/types/api";
import { parseChoiceParam } from "~/utils/choiceFilterUtils";
import { parseRatingParam } from "~/utils/ratingFilterUtils";

import {
  generateComplexSurveyData,
  generateDiscoveryMockData,
  generateNpsSurveyData,
  generateStarsRatingSurveyData,
  generateSurveyData,
  generateTaskPriorityMockData,
  generateThumbsSurveyData,
  generateTopTasksMockData,
} from "./generators";

import {
  createContext,
  createMultiChoiceAnswer,
  createRatingAnswer,
  createSingleChoiceAnswer,
  createTextAnswer,
} from "./helpers";

export {
  generateComplexSurveyData,
  generateDiscoveryMockData,
  generateSurveyData,
  generateTaskPriorityMockData,
  generateTopTasksMockData,
};

import { calculateStats } from "./stats";
import {
  getMockBlockerStats as calculateBlockerStats,
  getMockDiscoveryStats as calculateDiscoveryStats,
  getMockTopTasksStats as calculateTopTasksStats,
} from "./stats/index";

import { getMockTaskPriorityStats as calculateTaskPriorityStats } from "./stats/taskPriority";

import { sykmeldtTopics } from "./topics";

export {
  DISCOVERY_RESPONSES,
  PRIORITY_TASKS,
  sykmeldtTopics,
} from "./topics";

// ============================================
// Mock feedback data - One survey per type for showcase
// ============================================

function generateFieldStatsOrderingSurveyData(count: number): FeedbackDto[] {
  const items: FeedbackDto[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const minutesAgo = i * 7;
    const timestamp = new Date(
      now.getTime() - minutesAgo * 60_000,
    ).toISOString();

    items.push({
      id: `ordering-${i}`,
      submittedAt: timestamp,
      app: "syfo-oppfolgingsplan-frontend",
      surveyId: "survey-ordering",
      surveyType: "custom",
      context: createContext("/ordering", "desktop"),
      answers: [
        createRatingAnswer("svar", "Ordering Q1", 5),
        createSingleChoiceAnswer(
          "single-choice",
          "Ordering Q2",
          "often",
          undefined,
          [
            { id: "often", label: "Ofte" },
            { id: "rarely", label: "Sjelden" },
          ],
        ),
        createTextAnswer("text-comment", "Ordering Q3", `third-${i}`),
        createMultiChoiceAnswer(
          "multi-choice",
          "Ordering Q4",
          ["time", "rules"],
          undefined,
          [
            { id: "time", label: "Tid" },
            { id: "rules", label: "Regelverk" },
          ],
        ),
      ],
      sensitiveDataRedacted: false,
    });
  }

  return items;
}

export const mockFeedbackItems: FeedbackDto[] = [
  // ===========================================
  // 1. RATING SURVEY (type: "rating")
  // Standard feedback with rating + optional text
  // ===========================================
  ...generateSurveyData(120, {
    app: "syfo-oppfolgingsplan-frontend",
    surveyId: "survey-vurdering",
    basePath: "/syk/oppfolgingsplaner",
    topics: sykmeldtTopics,
    questions: {
      ratingLabel: "Er oppfølgingsplanen til hjelp for deg?",
      textLabel: "Legg gjerne til en begrunnelse",
    },
    // Showcase custom metadata fields - keys match what's returned by fetchMetadata mock
    metadataGenerator: () => ({
      abTest: Math.random() > 0.5 ? "A" : "B",
    }),
  }),

  // ===========================================
  // 2. TOP TASKS SURVEY (type: "topTasks")
  // Measures task completion + blockers + time
  // ===========================================
  ...generateTopTasksMockData(),

  // ===========================================
  // 3. DISCOVERY SURVEY (type: "discovery")
  // Open-ended "what did you come to do" analysis
  // ===========================================
  ...generateDiscoveryMockData(),

  // ===========================================
  // 4. TASK PRIORITY SURVEY (type: "taskPriority")
  // Vote-based task prioritization
  // ===========================================
  ...generateTaskPriorityMockData(),

  // ===========================================
  // 5. CUSTOM SURVEY (type: "custom")
  // Multi-field complex survey
  // ===========================================
  ...generateComplexSurveyData(),

  // ===========================================
  // 6. ORDERING SURVEY (type: "rating")
  // Dedicated for verifying per-field ordering in UI
  // ===========================================
  ...generateFieldStatsOrderingSurveyData(12),

  // ===========================================
  // 7. STARS RATING (type: "rating", variant: "stars")
  // 5-point star scale for satisfaction
  // ===========================================
  ...generateStarsRatingSurveyData(40),

  // ===========================================
  // 8. THUMBS RATING (type: "rating", variant: "thumbs")
  // 2-point yes/no for article helpfulness
  // ===========================================
  ...generateThumbsSurveyData(50),

  // ===========================================
  // 9. NPS SURVEY (type: "rating", variant: "nps")
  // 0-10 Net Promoter Score
  // ===========================================
  ...generateNpsSurveyData(60),
];

export * from "./helpers"; // export helpers if needed by tests

// ============================================
// Feedback filtering and pagination
// ============================================

import { mockThemes } from "~/mock/themes";
import { hasTextResponse } from "./helpers";

/**
 * Simple Norwegian stemmer for keyword matching.
 * Mirrors the backend implementation in DiscoveryService.kt
 */
function stemNorwegian(word: string): string {
  const stem = word.toLowerCase().trim();

  const suffixes = [
    "ene",
    "ane",
    "en",
    "et",
    "a",
    "er",
    "ar",
    "te",
    "de",
    "ere",
    "est",
  ];

  for (const suffix of suffixes) {
    if (stem.length > suffix.length + 2 && stem.endsWith(suffix)) {
      return stem.slice(0, -suffix.length);
    }
  }

  return stem;
}

/**
 * Check if feedback text matches any keyword from a theme.
 */
function matchesThemeKeywords(text: string, keywords: string[]): boolean {
  const textWords = text
    .toLowerCase()
    .replace(/[^\wæøå\s]/g, "")
    .split(/\s+/)
    .map(stemNorwegian);

  const keywordStems = keywords.map((k) => stemNorwegian(k.toLowerCase()));
  return keywordStems.some((kStem) => textWords.includes(kStem));
}

/**
 * Get text content from a feedback item for theme matching.
 */
function getFeedbackText(item: FeedbackDto): string {
  const textParts: string[] = [];
  for (const answer of item.answers) {
    if (answer.value.type === "text" && answer.value.text) {
      textParts.push(answer.value.text);
    }
  }
  return textParts.join(" ");
}

function applyFilters(
  items: FeedbackDto[],
  params: URLSearchParams,
): FeedbackDto[] {
  let filtered = [...items];

  const app = params.get("app");
  const fromDate = params.get("fromDate");
  const toDate = params.get("toDate");
  const hasText = params.get("hasText");
  const query = params.get("query");
  const surveyId = params.get("surveyId");
  const lowRating = params.get("lowRating");
  const pathname = params.get("pathname");
  const deviceType = params.get("deviceType");
  const tag = params.get("tag");
  const theme = params.get("theme");
  const segment = params.get("segment");
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
  if (hasText === "true") {
    filtered = filtered.filter((item) => hasTextResponse(item));
  }
  // "Wall of Shame" - filter for low ratings (1-2)
  if (lowRating === "true") {
    filtered = filtered.filter((item) => {
      const ratingAnswer = item.answers.find((a) => a.fieldType === "RATING");
      if (ratingAnswer && ratingAnswer.value.type === "rating") {
        return ratingAnswer.value.rating <= 2;
      }
      return false;
    });
  }
  if (pathname) {
    filtered = filtered.filter((item) =>
      item.context?.pathname?.includes(pathname),
    );
  }
  if (deviceType) {
    filtered = filtered.filter(
      (item) => item.context?.deviceType === deviceType,
    );
  }
  if (query) {
    const search = query.toLowerCase();
    filtered = filtered.filter((item) =>
      item.answers.some((a) => {
        if (a.value.type === "text") {
          return a.value.text.toLowerCase().includes(search);
        }
        return false;
      }),
    );
  }
  if (surveyId) {
    filtered = filtered.filter((item) => item.surveyId === surveyId);
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

  // Filter by tags (supports both item.tags array and metadata key:value format)
  if (tag) {
    const tagList = tag.split(",").map((t) => t.trim());
    filtered = filtered.filter((item) => {
      // Check item.tags array (simple string tags)
      if (item.tags?.some((tag) => tagList.includes(tag))) {
        return true;
      }
      // Check metadata (key:value tags like "abTest:A")
      for (const tagFilter of tagList) {
        if (tagFilter.includes(":")) {
          const [key, value] = tagFilter.split(":");
          if (item.metadata?.[key] === value) {
            return true;
          }
        }
      }
      return false;
    });
  }

  // Filter by theme
  if (theme) {
    if (theme === "uncategorized") {
      // Show feedback that doesn't match any theme's keywords
      filtered = filtered.filter((item) => {
        const text = getFeedbackText(item);
        if (!text) return true; // No text = uncategorized
        // Check if it matches any theme
        return !mockThemes.some((t) => matchesThemeKeywords(text, t.keywords));
      });
    } else {
      // Find the theme by ID
      const targetTheme = mockThemes.find((t) => t.id === theme);
      if (targetTheme && targetTheme.keywords.length > 0) {
        filtered = filtered.filter((item) => {
          const text = getFeedbackText(item);
          return matchesThemeKeywords(text, targetTheme.keywords);
        });
      }
    }
  }

  // Filter by segment (context.tags format: "key:value,key:value")
  if (segment) {
    const segmentFilters = segment.split(",").map((s) => {
      const [key, value] = s.split(":");
      return { key, value };
    });
    filtered = filtered.filter((item) => {
      if (!item.metadata) return false;
      return segmentFilters.every(
        (filter) => item.metadata?.[filter.key] === filter.value,
      );
    });
  }

  // Sort by date descending
  filtered.sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  return filtered;
}

export function filterFeedback(
  items: FeedbackDto[],
  params: URLSearchParams,
): FeedbackPage {
  const filtered = applyFilters(items, params);

  // Paginate
  const page = Number.parseInt(params.get("page") || "0", 10);
  const size = Number.parseInt(params.get("size") || "20", 10);
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return {
    content,
    totalPages: Math.ceil(filtered.length / size),
    totalElements: filtered.length,
    size,
    number: page,
    hasNext: start + size < filtered.length,
    hasPrevious: page > 0,
  };
}

// ============================================
// Public API
// ============================================

export function getMockStats(params: URLSearchParams): FeedbackStats {
  return calculateStats(getMockAnalyticsItems(params), params);
}

export function getMockFeedback(params: URLSearchParams): FeedbackPage {
  return filterFeedback(getMockAnalyticsItems(params), params);
}

export function getMockTeams(): TeamsAndApps {
  return {
    teams: {
      "team-esyfo": ["syfo-oppfolgingsplan-frontend", "dialogmote-frontend"],
    },
  };
}

export function getMockTags(team?: string): string[] {
  // Return actual tags used in the feedback, not surveyIds
  const allTags = new Set<string>();
  for (const item of getMockItemsForTeam(team)) {
    if (item.tags) {
      for (const tag of item.tags) {
        allTags.add(tag);
      }
    }
  }
  return Array.from(allTags).sort();
}

export function getMockTopTasksStats(
  params: URLSearchParams,
): TopTasksResponse {
  return calculateTopTasksStats(getMockAnalyticsItems(params), params);
}

export function getMockDiscoveryStats(
  params: URLSearchParams,
): DiscoveryResponse {
  return calculateDiscoveryStats(getMockAnalyticsItems(params), params);
}

export function getMockTaskPriorityStats(
  params: URLSearchParams,
): TaskPriorityResponse {
  return calculateTaskPriorityStats(getMockAnalyticsItems(params), params);
}

export function getMockBlockerStats(params: URLSearchParams): BlockerResponse {
  return calculateBlockerStats(getMockAnalyticsItems(params), params);
}

export function getMockSurveyTypeDistribution(
  team?: string,
  includeArchived = false,
): {
  totalSurveys: number;
  distribution: { type: string; count: number; percentage: number }[];
} {
  const typeCounts: Record<string, number> = {};
  const seenSurveys = new Set<string>();

  for (const item of filterMockArchiveVisibility(
    getMockItemsForTeam(team),
    includeArchived,
  )) {
    const surveyId = item.surveyId;
    if (seenSurveys.has(surveyId)) continue;
    seenSurveys.add(surveyId);

    const surveyType = item.surveyType || "custom";
    typeCounts[surveyType] = (typeCounts[surveyType] || 0) + 1;
  }

  const totalSurveys = seenSurveys.size;
  const distribution = Object.entries(typeCounts)
    .map(([type, count]) => ({
      type,
      count,
      percentage:
        totalSurveys > 0 ? Math.round((count / totalSurveys) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { totalSurveys, distribution };
}

const MOCK_TEAM_BY_APP: Record<string, string> = {
  "syfo-oppfolgingsplan-frontend": "team-esyfo",
  "dialogmote-frontend": "team-esyfo",
  "nav-no-frontend": "team-esyfo",
};

function getMockItemsForTeam(team?: string): FeedbackDto[] {
  const resolvedTeam = team ?? "team-esyfo";

  return mockFeedbackItems.filter((item) => {
    const app = item.app ?? "unknown";
    return (MOCK_TEAM_BY_APP[app] ?? "team-esyfo") === resolvedTeam;
  });
}

export function getMockSurveysByApp(team?: string): Record<string, string[]> {
  const surveysByApp: Record<string, string[]> = {};
  const hiddenSurveyIds = new Set(["survey-ordering"]);

  for (const item of getMockItemsForTeam(team)) {
    const app = item.app || "unknown";
    const surveyId = item.surveyId;

    if (hiddenSurveyIds.has(surveyId)) continue;

    if (!surveysByApp[app]) {
      surveysByApp[app] = [];
    }
    if (surveyId && !surveysByApp[app].includes(surveyId)) {
      surveysByApp[app].push(surveyId);
    }
  }

  return surveysByApp;
}

/**
 * Get filter bootstrap data for mock mode.
 * Provides all data needed for FilterBar dropdowns.
 */
// Mutable so mock archive/restore behaves like the real backend in demo mode.
// survey-thumbs starts archived to showcase the "Vis arkiverte" toggle.
const mockSurveyMeta: Record<string, { archivedAt: string | null }> = {
  "survey-thumbs": { archivedAt: "2026-07-01T10:00:00.000Z" },
};

export function filterMockArchiveVisibility(
  items: FeedbackDto[],
  includeArchived: boolean,
): FeedbackDto[] {
  if (includeArchived) return items;
  return items.filter(
    (item) => mockSurveyMeta[item.surveyId]?.archivedAt == null,
  );
}

function getMockAnalyticsItems(params: URLSearchParams): FeedbackDto[] {
  return filterMockArchiveVisibility(
    getMockItemsForTeam(params.get("team") ?? undefined),
    params.get("includeArchived") === "true",
  );
}

export function archiveMockSurvey(surveyId: string): {
  surveyId: string;
  archivedAt: string | null;
  archivedBy: string | null;
} {
  const existing = mockSurveyMeta[surveyId];
  if (!existing || existing.archivedAt == null) {
    mockSurveyMeta[surveyId] = { archivedAt: new Date().toISOString() };
  }
  return {
    surveyId,
    archivedAt: mockSurveyMeta[surveyId].archivedAt,
    archivedBy: "Z999999",
  };
}

export function unarchiveMockSurvey(surveyId: string): void {
  if (mockSurveyMeta[surveyId]) {
    mockSurveyMeta[surveyId] = { archivedAt: null };
  }
}

export function getMockFilterBootstrap(team?: string): {
  generatedAt: string;
  selectedTeam: string;
  availableTeams: string[];
  deviceTypes: string[];
  apps: string[];
  surveysByApp: Record<string, string[]>;
  tags: string[];
  surveyMeta: Record<
    string,
    { archivedAt: string | null; lastSubmissionAt?: string }
  >;
} {
  void team;
  const availableTeams = ["team-esyfo"];
  const selectedTeam = "team-esyfo";

  const surveysByApp = getMockSurveysByApp(selectedTeam);
  const apps = Object.keys(surveysByApp).sort();
  const tags = getMockTags(selectedTeam);

  // Mirrors the backend's MAX(opprettet)-per-survey aggregation
  const lastSubmissionBySurvey: Record<string, string> = {};
  for (const item of getMockItemsForTeam(selectedTeam)) {
    if (!item.surveyId) continue;
    const current = lastSubmissionBySurvey[item.surveyId];
    if (!current || item.submittedAt > current) {
      lastSubmissionBySurvey[item.surveyId] = item.submittedAt;
    }
  }

  const surveyMeta: Record<
    string,
    { archivedAt: string | null; lastSubmissionAt?: string }
  > = {};
  for (const [surveyId, lastSubmissionAt] of Object.entries(
    lastSubmissionBySurvey,
  )) {
    surveyMeta[surveyId] = { archivedAt: null, lastSubmissionAt };
  }
  for (const [surveyId, meta] of Object.entries(mockSurveyMeta)) {
    surveyMeta[surveyId] = {
      ...(surveyMeta[surveyId] ?? {}),
      archivedAt: meta.archivedAt,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    selectedTeam,
    availableTeams,
    deviceTypes: ["mobile", "tablet", "desktop"],
    apps,
    surveysByApp,
    tags,
    surveyMeta,
  };
}

// Delete all feedback for a survey (mock implementation)
export function deleteMockSurvey(surveyId: string): {
  deletedCount: number;
  surveyId: string;
} {
  const initialLength = mockFeedbackItems.length;

  // Filter out items with matching surveyId
  const itemsToKeep = mockFeedbackItems.filter(
    (item) => item.surveyId !== surveyId,
  );
  const deletedCount = initialLength - itemsToKeep.length;

  // Replace the array contents (mutate in place since it's a module-level variable)
  mockFeedbackItems.length = 0;
  mockFeedbackItems.push(...itemsToKeep);

  console.log(`[Mock] Deleted ${deletedCount} items for survey "${surveyId}"`);

  return { deletedCount, surveyId };
}

// Delete single feedback item (mock implementation)
export function deleteMockFeedback(id: string): boolean {
  const initialLength = mockFeedbackItems.length;

  // Filter out item with matching id
  const itemsToKeep = mockFeedbackItems.filter((item) => item.id !== id);
  const deleted = initialLength !== itemsToKeep.length;

  // Replace the array contents
  mockFeedbackItems.length = 0;
  mockFeedbackItems.push(...itemsToKeep);

  console.log(`[Mock] ${deleted ? "Deleted" : "Not found"} feedback "${id}"`);

  return deleted;
}

/**
 * Calculate actual context tags from mock data for a specific survey.
 * Returns real counts that match what the segment filter will produce.
 */
export function getMockContextTags(
  surveyId: string,
  team: string | undefined,
  maxCardinality = 15,
  task?: string,
  segment?: string,
  fromDate?: string,
  toDate?: string,
  deviceType?: string,
  hasText = false,
  lowRating = false,
): Record<string, { value: string; count: number }[]> {
  // Filter items by surveyId (and team)
  let surveyItems = getMockItemsForTeam(team).filter(
    (item) => item.surveyId === surveyId,
  );

  // Period filter (must match the feedback filtering logic)
  if (fromDate) {
    surveyItems = surveyItems.filter((item) => item.submittedAt >= fromDate);
  }
  if (toDate) {
    surveyItems = surveyItems.filter(
      (item) => item.submittedAt <= `${toDate}T23:59:59Z`,
    );
  }

  // Device type filter
  if (deviceType) {
    surveyItems = surveyItems.filter(
      (item) => item.context?.deviceType === deviceType,
    );
  }

  // Has text filter
  if (hasText) {
    surveyItems = surveyItems.filter((item) => hasTextResponse(item));
  }

  // Low rating filter (1-2)
  if (lowRating) {
    surveyItems = surveyItems.filter((item) => {
      const ratingAnswer = item.answers.find((a) => a.fieldType === "RATING");
      if (ratingAnswer && ratingAnswer.value.type === "rating") {
        return ratingAnswer.value.rating <= 2;
      }
      return false;
    });
  }

  // Task filter: filter by specific task name (for Top Tasks drill-down)
  if (task) {
    surveyItems = surveyItems.filter((item) => {
      if (item.surveyType !== "topTasks") return false;

      const taskAnswer = item.answers.find((a) => a.fieldId === "task");
      if (!taskAnswer || taskAnswer.fieldType !== "SINGLE_CHOICE") return false;

      const taskOption = taskAnswer.question.options?.find(
        (o) => o.id === taskAnswer.value.selectedOptionId,
      );
      const taskName = taskOption
        ? taskOption.label
        : taskAnswer.value.selectedOptionId;

      return taskName === task;
    });
  }

  // Segment filter (format: "key:value,key:value")
  if (segment) {
    const segmentFilters = segment.split(",").map((s) => {
      const [key, value] = s.split(":");
      return { key, value };
    });

    surveyItems = surveyItems.filter((item) => {
      if (!item.metadata) return false;
      return segmentFilters.every(
        (filter) => item.metadata?.[filter.key] === filter.value,
      );
    });
  }

  // Build context tag counts from actual metadata
  const tagCounts: Record<string, Map<string, number>> = {};

  for (const item of surveyItems) {
    if (!item.metadata) continue;

    for (const [key, value] of Object.entries(item.metadata)) {
      if (!tagCounts[key]) {
        tagCounts[key] = new Map();
      }
      tagCounts[key].set(value, (tagCounts[key].get(value) || 0) + 1);
    }
  }

  // Convert to response format and apply cardinality filter
  const result: Record<string, { value: string; count: number }[]> = {};

  for (const [key, valueMap] of Object.entries(tagCounts)) {
    // Skip high-cardinality keys (like IDs)
    if (valueMap.size > maxCardinality) continue;

    result[key] = Array.from(valueMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }

  return result;
}
