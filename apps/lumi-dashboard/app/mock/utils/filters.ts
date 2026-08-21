/**
 * Unified filter utilities for mock data.
 */

import {
  LEGACY_SPECIALIZED_SURVEY_FIELD_IDS,
  SPECIALIZED_SURVEY_FIELD_IDS,
} from "@navikt/lumi-survey";
import type { FeedbackDto } from "~/types/api";
import { parseChoiceParam } from "~/utils/choiceFilterUtils";
import { parsePhraseParam } from "~/utils/phraseFilterUtils";
import { parseRatingParam } from "~/utils/ratingFilterUtils";
import { textMatchesPhrase } from "../stats/phrases";
import { mockThemes } from "../themes";
import { getTaskIdFromFeedback } from "./extractors";
import { matchesThemeKeywords } from "./textAnalysis";

const DISCOVERY_TASK_FIELD_IDS = new Set<string>([
  SPECIALIZED_SURVEY_FIELD_IDS.task,
  LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.discoveryTask,
]);

export interface FilterParams {
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  segment?: string;
  task?: string;
  hasText?: string;
  lowRating?: string;
  theme?: string;
  rating?: string;
  choice?: string;
  phrase?: string;
}

export function applyFeedbackFilters(
  items: FeedbackDto[],
  params: FilterParams | URLSearchParams,
): FeedbackDto[] {
  const filters = normalizeParams(params);

  let filtered = [...items];

  if (filters.app) {
    filtered = filtered.filter((item) => item.app === filters.app);
  }

  if (filters.surveyId) {
    filtered = filtered.filter((item) => item.surveyId === filters.surveyId);
  }

  if (filters.fromDate) {
    const fromDate = filters.fromDate;
    filtered = filtered.filter((item) => item.submittedAt >= fromDate);
  }
  if (filters.toDate) {
    const toDate = filters.toDate;
    filtered = filtered.filter(
      (item) => item.submittedAt <= `${toDate}T23:59:59Z`,
    );
  }

  if (filters.deviceType) {
    filtered = filtered.filter(
      (item) => item.context?.deviceType === filters.deviceType,
    );
  }

  if (filters.segment) {
    const segmentFilters = filters.segment.split(",").map((part) => {
      const [key, value] = part.split(":");
      return { key, value };
    });

    filtered = filtered.filter((item) => {
      if (!item.metadata) return false;
      return segmentFilters.every(
        (filter) => item.metadata?.[filter.key] === filter.value,
      );
    });
  }

  if (filters.task) {
    filtered = filtered.filter(
      (item) => getTaskIdFromFeedback(item) === filters.task,
    );
  }

  if (filters.theme) {
    if (filters.theme === "uncategorized") {
      filtered = filtered.filter((item) => {
        const text = getFeedbackText(item);
        if (!text) return true;
        return !mockThemes.some((theme) =>
          matchesThemeKeywords(text, theme.keywords),
        );
      });
    } else {
      const targetTheme = mockThemes.find(
        (theme) => theme.id === filters.theme,
      );
      if (targetTheme?.keywords.length) {
        filtered = filtered.filter((item) =>
          matchesThemeKeywords(getFeedbackText(item), targetTheme.keywords),
        );
      }
    }
  }

  if (filters.hasText === "true") {
    filtered = filtered.filter((item) =>
      item.answers.some(
        (answer) => answer.fieldType === "TEXT" && answer.value.text?.trim(),
      ),
    );
  }

  if (filters.lowRating === "true") {
    filtered = filtered.filter((item) =>
      item.answers.some(
        (answer) =>
          answer.fieldType === "RATING" && (answer.value.rating ?? 3) <= 2,
      ),
    );
  }

  const ratingFilters = parseRatingParam(filters.rating);
  if (Object.keys(ratingFilters).length > 0) {
    filtered = filtered.filter((item) =>
      Object.entries(ratingFilters).every(([fieldId, ratingValue]) => {
        const parsed = Number.parseInt(ratingValue, 10);
        if (Number.isNaN(parsed)) return false;

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

  const choiceFilters = parseChoiceParam(filters.choice);
  if (Object.keys(choiceFilters).length > 0) {
    filtered = filtered.filter((item) =>
      Object.entries(choiceFilters).every(([fieldId, choiceValue]) =>
        item.answers.some((answer) => {
          if (answer.fieldId !== fieldId) return false;

          if (
            answer.fieldType === "SINGLE_CHOICE" &&
            answer.value.type === "singleChoice"
          ) {
            return answer.value.selectedOptionId === choiceValue;
          }

          if (
            answer.fieldType === "MULTI_CHOICE" &&
            answer.value.type === "multiChoice"
          ) {
            return answer.value.selectedOptionIds.includes(choiceValue);
          }

          return false;
        }),
      ),
    );
  }

  const phraseFilter = parsePhraseParam(filters.phrase);
  if (phraseFilter) {
    filtered = filtered.filter((item) =>
      item.answers.some((answer) => {
        const sameField = answer.fieldId === phraseFilter.fieldId;
        const sameDiscoveryAlias =
          item.surveyType === "discovery" &&
          DISCOVERY_TASK_FIELD_IDS.has(answer.fieldId) &&
          DISCOVERY_TASK_FIELD_IDS.has(phraseFilter.fieldId);
        if (!sameField && !sameDiscoveryAlias) return false;
        if (answer.fieldType !== "TEXT") return false;
        return textMatchesPhrase(answer.value.text ?? "", phraseFilter.surface);
      }),
    );
  }

  return filtered;
}

function getFeedbackText(item: FeedbackDto): string {
  const textAnswer = item.answers.find((answer) => answer.fieldType === "TEXT");
  return textAnswer?.fieldType === "TEXT" ? (textAnswer.value.text ?? "") : "";
}

function normalizeParams(params: FilterParams | URLSearchParams): FilterParams {
  if (params instanceof URLSearchParams) {
    return {
      app: params.get("app") ?? undefined,
      surveyId: params.get("surveyId") ?? undefined,
      fromDate: params.get("fromDate") ?? undefined,
      toDate: params.get("toDate") ?? undefined,
      deviceType: params.get("deviceType") ?? undefined,
      segment: params.get("segment") ?? undefined,
      task: params.get("task") ?? undefined,
      hasText: params.get("hasText") ?? undefined,
      lowRating: params.get("lowRating") ?? undefined,
      theme: params.get("theme") ?? undefined,
      rating: params.get("rating") ?? undefined,
      choice: params.get("choice") ?? undefined,
      phrase: params.get("phrase") ?? undefined,
    };
  }

  return params;
}

export function toURLSearchParams(params: FilterParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}
