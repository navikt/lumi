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
          ...(question.maxSelections === undefined
            ? {}
            : {
                // Flat 2.0.x configs could declare a limit above their option
                // count. Its effective limit was still the option count; keep
                // that runtime behavior when serializing the stricter V2
                // definition. V1 documents reject this shape during validation.
                maxSelections: Math.min(
                  question.maxSelections,
                  question.options.length,
                ),
              }),
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
