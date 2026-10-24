import { z } from "zod";

// .catch(undefined) turns an invalid value into undefined instead of an error.
// In zod 4 it keeps the input type of the field, so search in Link, navigate
// and redirect is still type-checked.
const optionalStringParam = z.string().optional().catch(undefined);
const optionalDateModeParam = z
  .enum(["auto", "fixed"])
  .optional()
  .catch(undefined);
const optionalTrendIntervalParam = z
  .enum(["day", "week", "month"])
  .optional()
  .catch(undefined);
const optionalTrendMeasureParam = z
  .enum(["count", "percentage"])
  .optional()
  .catch(undefined);

export const searchSchema = z
  .object({
    team: optionalStringParam,
    app: optionalStringParam,
    page: optionalStringParam,
    size: optionalStringParam,
    dateMode: optionalDateModeParam,
    compare: z.enum(["previous", "none"]).optional().catch(undefined),
    fromDate: optionalStringParam,
    periodPreset: z
      .enum(["rolling", "yearToDate", "custom"])
      .optional()
      .catch(undefined),
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
