import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const optionalStringParam = fallback(z.string().optional(), undefined).catch(
  undefined,
);

export const searchSchema = z.object({
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
  ratingFieldId: optionalStringParam,
  ratingValue: optionalStringParam,
  choiceFieldId: optionalStringParam,
  choiceValue: optionalStringParam,
});

export type SearchParams = z.infer<typeof searchSchema>;
