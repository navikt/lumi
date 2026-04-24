// ============================================
// Type-only exports for Lumi dashboard
// All API logic is in server functions
// ============================================

// ============================================
// Widget Submission Types (schemaVersion=1)
// Matches apps/lumi-api domain/SubmissionV1.kt
// ============================================

export type JsonPrimitive = string | number | boolean | null;

export interface Viewport {
  width: number;
  height: number;
}

export interface SubmissionContextV1 {
  url?: string | null;
  pathname?: string | null;
  deviceType?: DeviceType | null;
  viewport?: Viewport | null;
  screenResolution?: Viewport | null;
  userAgent?: string | null;
  /** Low-cardinality segmentation tags (values must be JSON primitives). */
  tags?: Record<string, JsonPrimitive> | null;
  /** Debug payload (ignored by backend storage/analytics). */
  debug?: Record<string, unknown> | null;
}

export interface FeedbackSubmissionV1 {
  schemaVersion: 1;
  surveyId: string;
  surveyType: SurveyType;
  submittedAt: string;
  startedAt?: string | null;
  timeToCompleteMs?: number | null;
  context?: SubmissionContextV1 | null;
  answers: Answer[];
}

export interface SubmissionCreatedResponse {
  id: string;
}

// ============================================
// Answer Types
// ============================================

export type FieldType =
  | "RATING"
  | "TEXT"
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "DATE";

export type SurveyType =
  | "rating"
  | "topTasks"
  | "discovery"
  | "taskPriority"
  | "custom";

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface Question {
  label: string;
  description?: string;
  options?: ChoiceOption[];
}

export interface BaseAnswer {
  fieldId: string;
  fieldType: FieldType;
  question: Question;
}

export interface RatingAnswer extends BaseAnswer {
  fieldType: "RATING";
  value: {
    type: "rating";
    rating: number;
    ratingVariant?: "emoji" | "thumbs" | "stars" | "nps";
    ratingScale?: number;
  };
}

export interface TextAnswer extends BaseAnswer {
  fieldType: "TEXT";
  value: { type: "text"; text: string };
}

export interface SingleChoiceAnswer extends BaseAnswer {
  fieldType: "SINGLE_CHOICE";
  value: { type: "singleChoice"; selectedOptionId: string };
}

export interface MultiChoiceAnswer extends BaseAnswer {
  fieldType: "MULTI_CHOICE";
  value: { type: "multiChoice"; selectedOptionIds: string[] };
}

export interface DateAnswer extends BaseAnswer {
  fieldType: "DATE";
  value: { type: "date"; date: string };
}

export type Answer =
  | RatingAnswer
  | TextAnswer
  | SingleChoiceAnswer
  | MultiChoiceAnswer
  | DateAnswer;

// ============================================
// Field Stats Types
// ============================================

export interface RatingStats {
  type: "rating";
  average: number;
  /** JSON object keys are strings (e.g. "1", "2", ...). */
  distribution: Record<string, number>;
}

export interface TextStats {
  type: "text";
  responseCount: number;
  responseRate: number;
  /** Top keywords extracted from text responses */
  topKeywords: Array<{ word: string; count: number }>;
  /** Most recent text responses with timestamps */
  recentResponses: Array<{ text: string; submittedAt: string }>;
  /** Top bigram phrases extracted from text responses */
  topPhrases?: Array<{ text: string; count: number }>;
}

export interface ChoiceStats {
  type: "choice";
  responseCount?: number;
  responseRate?: number;
  totalSelections?: number;
  distribution: Record<
    string,
    { label: string; count: number; percentage: number }
  >;
}

export type FieldStats = RatingStats | TextStats | ChoiceStats;

export interface FieldStat {
  fieldId: string;
  fieldType: FieldType;
  label: string;
  stats: FieldStats;
}

// ============================================
// Context Types
// ============================================

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface SubmissionContext {
  url?: string;
  pathname?: string;
  deviceType?: DeviceType;
  viewportWidth?: number;
  viewportHeight?: number;
  screenWidth?: number;
  screenHeight?: number;
  tags?: Record<string, string>;
}

// ============================================
// API Response Types
// ============================================

export interface FeedbackDto {
  id: string;
  submittedAt: string;
  app: string | null;
  surveyId: string;
  surveyVersion?: string;
  surveyType?: SurveyType;
  context?: SubmissionContext;

  /** Custom metadata for segmentation/filtering in analytics */
  metadata?: Record<string, string> | null;

  answers: Answer[];
  tags?: string[];
  sensitiveDataRedacted: boolean;
  /** Duration in milliseconds from visit start to submission */
  durationMs?: number;
  /** ISO timestamp when the user started the session/task */
  visitStartedAt?: string;
}

export interface FeedbackPage {
  content: FeedbackDto[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FeedbackStats {
  totalCount: number;
  countWithText: number;
  countWithoutText: number;

  byRating: Record<string, number>;
  byApp: Record<string, number>;
  byDate: Record<string, number>;
  bySurveyId: Record<string, number>;
  averageRating: number | null;

  // Rating trend over time
  ratingByDate: Record<string, { average: number; count: number }>;

  // Device & context stats
  byDevice: Record<string, { count: number; averageRating: number }>;
  byPathname: Record<string, { count: number; averageRating: number }>;
  lowestRatingPaths: Record<string, { count: number; averageRating: number }>;

  // New: per-field statistics
  fieldStats: FieldStat[];

  surveyType?: SurveyType;

  period: {
    fromDate: string | null;
    toDate: string | null;
    days: number;
  };

  // Privacy threshold info
  privacy?: PrivacyInfo;
}

/**
 * Privacy information for aggregation threshold
 * Used to prevent identification of individuals in small datasets
 */
export interface PrivacyInfo {
  masked: boolean;
  reason?: string;
  threshold: number;
}

export interface TeamsAndApps {
  teams: Record<string, string[]>;
}

// ============================================
// Top Tasks Types
// ============================================

export interface TopTaskStats {
  task: string;
  totalCount: number;
  successCount: number;
  partialCount: number;
  failureCount: number;
  successRate: number;
  formattedSuccessRate: string;
  blockerCounts: Record<string, number>;
  /** Blockers grouped by theme for expanded row display */
  blockersByTheme?: Record<
    string,
    { themeName: string; color: string; count: number; examples: string[] }
  >;
  // TPI (Task Performance Indicator) fields
  avgTimeMs?: number;
  targetTimeMs?: number;
  tpiScore?: number;
}

export interface TopTasksResponse {
  totalSubmissions: number;
  tasks: TopTaskStats[];
  dailyStats: Record<string, { total: number; success: number }>;
  questionText?: string;
  // TPI aggregate metrics
  overallTpi?: number;
  avgCompletionTimeMs?: number;
  /** Percentage of submissions that fell into 'Other' category. Warning if > 15%. */
  otherTasksPercentage?: number;
}

// ============================================
// Metadata Keys Types
// ============================================

/** A metadata value with its occurrence count */
export interface MetadataValueWithCount {
  value: string;
  count: number;
}

export interface ContextTagsResponse {
  surveyId: string;
  /** Context tags with their values and counts */
  contextTags: Record<string, MetadataValueWithCount[]>;
  /** The maxCardinality used for filtering */
  maxCardinality?: number;
}

// ============================================
// Discovery Survey Types
// ============================================

/** Word variant with its occurrence count */
export interface WordVariant {
  word: string;
  count: number;
}

/** Source response for context examples */
export interface SourceResponse {
  text: string;
  submittedAt: string;
}

/**
 * Word frequency entry for word cloud (unified for Discovery and Blocker).
 * Groups word variants by stem and provides context examples.
 */
export interface WordFrequency {
  /** Canonical display form (most common surface form) */
  word: string;
  /** Normalized/stemmed form (stable key for grouping) */
  stem: string;
  /** Total occurrences across all variants */
  count: number;
  /** Top word variants with their counts (max 5) */
  variants?: WordVariant[];
  /** Source responses containing this word for context examples */
  sourceResponses?: SourceResponse[];
}

export interface PhraseEntry {
  text: string;
  count: number;
  /** UUIDer til kildesvar for frasen. Optional fordi TextStats-konteksten ikke beregner dette. */
  sourceResponseIds?: string[];
}

export interface QuoteEntry {
  text: string;
  answeredAt: string;
}

export type ConfidenceLevel = "low" | "medium" | "high";

export interface DiscoveryTheme {
  theme: string;
  count: number;
  successRate: number;
  examples: string[];
}

export interface DiscoveryResponse {
  totalSubmissions: number;
  wordFrequency: WordFrequency[];
  themes: DiscoveryTheme[];
  recentResponses: Array<{
    task: string;
    success: "yes" | "partial" | "no";
    blocker?: string;
    submittedAt: string;
  }>;
  phrases?: PhraseEntry[];
  quotes?: QuoteEntry[];
  confidenceLevel?: ConfidenceLevel;
}

// ============================================
// Blocker Pattern Types (for Top Tasks)
// ============================================

export interface BlockerTheme {
  theme: string;
  themeId: string;
  count: number;
  examples: string[];
  color?: string;
}

export interface BlockerResponse {
  totalBlockers: number;
  wordFrequency: WordFrequency[];
  themes: BlockerTheme[];
  recentBlockers: Array<{
    blocker: string;
    task: string;
    submittedAt: string;
  }>;
  phrases?: PhraseEntry[];
  quotes?: QuoteEntry[];
  confidenceLevel?: ConfidenceLevel;
}

// ============================================
// Text Theme Types (for theme management)
// ============================================

/** Context for text analysis - determines which field to analyze */
export type AnalysisContext = "GENERAL_FEEDBACK" | "BLOCKER";

export interface TextTheme {
  id: string;
  team: string;
  name: string;
  keywords: string[];
  color?: string;
  priority: number;
  /** Context for this theme - GENERAL_FEEDBACK for discovery, BLOCKER for top tasks */
  analysisContext: AnalysisContext;
}

export interface CreateThemeInput {
  name: string;
  keywords: string[];
  color?: string;
  priority?: number;
  analysisContext?: AnalysisContext;
}

export interface UpdateThemeInput {
  name?: string;
  keywords?: string[];
  color?: string;
  priority?: number;
  analysisContext?: AnalysisContext;
}

// ============================================
// Task Priority Survey Types
// ============================================

export interface TaskVote {
  task: string;
  votes: number;
  percentage: number;
}

export interface TaskPriorityResponse {
  totalSubmissions: number;
  tasks: TaskVote[];
  /** Index in tasks array where cumulative percentage hits 80% (the "long neck") */
  longNeckCutoff: number;
  cumulativePercentageAt5: number;
}

// ============================================
// Rating Marker Types
// ============================================

export interface RatingMarker {
  id: string;
  team: string;
  surveyId: string;
  markerDate: string; // YYYY-MM-DD
  label: string;
  description?: string | null;
  color?: string | null;
  createdBy?: string | null;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface CreateMarkerInput {
  markerDate: string;
  label: string;
  description?: string;
  color?: string;
}

export interface UpdateMarkerInput {
  markerDate?: string;
  label?: string;
  description?: string;
  color?: string;
  clearDescription?: boolean;
  clearColor?: boolean;
}

// ============================================
// Delete Survey Types
// ============================================

export interface DeleteSurveyResult {
  deletedCount: number;
  surveyId: string;
}
