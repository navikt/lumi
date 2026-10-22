import { z } from "zod";

/** Same rules as the API: a GCP project id and a BigQuery dataset id. */
export const GCP_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
export const BIGQUERY_DATASET_ID_PATTERN = /^[A-Za-z0-9_]{1,100}$/;
export const DEFAULT_DATASET_ID = "lumi";

const team = z.string().trim().min(1).max(255);
const instant = z.string().min(1).max(64);

export const BigQueryExportTeamSchema = z.object({ team });

export const BigQueryExportTargetSchema = z
  .object({
    team,
    projectId: z.string().regex(GCP_PROJECT_ID_PATTERN),
    datasetId: z.string().regex(BIGQUERY_DATASET_ID_PATTERN),
  })
  .strict();

export const BigQueryExportSaveSchema = BigQueryExportTargetSchema.extend({
  includeFreeText: z.boolean(),
}).strict();

export const BigQueryExportProblemCodeSchema = z.enum([
  "PROJECT_NOT_TEAM_PROJECT",
  "DATASET_NOT_FOUND",
  "DATASET_ACCESS_DENIED",
  "DATASET_WRONG_LOCATION",
  "DATASET_TEAM_LABEL_MISSING",
  "DATASET_TEAM_LABEL_MISMATCH",
  "TABLE_WRITE_DENIED",
  "TABLE_NOT_CREATED_BY_LUMI",
  "DATASET_NOT_DEDICATED",
  "DATASET_TIME_TRAVEL_TOO_LONG",
  "TEAM_PROJECT_UNKNOWN",
  "EXPORT_JOB_DENIED",
  "FREE_TEXT_NOT_REMOVED",
  "BIGQUERY_UNAVAILABLE",
  "LOAD_FAILED",
  "INTERNAL_ERROR",
]);

export const BigQueryExportProblemSchema = z.object({
  code: BigQueryExportProblemCodeSchema,
  detail: z.string().max(1024).nullish(),
});

export const BigQueryExportVerificationSchema = z.object({
  ok: z.boolean(),
  problems: z.array(BigQueryExportProblemSchema).max(20),
});

export const BigQueryExportRowCountsSchema = z.object({
  svar: z.number().int().nonnegative(),
  innsendinger: z.number().int().nonnegative(),
  fritekst: z.number().int().nonnegative().nullish(),
});

export const BigQueryExportRunSchema = z.object({
  status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]),
  startedAt: instant,
  finishedAt: instant.nullish(),
  errorCode: BigQueryExportProblemCodeSchema.nullish(),
});

export const BigQueryExportDestinationSchema = z.object({
  projectId: z.string().regex(GCP_PROJECT_ID_PATTERN),
  datasetId: z.string().regex(BIGQUERY_DATASET_ID_PATTERN),
  includeFreeText: z.boolean(),
  createdAt: instant,
  updatedAt: instant,
  runState: z.enum(["IDLE", "QUEUED", "RUNNING"]),
  lastRun: BigQueryExportRunSchema.nullish(),
  lastSuccessAt: instant.nullish(),
  lastSuccessRows: BigQueryExportRowCountsSchema.nullish(),
  nextScheduledRunAt: instant.nullish(),
  /** The team has stopped the export, and Lumi is still deleting the tables. */
  stopping: z.boolean().default(false),
});

export const BigQueryExportStatusSchema = z.object({
  team,
  available: z.boolean(),
  availability: z.enum(["AVAILABLE", "DISABLED", "PILOT_ONLY"]),
  location: z.string().min(1).max(64),
  serviceAccount: z.string().max(320).nullish(),
  suggestedProjectId: z.string().regex(GCP_PROJECT_ID_PATTERN).nullish(),
  /** Whether the team may export free text. Missing means no. */
  freeTextAvailable: z.boolean().default(false),
  destination: BigQueryExportDestinationSchema.nullish(),
});

export const BigQueryExportStopSchema = z.object({
  tablesRemoved: z.boolean(),
  /** Lumi finishes the stop later, for example when a run is going on. */
  stopping: z.boolean().default(false),
});

export type BigQueryExportProblemCode = z.infer<
  typeof BigQueryExportProblemCodeSchema
>;
export type BigQueryExportProblem = z.infer<typeof BigQueryExportProblemSchema>;
export type BigQueryExportVerification = z.infer<
  typeof BigQueryExportVerificationSchema
>;
export type BigQueryExportRowCounts = z.infer<
  typeof BigQueryExportRowCountsSchema
>;
export type BigQueryExportDestination = z.infer<
  typeof BigQueryExportDestinationSchema
>;
export type BigQueryExportStatus = z.infer<typeof BigQueryExportStatusSchema>;
export type BigQueryExportStop = z.infer<typeof BigQueryExportStopSchema>;

export type BigQueryExportFailureReason =
  | "unavailable"
  | "not-configured"
  | "invalid-input"
  | "limit"
  | "problems";

export type BigQueryExportResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: BigQueryExportFailureReason;
      problems?: BigQueryExportProblem[];
    };
