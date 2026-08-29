export enum ErrorType {
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
}

export interface ApiError {
  status: number;
  type: ErrorType;
  message: string;
  timestamp: string;
  path?: string;
  details?: string;
  helpUrl?: string;
}

export function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiError>;
  return (
    typeof candidate.status === "number" &&
    typeof candidate.type === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.timestamp === "string"
  );
}

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

export type JsonPrimitive = string | number | boolean | null;

export interface Viewport {
  width: number;
  height: number;
}

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface Question {
  label: string;
  description?: string;
  options?: ChoiceOption[];
}

export interface SubmissionContextV1 {
  url?: string | null;
  pathname?: string | null;
  deviceType?: DeviceType | null;
  viewport?: Viewport | null;
  screenResolution?: Viewport | null;
  userAgent?: string | null;
  tags?: Record<string, JsonPrimitive> | null;
  debug?: Record<string, unknown> | null;
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

export interface FeedbackSubmissionV1 {
  schemaVersion: 1;
  surveyId: string;
  surveyType: SurveyType;
  submittedAt: string;
  startedAt?: string | null;
  timeToCompleteMs?: number | null;
  deduplicationKey?: string | null;
  context?: SubmissionContextV1 | null;
  answers: Answer[];
}

// ============================================
// V2 Submission Types
// Matches lumi-types FeedbackSubmissionV2
// ============================================

export interface SubmissionFieldDefinitionBase {
  fieldId: string;
  fieldType: FieldType;
}

export interface RatingSubmissionFieldDefinition
  extends SubmissionFieldDefinitionBase {
  fieldType: "RATING";
  ratingVariant: "emoji" | "thumbs" | "stars" | "nps";
  ratingScale: number;
}

export interface TextSubmissionFieldDefinition
  extends SubmissionFieldDefinitionBase {
  fieldType: "TEXT";
}

export interface SingleChoiceSubmissionFieldDefinition
  extends SubmissionFieldDefinitionBase {
  fieldType: "SINGLE_CHOICE";
  optionIds: string[];
}

export interface MultiChoiceSubmissionFieldDefinition
  extends SubmissionFieldDefinitionBase {
  fieldType: "MULTI_CHOICE";
  optionIds: string[];
  maxSelections?: number;
}

export interface DateSubmissionFieldDefinition
  extends SubmissionFieldDefinitionBase {
  fieldType: "DATE";
}

export type SubmissionFieldDefinition =
  | RatingSubmissionFieldDefinition
  | TextSubmissionFieldDefinition
  | SingleChoiceSubmissionFieldDefinition
  | MultiChoiceSubmissionFieldDefinition
  | DateSubmissionFieldDefinition;

export interface SubmissionDefinition {
  surveyType: SurveyType;
  fields: SubmissionFieldDefinition[];
}

export interface SubmissionFlowCondition {
  source: "ANSWER" | "METADATA";
  key: string;
  operator: "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS" | "EXISTS";
  value?: string | number | boolean;
}

export interface SubmissionFlowField {
  fieldId: string;
  visibleIf?: {
    combinator: "ALL" | "ANY";
    conditions: SubmissionFlowCondition[];
  };
}

export interface SubmissionFlowV1 {
  schemaVersion: 1;
  evaluatorVersion: "visible-if-v1";
  fields: SubmissionFlowField[];
}

export interface FeedbackSubmissionV2 {
  schemaVersion: 2;
  surveyId: string;
  surveyType: SurveyType;
  submittedAt: string;
  startedAt?: string | null;
  timeToCompleteMs?: number | null;
  deduplicationKey: string;
  definition: SubmissionDefinition;
  flow?: SubmissionFlowV1;
  context?: SubmissionContextV1 | null;
  answers: Answer[];
}

export type FeedbackSubmission = FeedbackSubmissionV1 | FeedbackSubmissionV2;

export interface SubmissionCreatedResponse {
  id: string;
}

export function isSubmissionCreatedResponse(
  value: unknown,
): value is SubmissionCreatedResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SubmissionCreatedResponse>;
  return typeof candidate.id === "string";
}
