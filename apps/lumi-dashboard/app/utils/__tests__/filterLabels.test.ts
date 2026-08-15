import { describe, expect, it } from "vitest";

import type { SearchParams } from "~/hooks/useSearchParams";
import type { FeedbackStats, TextTheme } from "~/types/api";
import {
  getActiveChoiceFilterLabels,
  getActiveRatingFilterLabels,
  getFilterLabels,
  getThemeLabel,
} from "~/utils/filterLabels";

function makeStats(
  fieldStats: FeedbackStats["fieldStats"] = [],
): FeedbackStats {
  return {
    totalCount: 0,
    countWithText: 0,
    countWithoutText: 0,
    byRating: {},
    byApp: {},
    byDate: {},
    bySurveyId: {},
    averageRating: null,
    ratingByDate: {},
    byDevice: {},
    byScreenResolution: {},
    byPathname: {},
    lowestRatingPaths: {},
    fieldStats,
    period: {
      fromDate: null,
      toDate: null,
      days: 0,
    },
  };
}

function makeParams(params: Partial<SearchParams>): SearchParams {
  return { choice: undefined, rating: undefined, ...params } as SearchParams;
}

describe("filterLabels", () => {
  describe("getThemeLabel", () => {
    it("returns undefined when no theme is selected", () => {
      expect(
        getThemeLabel({ params: makeParams({}), themes: [] }),
      ).toBeUndefined();
    });

    it("returns Annet for the uncategorized theme", () => {
      expect(
        getThemeLabel({
          params: makeParams({ theme: "uncategorized" }),
          themes: [],
        }),
      ).toBe("Annet");
    });

    it("resolves the selected theme name from the theme list", () => {
      const themes: TextTheme[] = [
        {
          id: "login",
          team: "team-lumi",
          name: "Innlogging",
          keywords: ["logg inn"],
          priority: 1,
          analysisContext: "GENERAL_FEEDBACK",
        },
      ];

      expect(
        getThemeLabel({
          params: makeParams({ theme: "login" }),
          themes,
        }),
      ).toBe("Innlogging");
    });

    it("falls back to the raw theme id when the theme is not found", () => {
      expect(
        getThemeLabel({
          params: makeParams({ theme: "missing-theme" }),
          themes: [],
        }),
      ).toBe("missing-theme");
    });
  });

  describe("getActiveRatingFilterLabels", () => {
    it("returns an empty list when no rating filter is selected", () => {
      expect(
        getActiveRatingFilterLabels({
          params: makeParams({}),
        }),
      ).toEqual([]);
    });

    it("uses generic labels and raw values without stats", () => {
      expect(
        getActiveRatingFilterLabels({
          params: makeParams({ rating: "satisfaction:5" }),
        }),
      ).toEqual([
        {
          fieldId: "satisfaction",
          key: "rating-satisfaction-5",
          label: "Vurdering",
          value: "5",
        },
      ]);
    });

    it("uses the field label when matching rating stats exist", () => {
      const stats = makeStats([
        {
          fieldId: "satisfaction",
          fieldType: "RATING",
          label: "Hvor fornøyd er du?",
          stats: {
            type: "rating",
            average: 4.2,
            distribution: { 4: 2, 5: 5 },
          },
        },
      ]);

      expect(
        getActiveRatingFilterLabels({
          params: makeParams({ rating: "satisfaction:5" }),
          stats,
        }),
      ).toEqual([
        {
          fieldId: "satisfaction",
          key: "rating-satisfaction-5",
          label: "Hvor fornøyd er du?",
          value: "5",
        },
      ]);
    });

    it("maps inferred thumbs values to Ja and Nei", () => {
      expect(
        getActiveRatingFilterLabels({
          params: makeParams({ rating: "helpful:2,negative:1" }),
          stats: makeStats([
            {
              fieldId: "helpful",
              fieldType: "RATING",
              label: "Var dette nyttig?",
              stats: {
                type: "rating",
                average: 1.5,
                distribution: { 1: 2, 2: 4 },
              },
            },
            {
              fieldId: "negative",
              fieldType: "RATING",
              label: "Ble du hjulpet?",
              stats: {
                type: "rating",
                average: 1.2,
                distribution: { 1: 5, 2: 1 },
              },
            },
          ]),
        }),
      ).toEqual([
        {
          fieldId: "helpful",
          key: "rating-helpful-2",
          label: "Var dette nyttig?",
          value: "Ja",
        },
        {
          fieldId: "negative",
          key: "rating-negative-1",
          label: "Ble du hjulpet?",
          value: "Nei",
        },
      ]);
    });

    it("keeps numeric values for stars ratings", () => {
      const starsStats = {
        type: "rating" as const,
        average: 4.4,
        distribution: { 4: 2, 5: 6 },
        ratingVariant: "stars",
      };

      const stats = makeStats([
        {
          fieldId: "stars",
          fieldType: "RATING",
          label: "Gi stjerner",
          stats: starsStats,
        },
      ]);

      expect(
        getActiveRatingFilterLabels({
          params: makeParams({ rating: "stars:4" }),
          stats,
        }),
      ).toEqual([
        {
          fieldId: "stars",
          key: "rating-stars-4",
          label: "Gi stjerner",
          value: "4",
        },
      ]);
    });

    it("keeps numeric values for NPS ratings", () => {
      const stats = makeStats([
        {
          fieldId: "recommend",
          fieldType: "RATING",
          label: "Vil du anbefale oss?",
          stats: {
            type: "rating",
            average: 8.4,
            distribution: { 0: 1, 10: 7 },
          },
        },
      ]);

      expect(
        getActiveRatingFilterLabels({
          params: makeParams({ rating: "recommend:10" }),
          stats,
        }),
      ).toEqual([
        {
          fieldId: "recommend",
          key: "rating-recommend-10",
          label: "Vil du anbefale oss?",
          value: "10",
        },
      ]);
    });
  });

  describe("getActiveChoiceFilterLabels", () => {
    it("returns an empty list when no choice filter is selected", () => {
      expect(
        getActiveChoiceFilterLabels({
          params: makeParams({}),
        }),
      ).toEqual([]);
    });

    it("uses a placeholder value without stats", () => {
      expect(
        getActiveChoiceFilterLabels({
          params: makeParams({ choice: "task:application" }),
        }),
      ).toEqual([
        {
          fieldId: "task",
          key: "choice-task-application",
          label: "Valg",
          value: "…",
        },
      ]);
    });

    it("uses the choice field label and option label from stats", () => {
      const stats = makeStats([
        {
          fieldId: "task",
          fieldType: "SINGLE_CHOICE",
          label: "Hva gjelder det?",
          stats: {
            type: "choice",
            distribution: {
              application: {
                label: "Søknad",
                count: 3,
                percentage: 60,
              },
            },
          },
        },
      ]);

      expect(
        getActiveChoiceFilterLabels({
          params: makeParams({ choice: "task:application" }),
          stats,
        }),
      ).toEqual([
        {
          fieldId: "task",
          key: "choice-task-application",
          label: "Hva gjelder det?",
          value: "Søknad",
        },
      ]);
    });

    it("falls back to the raw option id when stats exist but the option label is missing", () => {
      const stats = makeStats([
        {
          fieldId: "task",
          fieldType: "MULTI_CHOICE",
          label: "Hva gjelder det?",
          stats: {
            type: "choice",
            distribution: {
              somethingElse: {
                label: "Noe annet",
                count: 1,
                percentage: 100,
              },
            },
          },
        },
      ]);

      expect(
        getActiveChoiceFilterLabels({
          params: makeParams({ choice: "task:missing-option" }),
          stats,
        }),
      ).toEqual([
        {
          fieldId: "task",
          key: "choice-task-missing-option",
          label: "Hva gjelder det?",
          value: "missing-option",
        },
      ]);
    });

    it("falls back to a generic label when the matching field is not a choice field", () => {
      const stats = makeStats([
        {
          fieldId: "task",
          fieldType: "TEXT",
          label: "Kommentar",
          stats: {
            type: "text",
            responseCount: 1,
            responseRate: 100,
            topKeywords: [],
            recentResponses: [],
          },
        },
      ]);

      expect(
        getActiveChoiceFilterLabels({
          params: makeParams({ choice: "task:application" }),
          stats,
        }),
      ).toEqual([
        {
          fieldId: "task",
          key: "choice-task-application",
          label: "Valg",
          value: "application",
        },
      ]);
    });
  });

  describe("getFilterLabels", () => {
    it("combines choice filters, rating filters, and the resolved theme label", () => {
      const thumbsStats = {
        type: "rating" as const,
        average: 1.7,
        distribution: { 1: 2, 2: 5 },
        ratingVariant: "thumbs",
      };

      const stats = makeStats([
        {
          fieldId: "task",
          fieldType: "SINGLE_CHOICE",
          label: "Hva gjelder det?",
          stats: {
            type: "choice",
            distribution: {
              application: {
                label: "Søknad",
                count: 4,
                percentage: 100,
              },
            },
          },
        },
        {
          fieldId: "helpful",
          fieldType: "RATING",
          label: "Var dette nyttig?",
          stats: thumbsStats,
        },
      ]);

      const themes: TextTheme[] = [
        {
          id: "login",
          team: "team-lumi",
          name: "Innlogging",
          keywords: ["innlogging"],
          priority: 1,
          analysisContext: "GENERAL_FEEDBACK",
        },
      ];

      expect(
        getFilterLabels({
          params: makeParams({
            choice: "task:application",
            rating: "helpful:2",
            theme: "login",
          }),
          stats,
          themes,
        }),
      ).toEqual({
        choiceFilters: [
          {
            fieldId: "task",
            key: "choice-task-application",
            label: "Hva gjelder det?",
            value: "Søknad",
          },
        ],
        ratingFilters: [
          {
            fieldId: "helpful",
            key: "rating-helpful-2",
            label: "Var dette nyttig?",
            value: "Ja",
          },
        ],
        themeLabel: "Innlogging",
      });
    });
  });
});
