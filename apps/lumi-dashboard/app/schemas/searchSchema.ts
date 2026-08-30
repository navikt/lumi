import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const optionalStringParam = fallback(z.string().optional(), undefined).catch(
  undefined,
);
const optionalDateModeParam = fallback(
  z.enum(["auto", "fixed"]).optional(),
  undefined,
).catch(undefined);
const optionalTrendIntervalParam = fallback(
  z.enum(["day", "week", "month"]).optional(),
  undefined,
).catch(undefined);
const optionalTrendMeasureParam = fallback(
  z.enum(["count", "percentage"]).optional(),
  undefined,
).catch(undefined);

export const searchSchema = z
  .object({
    team: optionalStringParam,
    app: optionalStringParam,
    page: optionalStringParam,
    size: optionalStringParam,
    dateMode: optionalDateModeParam,
    fromDate: optionalStringParam,
    toDate: optionalStringParam,
    hasText: optionalStringParam,
    query: optionalStringParam,
    tag: optionalStringParam,
    surveyId: optionalStringParam,
    showArchived: optionalStringParam,
    lowRating: optionalStringParam,
    deviceType: optionalStringParam,
    theme: optionalStringParam,
    segment: optionalStringParam,
    task: optionalStringParam,
    choice: optionalStringParam,
    rating: optionalStringParam,
    phrase: optionalStringParam,
    trendField: optionalStringParam,
    trendInterval: optionalTrendIntervalParam,
    trendMeasure: optionalTrendMeasureParam,
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
