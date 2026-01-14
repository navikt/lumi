/**
 * Mock data store - feedback items initialization.
 *
 * This file is the single source of truth for mock feedback data.
 * Import mockFeedbackItems from here for all mock data access.
 *
 * Usage:
 * import { mockFeedbackItems } from "~/mock/store"
 */

import type { FeedbackDto } from "~/types/api";
import {
  generateComplexSurveyData,
  generateDiscoveryMockData,
  generateSurveyData,
  generateTaskPriorityMockData,
  generateTopTasksMockData,
} from "./generators";
import { sykmeldtTopics } from "./topics";

/**
 * Pre-generated mock feedback data.
 * Contains one survey of each type for demonstration:
 * - Rating survey (120 items)
 * - Top Tasks survey
 * - Discovery survey
 * - Task Priority survey
 * - Custom/complex survey
 */
export const mockFeedbackItems: FeedbackDto[] = [
  // 1. RATING SURVEY
  ...generateSurveyData(120, {
    app: "syfo-oppfolgingsplan-frontend",
    surveyId: "survey-vurdering",
    basePath: "/syk/oppfolgingsplaner",
    topics: sykmeldtTopics,
    questions: {
      ratingLabel: "Er oppfølgingsplanen til hjelp for deg?",
      textLabel: "Legg gjerne til en begrunnelse",
    },
    metadataGenerator: () => ({
      harAktivSykmelding: Math.random() > 0.4 ? "Ja" : "Nei",
      ukeSykefravær: String(Math.floor(Math.random() * 8) + 1),
    }),
  }),

  // 2. TOP TASKS SURVEY
  ...generateTopTasksMockData(),

  // 3. DISCOVERY SURVEY
  ...generateDiscoveryMockData(),

  // 4. TASK PRIORITY SURVEY
  ...generateTaskPriorityMockData(),

  // 5. CUSTOM SURVEY
  ...generateComplexSurveyData(),
];

/**
 * Get all mock feedback items.
 * This is the recommended way to access mock data.
 */
export function getAllMockFeedback(): FeedbackDto[] {
  return mockFeedbackItems;
}

/**
 * Get mock feedback items filtered by survey type.
 */
export function getMockFeedbackByType(
  surveyType: FeedbackDto["surveyType"],
): FeedbackDto[] {
  return mockFeedbackItems.filter((item) => item.surveyType === surveyType);
}
