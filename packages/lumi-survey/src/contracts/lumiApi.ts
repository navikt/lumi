export enum ErrorType {
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
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
  context?: SubmissionContextV1 | null;
  answers: Answer[];
}

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
