import type {
  LumiSurveyQuestion,
  RatingQuestion,
  RatingVariant,
  SurveyType,
} from "./types";
import { RATING_SCALES } from "./types";

/**
 * A field definition for the v2 transport payload.
 * Mirrors SubmissionFieldDefinition from lumi-types.
 */
export type FieldDefinition =
  | {
      fieldId: string;
      fieldType: "RATING";
      ratingVariant: RatingVariant;
      ratingScale: number;
    }
  | { fieldId: string; fieldType: "TEXT" }
  | { fieldId: string; fieldType: "SINGLE_CHOICE"; optionIds: string[] }
  | { fieldId: string; fieldType: "MULTI_CHOICE"; optionIds: string[] };

export interface DefinitionBlock {
  surveyType: SurveyType;
  fields: FieldDefinition[];
}

/**
 * Builds the `definition` block for v2 transport payload.
 * Includes ALL survey questions, not just answered ones.
 */
export function buildDefinitionBlock(
  questions: LumiSurveyQuestion[],
  surveyType: SurveyType,
): DefinitionBlock {
  const fields: FieldDefinition[] = questions.map((question) => {
    switch (question.type) {
      case "rating": {
        const ratingQ = question as RatingQuestion;
        const variant: RatingVariant = ratingQ.variant ?? "emoji";
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
