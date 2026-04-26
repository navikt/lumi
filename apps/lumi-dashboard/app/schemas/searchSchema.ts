import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const optionalStringParam = fallback(z.string().optional(), undefined).catch(
  undefined,
);

export const searchSchema = z
  .object({
    team: optionalStringParam,
    app: optionalStringParam,
    page: optionalStringParam,
    size: optionalStringParam,
    fromDate: optionalStringParam,
    toDate: optionalStringParam,
    hasText: optionalStringParam,
    query: optionalStringParam,
    tag: optionalStringParam,
    surveyId: optionalStringParam,
    lowRating: optionalStringParam,
    deviceType: optionalStringParam,
    theme: optionalStringParam,
    segment: optionalStringParam,
    task: optionalStringParam,
    choice: optionalStringParam,
    rating: optionalStringParam,
    phrase: optionalStringParam,
    // Legacy params — kept temporarily for bookmarked URL migration
    choiceFieldId: optionalStringParam,
    choiceValue: optionalStringParam,
    ratingFieldId: optionalStringParam,
    ratingValue: optionalStringParam,
  })
  .transform(
    ({
      choiceFieldId,
      choiceValue,
      ratingFieldId,
      ratingValue,
      choice,
      rating,
      ...rest
    }) => ({
      ...rest,
      choice:
        choice ??
        (choiceFieldId && choiceValue
          ? `${choiceFieldId}:${choiceValue}`
          : undefined),
      rating:
        rating ??
        (ratingFieldId && ratingValue
          ? `${ratingFieldId}:${ratingValue}`
          : undefined),
    }),
  );

export type SearchParams = z.infer<typeof searchSchema>;
