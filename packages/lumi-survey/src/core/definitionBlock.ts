import type {
  LumiSurveyQuestion,
  RatingQuestion,
  SurveyType,
  TransportDefinition,
  TransportFieldDefinition,
} from "./types";
import { RATING_SCALES } from "./types";

/**
 * Builds the `definition` block for v2 transport payload.
 * Includes ALL survey questions, not just answered ones.
 */
export function buildDefinitionBlock(
  questions: LumiSurveyQuestion[],
  surveyType: SurveyType,
): TransportDefinition {
  const fields: TransportFieldDefinition[] = questions.map((question) => {
    switch (question.type) {
      case "rating": {
        const ratingQ = question as RatingQuestion;
        const variant = ratingQ.variant ?? "emoji";
        return {
          fieldId: question.id,
          fieldType: "RATING" as const,
          ratingVariant: variant,
          ratingScale: RATING_SCALES[variant],
        };
      }
      case "singleChoice":
        return {
          fieldId: question.id,
          fieldType: "SINGLE_CHOICE" as const,
          optionIds: question.options.map((o) => o.value),
        };
      case "multiChoice":
        return {
          fieldId: question.id,
          fieldType: "MULTI_CHOICE" as const,
          optionIds: question.options.map((o) => o.value),
        };
      default:
        return {
          fieldId: question.id,
          fieldType: "TEXT" as const,
        };
    }
  });

  return { surveyType, fields };
}
