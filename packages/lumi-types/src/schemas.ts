import { z } from "zod";

// ============================================
// Input Schemas for Server Functions
// ============================================

export const TeamParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
});

export type TeamParams = z.infer<typeof TeamParamsSchema>;

export const StatsParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
  app: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  surveyId: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by context.tags (format: "key:value,key:value") */
  segment: z.string().optional(),
  /** Filter by specific task (Top Tasks drill-down) */
  task: z.string().optional(),
  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
});

export type StatsParams = z.infer<typeof StatsParamsSchema>;

/**
 * Frontend URL params schema.
 * Uses canonical parameter names.
 */
export const FeedbackParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
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
  /** Filter by specific task (Top Tasks drill-down) */
  task: z.string().optional(),
  /** Segment filters (format: "key:value,key:value") */
  segment: z.string().optional(),

  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
  /** Phrase filter in format "fieldId:natural phrase text" */
  phrase: z.string().optional(),
});

export type FeedbackParams = z.infer<typeof FeedbackParamsSchema>;

export const TopTasksParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by specific task name (drill-down from quadrant) */
  task: z.string().optional(),
  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
});

export type TopTasksParams = z.infer<typeof TopTasksParamsSchema>;

export const DiscoveryParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
});

export type DiscoveryParams = z.infer<typeof DiscoveryParamsSchema>;

export const BlockerParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  /** Filter by specific task name (drill-down from quadrant) */
  task: z.string().optional(),
  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
});

export type BlockerParams = z.infer<typeof BlockerParamsSchema>;

export const TaskPriorityParamsSchema = z.object({
  team: z.string().optional(),
  includeArchived: z.string().optional(),
  app: z.string().optional(),
  surveyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  deviceType: z.string().optional(),
  segment: z.string().optional(),
  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
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

/**
 * Per-survey dashboard metadata. Surveys without an entry are active;
 * `archivedAt === null` means the survey was restored after being archived.
 */
export const SurveyMetaEntrySchema = z.object({
  archivedAt: z.string().nullable(),
  /** Oldest submission for the survey (ISO-8601). Absent for surveys without feedback. */
  firstSubmissionAt: z.string().nullable().optional(),
  /** Newest submission for the survey (ISO-8601). Absent for surveys without feedback. */
  lastSubmissionAt: z.string().nullable().optional(),
});

export type SurveyMetaEntry = z.infer<typeof SurveyMetaEntrySchema>;

export const SurveyRetentionWarningSchema = z.object({
  surveyId: z.string(),
  lastActivityAt: z.string(),
  scheduledFor: z.string(),
});

export type SurveyRetentionWarning = z.infer<
  typeof SurveyRetentionWarningSchema
>;

export const FilterBootstrapResponseSchema = z.object({
  generatedAt: z.string(),
  selectedTeam: z.string(),
  availableTeams: z.array(z.string()),
  deviceTypes: z.array(z.string()),
  apps: z.array(z.string()),
  surveysByApp: z.record(z.string(), z.array(z.string())),
  tags: z.array(z.string()),
  surveyMeta: z.record(z.string(), SurveyMetaEntrySchema).optional(),
  /** Per-app survey periods; optional for backwards compatibility with older API responses. */
  surveyMetaByApp: z
    .record(z.string(), z.record(z.string(), SurveyMetaEntrySchema))
    .optional(),
  /** Inactive survey definitions approaching automatic retirement. */
  retentionWarnings: z.array(SurveyRetentionWarningSchema).optional(),
});

export type FilterBootstrapResponse = z.infer<
  typeof FilterBootstrapResponseSchema
>;

export const FilterBootstrapParamsSchema = z.object({
  team: z.string().optional(),
});

export type FilterBootstrapParams = z.infer<typeof FilterBootstrapParamsSchema>;

export const RefreshFilterBootstrapParamsSchema = z.object({
  team: z.string().optional(),
});

export type RefreshFilterBootstrapParams = z.infer<
  typeof RefreshFilterBootstrapParamsSchema
>;

export const ArchiveSurveySchema = z.object({
  surveyId: z.string(),
  team: z.string().optional(),
});

export type ArchiveSurvey = z.infer<typeof ArchiveSurveySchema>;

/** Response from PUT /surveys/{surveyId}/archive. */
export const SurveyArchiveStateSchema = z.object({
  surveyId: z.string(),
  archivedAt: z.string().nullable(),
  archivedBy: z.string().nullable(),
});

export type SurveyArchiveState = z.infer<typeof SurveyArchiveStateSchema>;

export const DeleteFeedbackSchema = z.object({
  id: z.string(),
  team: z.string().optional(),
});

export type DeleteFeedback = z.infer<typeof DeleteFeedbackSchema>;

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date format YYYY-MM-DD");
const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Expected color format #RRGGBB");

export const FetchMarkersParamsSchema = z.object({
  surveyId: z.string(),
  fromDate: IsoDateSchema.optional(),
  toDate: IsoDateSchema.optional(),
  team: z.string().optional(),
});

export type FetchMarkersParams = z.infer<typeof FetchMarkersParamsSchema>;

export const CreateMarkerInputSchema = z.object({
  markerDate: IsoDateSchema,
  label: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  color: HexColorSchema.optional(),
});

export const CreateMarkerSchema = CreateMarkerInputSchema.extend({
  surveyId: z.string(),
  team: z.string().optional(),
});

export type CreateMarker = z.infer<typeof CreateMarkerSchema>;

const UpdateMarkerInputBaseSchema = z.object({
  markerDate: IsoDateSchema.optional(),
  label: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  color: HexColorSchema.optional(),
  clearDescription: z.boolean().optional(),
  clearColor: z.boolean().optional(),
});

function hasAnyUpdateField(value: {
  markerDate?: string;
  label?: string;
  description?: string;
  color?: string;
  clearDescription?: boolean;
  clearColor?: boolean;
}) {
  return (
    value.markerDate !== undefined ||
    value.label !== undefined ||
    value.description !== undefined ||
    value.color !== undefined ||
    value.clearDescription === true ||
    value.clearColor === true
  );
}

function validateClearConflicts(
  value: {
    description?: string;
    color?: string;
    clearDescription?: boolean;
    clearColor?: boolean;
  },
  ctx: z.RefinementCtx,
) {
  if (value.clearDescription && value.description !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "description cannot be set when clearDescription is true",
      path: ["clearDescription"],
    });
  }
  if (value.clearColor && value.color !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "color cannot be set when clearColor is true",
      path: ["clearColor"],
    });
  }
}

export const UpdateMarkerInputSchema = UpdateMarkerInputBaseSchema.superRefine(
  (value, ctx) => {
    if (!hasAnyUpdateField(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided",
      });
    }
    validateClearConflicts(value, ctx);
  },
);

export const UpdateMarkerSchema = UpdateMarkerInputBaseSchema.extend({
  id: z.string(),
  surveyId: z.string(),
  team: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!hasAnyUpdateField(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one field must be provided",
    });
  }
  validateClearConflicts(value, ctx);
});

export type UpdateMarker = z.infer<typeof UpdateMarkerSchema>;

export const DeleteMarkerSchema = z.object({
  id: z.string(),
  surveyId: z.string(),
  team: z.string().optional(),
});

export type DeleteMarker = z.infer<typeof DeleteMarkerSchema>;

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
  includeArchived: z.string().optional(),
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
  /** Filter by theme (themeId or 'uncategorized') */
  theme: z.string().optional(),
  /** Filter by specific task (Top Tasks drill-down) */
  task: z.string().optional(),
  /** Segment filters (format: "key:value,key:value") */
  segment: z.string().optional(),
  /** Choice filters as repeated query params, each in format "fieldId:value" */
  choice: z.array(z.string()).optional(),
  /** Rating filters as repeated query params, each in format "fieldId:value" */
  rating: z.array(z.string()).optional(),
  /** Phrase filter in format "fieldId:natural phrase text" */
  phrase: z.string().optional(),
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
  ratingVariant: z.enum(["emoji", "thumbs", "stars", "nps"]).optional(),
  ratingScale: z.number().optional(),
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

// ============================================
// Widget submission (schemaVersion=1)
// Matches apps/lumi-api domain/SubmissionV1.kt + SubmissionRoutes validation
// ============================================

const JsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const IsoInstantSchema = z.string().refine(
  (value) => {
    // Backend validates with java.time.Instant.parse.
    // Keep this strict enough to catch obvious issues, without false negatives.
    if (!value.includes("T")) return false;
    const parsed = Date.parse(value);
    return !Number.isNaN(parsed);
  },
  { message: "Expected an ISO-8601 instant" },
);

const ViewportSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
});

export const SubmissionContextV1Schema = z.object({
  url: z.string().nullable().optional(),
  pathname: z.string().nullable().optional(),
  deviceType: DeviceTypeSchema.nullable().optional(),
  viewport: ViewportSchema.nullable().optional(),
  screenResolution: ViewportSchema.nullable().optional(),
  userAgent: z.string().nullable().optional(),
  tags: z.record(z.string(), JsonPrimitiveSchema).nullable().optional(),
  debug: z.record(z.string(), z.unknown()).nullable().optional(),
});

const RatingVariantSchema = z.enum(["emoji", "thumbs", "stars", "nps"]);
const SubmissionRatingValueSchema = z
  .object({
    type: z.literal("rating"),
    rating: z.number().int(),
    ratingVariant: RatingVariantSchema,
    ratingScale: z.number().int(),
  })
  .superRefine((value, ctx) => {
    const expectedScaleByVariant: Record<
      z.infer<typeof RatingVariantSchema>,
      number
    > = {
      emoji: 5,
      thumbs: 2,
      stars: 5,
      nps: 11,
    };

    const expectedScale = expectedScaleByVariant[value.ratingVariant];
    if (value.ratingScale !== expectedScale) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ratingScale=${value.ratingScale} does not match ratingVariant=${value.ratingVariant} (expected ${expectedScale})`,
        path: ["ratingScale"],
      });
    }

    const [minRating, maxRating] =
      value.ratingVariant === "nps" ? [0, 10] : [1, value.ratingScale];
    if (value.rating < minRating || value.rating > maxRating) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `rating=${value.rating} out of range for ratingVariant=${value.ratingVariant} (${minRating}-${maxRating})`,
        path: ["rating"],
      });
    }
  });

const SubmissionTextValueSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const SubmissionSingleChoiceValueSchema = z.object({
  type: z.literal("singleChoice"),
  selectedOptionId: z.string().min(1),
});

const SubmissionMultiChoiceValueSchema = z.object({
  type: z.literal("multiChoice"),
  selectedOptionIds: z.array(z.string().min(1)).min(1),
});

const SubmissionDateValueSchema = z.object({
  type: z.literal("date"),
  date: z.string().min(1),
});

const SubmissionBaseAnswerSchema = z.object({
  fieldId: z.string().min(1),
  question: QuestionSchema,
});

const SubmissionRatingAnswerSchema = SubmissionBaseAnswerSchema.extend({
  fieldType: z.literal("RATING"),
  value: SubmissionRatingValueSchema,
});

const SubmissionTextAnswerSchema = SubmissionBaseAnswerSchema.extend({
  fieldType: z.literal("TEXT"),
  value: SubmissionTextValueSchema,
});

const SubmissionSingleChoiceAnswerSchema = SubmissionBaseAnswerSchema.extend({
  fieldType: z.literal("SINGLE_CHOICE"),
  value: SubmissionSingleChoiceValueSchema,
});

const SubmissionMultiChoiceAnswerSchema = SubmissionBaseAnswerSchema.extend({
  fieldType: z.literal("MULTI_CHOICE"),
  value: SubmissionMultiChoiceValueSchema,
});

const SubmissionDateAnswerSchema = SubmissionBaseAnswerSchema.extend({
  fieldType: z.literal("DATE"),
  value: SubmissionDateValueSchema,
});

const SubmissionAnswerSchema = z.discriminatedUnion("fieldType", [
  SubmissionRatingAnswerSchema,
  SubmissionTextAnswerSchema,
  SubmissionSingleChoiceAnswerSchema,
  SubmissionMultiChoiceAnswerSchema,
  SubmissionDateAnswerSchema,
]);

const SubmissionFieldIdSchema = z
  .string()
  .min(1)
  .max(200, "fieldId must not exceed 200 characters")
  .regex(
    /^[\p{L}\p{Nd}_-]+$/u,
    "fieldId must contain only letters, digits, hyphen, or underscore",
  );

/**
 * Mirrors backend isSafeChoiceValue: forbids JSONPath special characters
 * (", \, $, @, ?, (, ), ,) and control characters (code < 32).
 * Max length matches backend MAX_IDENTIFIER_LENGTH = 200.
 */
const OPTION_ID_FORBIDDEN_CHARS = new Set([
  '"',
  "\\",
  "$",
  "@",
  "?",
  "(",
  ")",
  ",",
]);

const SubmissionOptionIdSchema = z
  .string()
  .min(1)
  .max(200, "optionId must not exceed 200 characters")
  .refine(
    (s) => s.trim().length > 0,
    "optionId must not be blank or whitespace-only",
  )
  .refine(
    (s) =>
      [...s].every(
        (c) => !OPTION_ID_FORBIDDEN_CHARS.has(c) && c.charCodeAt(0) >= 32,
      ),
    "optionId contains illegal characters (JSONPath special or control characters are not allowed)",
  );

const SubmissionOptionIdsSchema = z
  .array(SubmissionOptionIdSchema)
  .min(1)
  .superRefine((optionIds, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < optionIds.length; i += 1) {
      const optionId = optionIds[i];
      if (!optionId) continue;
      if (seen.has(optionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `optionIds must be unique (duplicate: ${optionId})`,
          path: [i],
        });
      }
      seen.add(optionId);
    }
  });

const SubmissionFieldDefinitionBaseSchema = z.object({
  fieldId: SubmissionFieldIdSchema,
});

const SubmissionRatingFieldDefinitionSchema =
  SubmissionFieldDefinitionBaseSchema.extend({
    fieldType: z.literal("RATING"),
    ratingVariant: RatingVariantSchema,
    ratingScale: z.number().int(),
  }).strict();

const SubmissionTextFieldDefinitionSchema =
  SubmissionFieldDefinitionBaseSchema.extend({
    fieldType: z.literal("TEXT"),
  }).strict();

const SubmissionSingleChoiceFieldDefinitionSchema =
  SubmissionFieldDefinitionBaseSchema.extend({
    fieldType: z.literal("SINGLE_CHOICE"),
    optionIds: SubmissionOptionIdsSchema,
  }).strict();

const SubmissionMultiChoiceFieldDefinitionSchema =
  SubmissionFieldDefinitionBaseSchema.extend({
    fieldType: z.literal("MULTI_CHOICE"),
    optionIds: SubmissionOptionIdsSchema,
    maxSelections: z.number().int().positive().optional(),
  }).strict();

const SubmissionDateFieldDefinitionSchema =
  SubmissionFieldDefinitionBaseSchema.extend({
    fieldType: z.literal("DATE"),
  }).strict();

export const SubmissionFieldDefinitionSchema = z.discriminatedUnion(
  "fieldType",
  [
    SubmissionRatingFieldDefinitionSchema,
    SubmissionTextFieldDefinitionSchema,
    SubmissionSingleChoiceFieldDefinitionSchema,
    SubmissionMultiChoiceFieldDefinitionSchema,
    SubmissionDateFieldDefinitionSchema,
  ],
);

export const SubmissionDefinitionSchema = z
  .object({
    surveyType: SurveyTypeSchema,
    fields: z
      .array(SubmissionFieldDefinitionSchema)
      .min(1)
      .max(50, "definition.fields must not exceed 50 fields"),
  })
  .superRefine((definition, ctx) => {
    const expectedScaleByVariant: Record<
      z.infer<typeof RatingVariantSchema>,
      number
    > = {
      emoji: 5,
      thumbs: 2,
      stars: 5,
      nps: 11,
    };

    const seen = new Set<string>();
    for (let i = 0; i < definition.fields.length; i += 1) {
      const field = definition.fields[i];
      const fieldId = field?.fieldId;
      if (!fieldId) continue;
      if (seen.has(fieldId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `definition.fields.fieldId must be unique (duplicate: ${fieldId})`,
          path: ["fields", i, "fieldId"],
        });
      }
      seen.add(fieldId);

      if (field.fieldType === "RATING") {
        const expectedScale = expectedScaleByVariant[field.ratingVariant];
        if (field.ratingScale !== expectedScale) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `ratingScale=${field.ratingScale} does not match ratingVariant=${field.ratingVariant} (expected ${expectedScale})`,
            path: ["fields", i, "ratingScale"],
          });
        }
      }
      if (
        field.fieldType === "MULTI_CHOICE" &&
        field.maxSelections !== undefined &&
        field.maxSelections > field.optionIds.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "maxSelections must not exceed the number of multi-choice options",
          path: ["fields", i, "maxSelections"],
        });
      }
    }
  });

const DeduplicationKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "deduplicationKey must contain only letters, digits, '.', '_', ':', or '-'",
  );

function validateUniqueAnswerFieldIds(
  submission: { answers: Array<{ fieldId: string }> },
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  for (let i = 0; i < submission.answers.length; i += 1) {
    const fieldId = submission.answers[i]?.fieldId;
    if (!fieldId) continue;
    if (seen.has(fieldId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `answers.fieldId must be unique (duplicate: ${fieldId})`,
        path: ["answers", i, "fieldId"],
      });
    }
    seen.add(fieldId);
  }
}

function validateChoiceQuestionOptions(
  answer:
    | z.infer<typeof SubmissionSingleChoiceAnswerSchema>
    | z.infer<typeof SubmissionMultiChoiceAnswerSchema>,
  field:
    | z.infer<typeof SubmissionSingleChoiceFieldDefinitionSchema>
    | z.infer<typeof SubmissionMultiChoiceFieldDefinitionSchema>,
  answerIndex: number,
  ctx: z.RefinementCtx,
) {
  const answerOptionIds = answer.question.options?.map((option) => option.id);
  if (!answerOptionIds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `choice answer fieldId=${answer.fieldId} must include question.options to match definition.optionIds`,
      path: ["answers", answerIndex, "question", "options"],
    });
    return;
  }

  if (
    answerOptionIds.length !== field.optionIds.length ||
    answerOptionIds.some((optionId, i) => optionId !== field.optionIds[i])
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `choice answer fieldId=${answer.fieldId} question.options must match definition.optionIds`,
      path: ["answers", answerIndex, "question", "options"],
    });
  }
}

function validateAnswerValueAgainstDefinition(
  answer: z.infer<typeof SubmissionAnswerSchema>,
  field: z.infer<typeof SubmissionFieldDefinitionSchema>,
  answerIndex: number,
  ctx: z.RefinementCtx,
) {
  if (answer.fieldType === "RATING" && field.fieldType === "RATING") {
    if (
      field.ratingVariant !== answer.value.ratingVariant ||
      field.ratingScale !== answer.value.ratingScale
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `rating config for fieldId=${answer.fieldId} must match definition`,
        path: ["answers", answerIndex, "value"],
      });
    }
    return;
  }

  if (
    answer.fieldType === "SINGLE_CHOICE" &&
    field.fieldType === "SINGLE_CHOICE"
  ) {
    validateChoiceQuestionOptions(answer, field, answerIndex, ctx);
    if (!field.optionIds.includes(answer.value.selectedOptionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `selectedOptionId=${answer.value.selectedOptionId} is not valid for fieldId=${answer.fieldId}`,
        path: ["answers", answerIndex, "value", "selectedOptionId"],
      });
    }
    return;
  }

  if (
    answer.fieldType === "MULTI_CHOICE" &&
    field.fieldType === "MULTI_CHOICE"
  ) {
    validateChoiceQuestionOptions(answer, field, answerIndex, ctx);
    const seen = new Set<string>();
    const duplicateSelections = new Set<string>();
    for (const selectedOptionId of answer.value.selectedOptionIds) {
      if (seen.has(selectedOptionId)) {
        duplicateSelections.add(selectedOptionId);
      }
      seen.add(selectedOptionId);
    }

    if (duplicateSelections.size > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate selectedOptionIds=${[...duplicateSelections].join(",")} for fieldId=${answer.fieldId}`,
        path: ["answers", answerIndex, "value", "selectedOptionIds"],
      });
    }

    const invalidIds = answer.value.selectedOptionIds.filter(
      (selectedOptionId) => !field.optionIds.includes(selectedOptionId),
    );
    if (invalidIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `selectedOptionIds=${invalidIds.join(",")} are not valid for fieldId=${answer.fieldId}`,
        path: ["answers", answerIndex, "value", "selectedOptionIds"],
      });
    }
    if (
      field.maxSelections !== undefined &&
      answer.value.selectedOptionIds.length > field.maxSelections
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `selectedOptionIds exceeds maxSelections=${field.maxSelections} for fieldId=${answer.fieldId}`,
        path: ["answers", answerIndex, "value", "selectedOptionIds"],
      });
    }
  }
}

export const FeedbackSubmissionV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    surveyId: z.string().min(1),
    surveyType: SurveyTypeSchema,
    submittedAt: IsoInstantSchema,
    startedAt: IsoInstantSchema.nullable().optional(),
    timeToCompleteMs: z.number().int().nonnegative().nullable().optional(),
    deduplicationKey: DeduplicationKeySchema.nullable().optional(),
    context: SubmissionContextV1Schema.nullable().optional(),
    answers: z.array(SubmissionAnswerSchema).min(1),
  })
  .superRefine((submission, ctx) => {
    validateUniqueAnswerFieldIds(submission, ctx);
  });

export const FeedbackSubmissionV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    surveyId: z.string().min(1),
    surveyType: SurveyTypeSchema,
    submittedAt: IsoInstantSchema,
    startedAt: IsoInstantSchema.nullable().optional(),
    timeToCompleteMs: z.number().int().nonnegative().nullable().optional(),
    deduplicationKey: DeduplicationKeySchema,
    definition: SubmissionDefinitionSchema,
    context: SubmissionContextV1Schema.nullable().optional(),
    answers: z.array(SubmissionAnswerSchema).min(1),
  })
  .superRefine((submission, ctx) => {
    validateUniqueAnswerFieldIds(submission, ctx);
    if (submission.surveyType !== submission.definition.surveyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "surveyType must match definition.surveyType",
        path: ["surveyType"],
      });
    }

    const fieldsById = new Map(
      submission.definition.fields.map((field) => [field.fieldId, field]),
    );
    for (let i = 0; i < submission.answers.length; i += 1) {
      const answer = submission.answers[i];
      if (!answer) continue;
      const field = fieldsById.get(answer.fieldId);
      if (!field) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answers.fieldId must exist in definition.fields (unknown: ${answer.fieldId})`,
          path: ["answers", i, "fieldId"],
        });
        continue;
      }

      if (field.fieldType !== answer.fieldType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `answers.fieldType must match definition fieldType for fieldId=${answer.fieldId}`,
          path: ["answers", i, "fieldType"],
        });
        continue;
      }

      validateAnswerValueAgainstDefinition(answer, field, i, ctx);
    }
  });

export const FeedbackSubmissionSchema = z.union([
  FeedbackSubmissionV1Schema,
  FeedbackSubmissionV2Schema,
]);

export const SubmissionCreatedResponseSchema = z.object({
  id: z.string(),
});

const SubmissionContextSchema = z.object({
  url: z.string().optional(),
  pathname: z.string().optional(),
  deviceType: DeviceTypeSchema.optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
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
  topPhrases: z
    .array(z.object({ text: z.string(), count: z.number() }))
    .optional(),
});

const ChoiceStatsSchema = z.object({
  type: z.literal("choice"),
  responseCount: z.number().optional(),
  responseRate: z.number().optional(),
  totalSelections: z.number().optional(),
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

const PrivacyInfoSchema = z.object({
  masked: z.boolean(),
  reason: z.string().optional(),
  threshold: z.number(),
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
  byScreenResolution: z.record(z.string(), z.number()).default({}),
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
  privacy: PrivacyInfoSchema.optional(),
});

export const TeamsAndAppsSchema = z.object({
  teams: z.record(z.string(), z.array(z.string())),
});

// Top Tasks schemas
const TopTaskStatsSchema = z.object({
  taskId: z.string(),
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

const PhraseEntrySchema = z.object({
  text: z.string(),
  count: z.number(),
  sourceResponseIds: z.array(z.string()).optional(),
});

const QuoteEntrySchema = z.object({
  text: z.string(),
  answeredAt: z.string(),
});

const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);

// Discovery schemas
const DiscoveryThemeSchema = z.object({
  theme: z.string(),
  count: z.number(),
  successRate: z.number(),
  examples: z.array(z.string()),
});

export const DiscoveryResponseSchema = z.object({
  totalSubmissions: z.number(),
  themes: z.array(DiscoveryThemeSchema),
  recentResponses: z.array(
    z.object({
      task: z.string(),
      success: z.enum(["yes", "partial", "no"]),
      blocker: z.string().optional(),
      submittedAt: z.string(),
    }),
  ),
  phrases: z.array(PhraseEntrySchema).optional(),
  quotes: z.array(QuoteEntrySchema).optional(),
  confidenceLevel: ConfidenceLevelSchema.optional(),
});

// Blocker schemas (for Top Tasks)
const BlockerThemeSchema = z.object({
  theme: z.string(),
  themeId: z.string(),
  count: z.number(),
  examples: z.array(z.string()),
  color: z.string().optional(),
});

export const BlockerResponseSchema = z.object({
  totalBlockers: z.number(),
  themes: z.array(BlockerThemeSchema),
  recentBlockers: z.array(
    z.object({
      blocker: z.string(),
      task: z.string(),
      submittedAt: z.string(),
    }),
  ),
  phrases: z.array(PhraseEntrySchema).optional(),
  quotes: z.array(QuoteEntrySchema).optional(),
  confidenceLevel: ConfidenceLevelSchema.optional(),
});

// Task Priority schemas
const TaskVoteSchema = z.object({
  taskId: z.string(),
  task: z.string(),
  votes: z.number(),
  percentage: z.number(),
});

export const TaskPriorityResponseSchema = z.object({
  totalSubmissions: z.number(),
  tasks: z.array(TaskVoteSchema),
  longNeckCutoff: z.number(),
  cumulativePercentageAt5: z.number(),
});

export const DeleteSurveyResultSchema = z.object({
  deletedCount: z.number(),
  surveyId: z.string(),
});

export const RatingMarkerSchema = z.object({
  id: z.string(),
  team: z.string(),
  surveyId: z.string(),
  markerDate: IsoDateSchema,
  label: z.string(),
  description: z.string().nullable().optional(),
  color: HexColorSchema.nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RatingMarkersSchema = z.array(RatingMarkerSchema);

export const SurveysByAppSchema = z.record(z.string(), z.array(z.string()));

export const TagsSchema = z.array(z.string());
