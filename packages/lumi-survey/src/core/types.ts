export type LumiSurveyQuestionType =
  | "rating"
  | "text"
  | "singleChoice"
  | "multiChoice";

// ============================================
// Branching Logic Types (Skip Logic)
// ============================================

/**
 * Field type for logic conditions.
 * - "ANSWER": Compare against the current question's answer
 * - "METADATA": Compare against a value in the survey metadata
 */
export type LogicField = "ANSWER" | "METADATA";

/**
 * Comparison operators for logic conditions.
 * - EXISTS: Check if an answer exists (is not undefined)
 */
export type LogicOperator = "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS" | "EXISTS";

export type LogicLeafCondition =
  | {
      /** Compare against a question's answer */
      field?: "ANSWER";
      /** Reference to another question's answer (required for visibleIf) */
      questionId?: string;
      /** Comparison operator */
      operator: LogicOperator;
      /** Value to compare against (not required for EXISTS) */
      value?: string | number | boolean;
    }
  | {
      /** Compare against a value in the survey metadata */
      field: "METADATA";
      /** Key to look up in metadata (required for METADATA) */
      key: string;
      /** Comparison operator */
      operator: LogicOperator;
      /** Value to compare against */
      value: string | number | boolean;
    };

/**
 * A group of leaf conditions combined with AND (`all`) or OR (`any`).
 * One level only — group members are leaves, not nested groups (kept
 * forward-compatible: widening to `LogicCondition[]` later is non-breaking).
 * Only `visibleIf` supports groups; `logic` is leaf-only.
 */
export type LogicConditionGroup =
  | { any: LogicLeafCondition[] }
  | { all: LogicLeafCondition[] };

/**
 * Leaf-only condition language. Kept as the historical public name so existing
 * `LogicRule` / `visibleIf` authorings stay source-compatible after `any`/`all`
 * groups were added — groups live in the wider `VisibleIfCondition`.
 */
export type LogicCondition = LogicLeafCondition;

/**
 * Condition language for `visibleIf`: a single leaf, or a one-level `any`/`all`
 * group of leaves. Wider than `LogicCondition`; only `visibleIf` accepts groups.
 */
export type VisibleIfCondition = LogicLeafCondition | LogicConditionGroup;

/**
 * Action type for logic rules.
 * - "JUMP_TO": Jump to a specific question by ID
 * - "SKIP": Skip the next question (go to currentIndex + 2)
 * - "SUBMIT": Submit the survey immediately
 *
 * @deprecated Compatibility type for legacy flat surveys. New surveys should
 * use `SurveyDocumentV1` pages and `visibleIf` instead of imperative logic.
 */
export type LogicActionType = "JUMP_TO" | "SKIP" | "SUBMIT";

/**
 * Action to perform when a logic condition is met.
 * Uses discriminated unions to ensure targetId is provided for JUMP_TO.
 *
 * @deprecated Compatibility type for legacy flat surveys. New surveys should
 * use `SurveyDocumentV1` pages and `visibleIf`.
 */
export type LogicAction =
  | {
      /** Jump to a specific question */
      type: "JUMP_TO";
      /** Target question ID (required for JUMP_TO) */
      targetId: string;
    }
  | {
      /** Skip the next question */
      type: "SKIP";
    }
  | {
      /** Submit the survey immediately */
      type: "SUBMIT";
    };

/**
 * A branching rule that controls survey navigation.
 * Rules are evaluated in order; first matching rule wins.
 *
 * @deprecated Compatibility type for legacy flat surveys. New surveys should
 * model the flow with `SurveyDocumentV1` pages and `visibleIf`.
 */
export interface LogicRule {
  /** Condition to evaluate (leaf only — `logic` does not support any/all groups) */
  condition: LogicCondition;
  /** Action to perform if condition is met */
  action: LogicAction;
}

// ============================================
// Question Base Type
// ============================================

export interface LumiSurveyQuestionBase<TType extends LumiSurveyQuestionType> {
  id: string;
  type: TType;
  prompt: string;
  description?: string;
  required?: boolean;
  analyticsId?: string;
  /**
   * Optional branching rules evaluated after this question is answered.
   * Rules are evaluated in order; first matching rule determines navigation.
   * If no rules match (or logic is undefined), proceeds to next question.
   *
   * @deprecated Supported for existing flat surveys only. New surveys should
   * use `SurveyDocumentV1` pages and `visibleIf`.
   */
  logic?: LogicRule[];
  /**
   * Condition that must be true for this question to be visible.
   * Use for progressive disclosure (e.g., show text field after rating is set).
   *
   * @example Show text field only after rating is provided
   * ```typescript
   * {
   *   id: "feedback",
   *   type: "text",
   *   prompt: "Any additional comments?",
   *   visibleIf: {
   *     field: "ANSWER",
   *     questionId: "rating",
   *     operator: "EXISTS"
   *   }
   * }
   * ```
   */
  visibleIf?: VisibleIfCondition;
}

// ============================================
// Rating Variants (Opinionated, Fixed Scales)
// ============================================

/**
 * Rating variant determines both visual style and fixed scale.
 * - emoji: 5-point (😡🙁😐😀😍)
 * - thumbs: 2-point (👎👍)
 * - stars: 5-point (⭐⭐⭐⭐⭐)
 * - nps: 0-10 number buttons
 */
export type RatingVariant = "emoji" | "thumbs" | "stars" | "nps";

/** Maps variant to its fixed scale */
export const RATING_SCALES: Record<RatingVariant, number> = {
  emoji: 5,
  thumbs: 2,
  stars: 5,
  nps: 11, // 0-10
};

export interface RatingScaleLabel {
  value: number;
  label: string;
}

/**
 * Base interface for all rating question types.
 */
interface RatingQuestionBase extends LumiSurveyQuestionBase<"rating"> {
  labels?: RatingScaleLabel[];
}

/**
 * 5-point emoji rating: 😡 🙁 😐 😀 😍
 */
export interface EmojiRatingQuestion extends RatingQuestionBase {
  variant?: "emoji"; // Default, can be omitted
}

/**
 * 2-point thumbs rating: 👎 👍
 */
export interface ThumbsRatingQuestion extends RatingQuestionBase {
  variant: "thumbs";
}

/**
 * 5-point star rating: ⭐⭐⭐⭐⭐
 * Fixed at 5 stars (industry standard).
 */
export interface StarRatingQuestion extends RatingQuestionBase {
  variant: "stars";
}

/**
 * NPS (Net Promoter Score) rating: 0-10 number buttons
 */
export interface NpsRatingQuestion extends RatingQuestionBase {
  variant: "nps";
  lowLabel?: string; // e.g. "Lite sannsynlig"
  highLabel?: string; // e.g. "Svært sannsynlig"
}

/**
 * Union type for all rating question variants.
 */
export type RatingQuestion =
  | EmojiRatingQuestion
  | ThumbsRatingQuestion
  | StarRatingQuestion
  | NpsRatingQuestion;

export interface TextQuestion extends LumiSurveyQuestionBase<"text"> {
  maxLength?: number;
  minRows?: number;
  placeholder?: string;
  autoComplete?: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Display variant for multi-choice questions.
 * - "checkbox": Traditional checkbox list (default) - better for few options
 * - "combobox": Searchable dropdown with chips - better for many options (10+)
 */
export type MultiChoiceVariant = "checkbox" | "combobox";

export interface ChoiceQuestion
  extends LumiSurveyQuestionBase<"singleChoice" | "multiChoice"> {
  options: ChoiceOption[];
  randomize?: boolean;
  /**
   * Display variant for multiChoice questions.
   * - "checkbox": Traditional checkbox list (default)
   * - "combobox": Searchable dropdown with chip display (recommended for 10+ options)
   */
  variant?: MultiChoiceVariant;
  /**
   * Maximum selections allowed for multiChoice.
   * Use with variant="combobox" for Task Priority surveys.
   */
  maxSelections?: number;
}

export type LumiSurveyQuestion =
  | RatingQuestion
  | TextQuestion
  | (ChoiceQuestion & { type: "singleChoice" })
  | (ChoiceQuestion & { type: "multiChoice" });

export type LumiSurveyAnswerValue = string | number | string[];

/**
 * Survey type identifier for analytics and dashboard display.
 * - "rating": Classic 1-5 scale with optional text (current default behavior)
 * - "topTasks": Task selection + success measurement for conversion tracking
 * - "discovery": Free-text task discovery to identify what users are trying to do
 * - "taskPriority": Users select a configured number of important tasks from a list
 * - "custom": Any other question combination
 */
export type SurveyType =
  | "rating"
  | "topTasks"
  | "discovery"
  | "taskPriority"
  | "custom";

/** Structured answer for transport/analytics */
export interface TransportAnswer {
  fieldId: string;
  fieldType: "RATING" | "TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";
  question: {
    label: string;
    description?: string;
    options?: Array<{ id: string; label: string }>;
  };
  value: {
    type: "rating" | "text" | "singleChoice" | "multiChoice";
    rating?: number;
    /** Rating variant: emoji, thumbs, stars, nps */
    ratingVariant?: RatingVariant;
    /** Scale is fixed per variant: emoji=5, thumbs=2, stars=5, nps=11 */
    ratingScale?: number;
    text?: string;
    selectedOptionId?: string;
    selectedOptionIds?: string[];
  };
}

/**
 * V2 field definition for the transport payload definition block.
 */
export type TransportFieldDefinition =
  | {
      fieldId: string;
      fieldType: "RATING";
      ratingVariant: RatingVariant;
      ratingScale: number;
    }
  | { fieldId: string; fieldType: "TEXT" }
  | { fieldId: string; fieldType: "SINGLE_CHOICE"; optionIds: string[] }
  | {
      fieldId: string;
      fieldType: "MULTI_CHOICE";
      optionIds: string[];
      maxSelections?: number;
    };

/**
 * V2 submission definition block containing survey structure.
 */
export interface TransportDefinition {
  surveyType: SurveyType;
  fields: TransportFieldDefinition[];
}

export type TransportFlowConditionSource = "ANSWER" | "METADATA";

export interface TransportFlowCondition {
  source: TransportFlowConditionSource;
  key: string;
  operator: LogicOperator;
  value?: string | number | boolean;
}

export interface TransportVisibleIf {
  combinator: "ALL" | "ANY";
  conditions: TransportFlowCondition[];
}

export interface TransportFlowField {
  fieldId: string;
  visibleIf?: TransportVisibleIf;
}

/**
 * Canonical, visibleIf-only flow contract sent with schemaVersion 2.
 * Deprecated imperative `logic` is deliberately not representable here.
 */
export interface TransportFlowV1 {
  schemaVersion: 1;
  evaluatorVersion: "visible-if-v1";
  fields: TransportFlowField[];
}

/**
 * Canonical submission payload (schemaVersion=2).
 * Includes full definition of all fields and deduplication key.
 */
export interface LumiSurveyTransportPayload {
  schemaVersion: 2;
  surveyId: string;
  surveyType: SurveyType;
  submittedAt: string;
  startedAt?: string;
  timeToCompleteMs?: number;
  deduplicationKey: string;
  definition: TransportDefinition;
  flow?: TransportFlowV1;
  context?: LumiSurveyContext;
  answers: TransportAnswer[];
}

/**
 * Device type for analytics segmentation.
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Structured context stored with a survey submission.
 *
 * @example
 * ```tsx
 * <LumiSurveyDock
 *   context={{
 *     tags: { abTest: "A", rolle: "arbeidsgiver" }
 *   }}
 * />
 * ```
 */
export interface LumiSurveyContext {
  // ============================================
  // Location (not included by default)
  // ============================================

  /** Current page URL. Never auto-collected. */
  url?: string;
  /** Current pathname (without domain). Explicit context or opt-in via collectLocation. */
  pathname?: string;

  // ============================================
  // System-collected (auto-populated by widget)
  // ============================================

  /** Browser viewport dimensions */
  viewport?: { width: number; height: number };
  /** Physical screen resolution (unaffected by window size) */
  screenResolution?: { width: number; height: number };
  /** Device type derived from UA Client Hints, user-agent parsing, or viewport fallback */
  deviceType?: DeviceType;
  /** Browser user agent. Stored, but not returned by the current dashboard/export read model. */
  userAgent?: string;

  // ============================================
  // Tags (for analytics graphs) - LOW CARDINALITY
  // Only string/number/boolean values allowed
  // These will automatically become graphs in the dashboard
  // ============================================

  /**
   * Low-cardinality tags for analytics segmentation.
   *
   * ✅ Good: { abTest: "A", rolle: "arbeidsgiver" }
   * ❌ Bad: { behandlingId: "123...", timestamp: 169... }
   */
  tags?: Record<string, string | number | boolean>;

  // ============================================
  // Optional debug data (stored, but not exposed by the current read model)
  // ============================================

  /**
   * Optional diagnostic data. Not used for graphs/segmentation.
   * Never include personal, user, or case identifiers.
   */
  debug?: Record<string, unknown>;
}

export interface LumiSurveySubmission {
  surveyId: string;
  answers: Record<string, LumiSurveyAnswerValue>;
  startedAt: string;
  submittedAt: string;
  context?: LumiSurveyContext;
  transportPayload: LumiSurveyTransportPayload;
}

export interface LumiSurveyTransport {
  submit: (submission: LumiSurveySubmission) => Promise<void>;
}

export interface LumiSurveyEvents {
  onViewDock?: (surveyId: string) => void;
  onAnswer?: (questionId: string, value: unknown) => void;
  onSubmitStart?: (submission: LumiSurveySubmission) => void;
  onSubmitSuccess?: (submission: LumiSurveySubmission) => void;
  onSubmitError?: (cause: unknown) => void;
  onValidationFailed?: (missingQuestionIds: string[]) => void;
  onReset?: () => void;
  /**
   * Fired when the dock cannot persist its dismissal flag due to storage restrictions (for example when consent is denied).
   */
  onDismissalPersistFailed?: (cause: unknown) => void;
  /**
   * Fired when the current step changes in step mode.
   * Also fires on initial render when step mode is active.
   * A step is an authored page for version 1 documents and a question for
   * legacy flat surveys. Receives the 0-based visible step index and estimated
   * total reachable steps.
   */
  onStepChange?: (visibleStepIndex: number, totalVisibleSteps: number) => void;
}

export type LumiSurveyStatus = "idle" | "submitting" | "success" | "error";

export interface LumiSurveyValidationError {
  type: "validation";
  missing: string[];
}

export interface LumiSurveyTransportError {
  type: "transport";
  cause: unknown;
}

export type LumiSurveyError =
  | LumiSurveyValidationError
  | LumiSurveyTransportError;

export interface LumiSurveySubmitSuccess {
  ok: true;
  submission: LumiSurveySubmission;
}

export interface LumiSurveySubmitFailure {
  ok: false;
  error: LumiSurveyError;
}

export type LumiSurveySubmitResult =
  | LumiSurveySubmitSuccess
  | LumiSurveySubmitFailure;
