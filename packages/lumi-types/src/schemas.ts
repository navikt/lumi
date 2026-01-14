import { z } from "zod";

// ============================================
// Input Schemas for Server Functions
// ============================================

export const TeamParamsSchema = z.object({
  team: z.string().optional(),
});

export type TeamParams = z.infer<typeof TeamParamsSchema>;

export const StatsParamsSchema = z.object({
  team: z.string().optional(),
  app: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  surveyId: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by context.tags (format: "key:value,key:value") */
  segment: z.string().optional(),
  /** Filter by specific task (Top Tasks drill-down) */
  task: z.string().optional(),
});

export type StatsParams = z.infer<typeof StatsParamsSchema>;

/**
 * Frontend URL params schema.
 * Uses canonical parameter names.
 */
export const FeedbackParamsSchema = z.object({
  team: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  page: z.string().optional(),
  size: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  hasText: z.string().optional(),
  lowRating: z.string().optional(),
  query: z.string().optional(),
  /** Comma-separated tag list in URL (sent as repeated `tag` params to backend). */
  tag: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by theme (themeId or 'uncategorized') - client-side only */
  theme: z.string().optional(),
  /** Segment filters (format: "key:value,key:value") */
  segment: z.string().optional(),
});

export type FeedbackParams = z.infer<typeof FeedbackParamsSchema>;

export const TopTasksParamsSchema = z.object({
  team: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by specific task name (drill-down from quadrant) */
  task: z.string().optional(),
});

export type TopTasksParams = z.infer<typeof TopTasksParamsSchema>;

export const DiscoveryParamsSchema = z.object({
  team: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
});

export type DiscoveryParams = z.infer<typeof DiscoveryParamsSchema>;

export const BlockerParamsSchema = z.object({
  team: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by specific task name (drill-down from quadrant) */
  task: z.string().optional(),
});

export type BlockerParams = z.infer<typeof BlockerParamsSchema>;

export const TaskPriorityParamsSchema = z.object({
  team: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  segment: z.string().optional(),
});

export type TaskPriorityParams = z.infer<typeof TaskPriorityParamsSchema>;

export const TagActionSchema = z.object({
  id: z.string(),
  tag: z.string(),
  team: z.string().optional(),
});

export type TagAction = z.infer<typeof TagActionSchema>;

export const DeleteSurveySchema = z.object({
  surveyId: z.string(),
  team: z.string().optional(),
});

export type DeleteSurvey = z.infer<typeof DeleteSurveySchema>;

// ============================================
// Filter Bootstrap Response Schema
// ============================================

export const FilterBootstrapResponseSchema = z.object({
  generatedAt: z.string(),
  selectedTeam: z.string(),
  availableTeams: z.array(z.string()),
  deviceTypes: z.array(z.string()),
  apps: z.array(z.string()),
  surveysByApp: z.record(z.string(), z.array(z.string())),
  tags: z.array(z.string()),
});

export type FilterBootstrapResponse = z.infer<
  typeof FilterBootstrapResponseSchema
>;

export const FilterBootstrapParamsSchema = z.object({
  team: z.string().optional(),
});

export type FilterBootstrapParams = z.infer<typeof FilterBootstrapParamsSchema>;

export const DeleteFeedbackSchema = z.object({
  id: z.string(),
  team: z.string().optional(),
});

export type DeleteFeedback = z.infer<typeof DeleteFeedbackSchema>;

export const ContextTagsParamsSchema = z.object({
  surveyId: z.string(),
  team: z.string().optional(),
  /** Max unique values per key. Keys with more values are filtered out. */
  maxCardinality: z.number().optional(),
  /** Filter by specific task (Top Tasks drill-down) */
  task: z.string().optional(),
  /** Segment filters (format: "key:value,key:value") */
  segment: z.string().optional(),
  /** Period filter: start date (YYYY-MM-DD) */
  fromDate: z.string().optional(),
  /** Period filter: end date (YYYY-MM-DD) */
  toDate: z.string().optional(),
  /** Device type filter: mobile, tablet, desktop */
  deviceType: z.string().optional(),
  /** Filter for feedback with text responses */
  hasText: z.boolean().optional(),
  /** Filter for low ratings (1-2) */
  lowRating: z.boolean().optional(),
});

export type ContextTagsParams = z.infer<typeof ContextTagsParamsSchema>;

export const ExportParamsSchema = z.object({
  format: z.enum(["csv", "json", "excel"]),
  team: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  hasText: z.string().optional(),
  query: z.string().optional(),
  lowRating: z.string().optional(),
  deviceType: z.string().optional(),
  /** Comma-separated tag list in URL (sent as repeated `tag` params to backend). */
  tag: z.string().optional(),
  /** Segment filters (format: "key:value,key:value") */
  segment: z.string().optional(),
});

export type ExportParams = z.infer<typeof ExportParamsSchema>;

// ============================================
// Response Schemas (for runtime validation)
// ============================================

const FieldTypeSchema = z.enum([
  "RATING",
  "TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "DATE",
]);

const SurveyTypeSchema = z.enum([
  "rating",
  "topTasks",
  "discovery",
  "taskPriority",
  "custom",
]);

const ChoiceOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const QuestionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  options: z.array(ChoiceOptionSchema).optional(),
});

const RatingValueSchema = z.object({
  type: z.literal("rating"),
  rating: z.number(),
});

const TextValueSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const SingleChoiceValueSchema = z.object({
  type: z.literal("singleChoice"),
  selectedOptionId: z.string(),
});

const MultiChoiceValueSchema = z.object({
  type: z.literal("multiChoice"),
  selectedOptionIds: z.array(z.string()),
});

const DateValueSchema = z.object({
  type: z.literal("date"),
  date: z.string(),
});

const AnswerValueSchema = z.discriminatedUnion("type", [
  RatingValueSchema,
  TextValueSchema,
  SingleChoiceValueSchema,
  MultiChoiceValueSchema,
  DateValueSchema,
]);

const AnswerSchema = z.object({
  fieldId: z.string(),
  fieldType: FieldTypeSchema,
  question: QuestionSchema,
  value: AnswerValueSchema,
});

const DeviceTypeSchema = z.enum(["mobile", "tablet", "desktop"]);

const SubmissionContextSchema = z.object({
  url: z.string().optional(),
  pathname: z.string().optional(),
  deviceType: DeviceTypeSchema.optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

export const FeedbackDtoSchema = z.object({
  id: z.string(),
  submittedAt: z.string(),
  app: z.string().nullable(),
  surveyId: z.string(),
  surveyVersion: z.string().optional(),
  surveyType: SurveyTypeSchema.optional(),
  context: SubmissionContextSchema.optional(),

  metadata: z.record(z.string(), z.string()).nullable().optional(),

  answers: z.array(AnswerSchema),
  tags: z.array(z.string()).optional(),
  sensitiveDataRedacted: z.boolean(),
});

export const FeedbackPageSchema = z.object({
  content: z.array(FeedbackDtoSchema),
  totalPages: z.number(),
  totalElements: z.number(),
  size: z.number(),
  number: z.number(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

// Field stats schemas
const RatingStatsSchema = z.object({
  type: z.literal("rating"),
  average: z.number(),
  distribution: z.record(z.string(), z.number()),
});

const TextStatsSchema = z.object({
  type: z.literal("text"),
  responseCount: z.number(),
  responseRate: z.number(),
  topKeywords: z.array(z.object({ word: z.string(), count: z.number() })),
  recentResponses: z.array(
    z.object({ text: z.string(), submittedAt: z.string() }),
  ),
});

const ChoiceStatsSchema = z.object({
  type: z.literal("choice"),
  distribution: z.record(
    z.string(),
    z.object({
      label: z.string(),
      count: z.number(),
      percentage: z.number(),
    }),
  ),
});

const FieldStatsValueSchema = z.discriminatedUnion("type", [
  RatingStatsSchema,
  TextStatsSchema,
  ChoiceStatsSchema,
]);

const FieldStatSchema = z.object({
  fieldId: z.string(),
  fieldType: FieldTypeSchema,
  label: z.string(),
  stats: FieldStatsValueSchema,
});

export const FeedbackStatsSchema = z.object({
  totalCount: z.number(),
  countWithText: z.number(),
  countWithoutText: z.number(),
  byRating: z.record(z.string(), z.number()),
  byApp: z.record(z.string(), z.number()),
  byDate: z.record(z.string(), z.number()),
  bySurveyId: z.record(z.string(), z.number()),
  averageRating: z.number().nullable(),
  ratingByDate: z.record(
    z.string(),
    z.object({ average: z.number(), count: z.number() }),
  ),
  byDevice: z.record(
    z.string(),
    z.object({ count: z.number(), averageRating: z.number() }),
  ),
  byPathname: z.record(
    z.string(),
    z.object({ count: z.number(), averageRating: z.number() }),
  ),
  lowestRatingPaths: z.record(
    z.string(),
    z.object({ count: z.number(), averageRating: z.number() }),
  ),
  fieldStats: z.array(FieldStatSchema),
  surveyType: SurveyTypeSchema.optional(),
  period: z.object({
    fromDate: z.string().nullable(),
    toDate: z.string().nullable(),
    days: z.number(),
  }),
});

export const TeamsAndAppsSchema = z.object({
  teams: z.record(z.string(), z.array(z.string())),
});

// Top Tasks schemas
const TopTaskStatsSchema = z.object({
  task: z.string(),
  totalCount: z.number(),
  successCount: z.number(),
  partialCount: z.number(),
  failureCount: z.number(),
  successRate: z.number(),
  formattedSuccessRate: z.string(),
  blockerCounts: z.record(z.string(), z.number()),
});

export const TopTasksResponseSchema = z.object({
  totalSubmissions: z.number(),
  tasks: z.array(TopTaskStatsSchema),
  dailyStats: z.record(
    z.string(),
    z.object({ total: z.number(), success: z.number() }),
  ),
  questionText: z.string().optional(),
});

export const ContextTagsResponseSchema = z.object({
  surveyId: z.string(),
  contextTags: z.record(
    z.string(),
    z.array(z.object({ value: z.string(), count: z.number() })),
  ),
  /** The maxCardinality used for filtering */
  maxCardinality: z.number().optional(),
});

export const DeleteSurveyResultSchema = z.object({
  deletedCount: z.number(),
  surveyId: z.string(),
});

export const SurveysByAppSchema = z.record(z.string(), z.array(z.string()));

export const TagsSchema = z.array(z.string());
