import type { SurveyType } from "~/types/api";

export interface SurveyFeatureConfig {
  /** Show free-text search filter */
  showTextFilter: boolean;
  /** Show low rating (1-2) quick filter */
  showRatingFilter: boolean;
  /** Show device type toggle (desktop/mobile) */
  showDeviceFilter: boolean;
  /** Show tags multi-select filter */
  showTagsFilter: boolean;
}

/**
 * Survey-type specific feature configurations.
 * Controls which filters and UI elements are shown for each survey type.
 */
export const SURVEY_CONFIG: Record<
  SurveyType | "default",
  SurveyFeatureConfig
> = {
  topTasks: {
    showTextFilter: false, // Top tasks uses structured choice data, not free text
    showRatingFilter: false, // Uses success/partial/fail instead of 1-5 stars
    showDeviceFilter: true,
    showTagsFilter: true,
  },
  rating: {
    showTextFilter: true,
    showRatingFilter: true,
    showDeviceFilter: true,
    showTagsFilter: true,
  },
  discovery: {
    showTextFilter: true, // Has open-ended text responses
    showRatingFilter: false, // Uses success/partial/fail, not star ratings
    showDeviceFilter: true,
    showTagsFilter: true,
  },
  taskPriority: {
    showTextFilter: false, // Vote-based survey, no text to search
    showRatingFilter: false, // No rating, just vote counts
    showDeviceFilter: true,
    showTagsFilter: true,
  },
  custom: {
    showTextFilter: true,
    showRatingFilter: true,
    showDeviceFilter: true,
    showTagsFilter: true,
  },
  default: {
    showTextFilter: true,
    showRatingFilter: true,
    showDeviceFilter: true,
    showTagsFilter: true,
  },
};

/**
 * Get the feature configuration for a given survey type.
 * Falls back to default config if type is unknown.
 */
export function getSurveyFeatures(
  type?: SurveyType | string,
): SurveyFeatureConfig {
  if (type && type in SURVEY_CONFIG) {
    return SURVEY_CONFIG[type as SurveyType];
  }
  return SURVEY_CONFIG.default;
}
