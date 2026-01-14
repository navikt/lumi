/**
 * Common generator types and utilities.
 *
 * Provides shared types for survey generation.
 */

import type { FeedbackTopic } from "../topics";

// Re-export helpers
export {
  createContext,
  createDateAnswer,
  createMultiChoiceAnswer,
  createRatingAnswer,
  createSingleChoiceAnswer,
  createTextAnswer,
} from "../helpers";

// Re-export topics type
export type { FeedbackTopic };

/**
 * Configuration for survey generation.
 */
export interface SurveyConfig {
  app: string;
  surveyId: string;
  basePath: string;
  topics: FeedbackTopic[];
  questions: {
    ratingLabel: string;
    textLabel?: string;
    textLabel2?: string;
  };
  /** Optional metadata generator - returns metadata for each item */
  metadataGenerator?: () => Record<string, string>;
}
