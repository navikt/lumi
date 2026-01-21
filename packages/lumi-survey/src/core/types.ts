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

/**
 * A condition that determines whether a logic rule should trigger.
 * Uses discriminated unions for type safety.
 *
 * @example Cross-question visibility
 * ```typescript
 * visibleIf: {
 *   field: "ANSWER",
 *   questionId: "rating",
 *   operator: "EXISTS"
 * }
 * ```
 */
export type LogicCondition =
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
 * Action type for logic rules.
 * - "JUMP_TO": Jump to a specific question by ID
 * - "SKIP": Skip the next question (go to currentIndex + 2)
 * - "SUBMIT": Submit the survey immediately
 */
export type LogicActionType = "JUMP_TO" | "SKIP" | "SUBMIT";

/**
 * Action to perform when a logic condition is met.
 * Uses discriminated unions to ensure targetId is provided for JUMP_TO.
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
 */
export interface LogicRule {
  /** Condition to evaluate */
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
  visibleIf?: LogicCondition;
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
 * - "taskPriority": Users select their top 5 most important tasks from a list
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
 * Canonical submission payload (schemaVersion=1).
 * This is the ONLY payload shape that should be sent to analytics backends.
 */
export interface LumiSurveyTransportPayload {
  schemaVersion: 1;
  surveyId: string;
  surveyType: SurveyType;
  submittedAt: string;
  startedAt?: string;
  timeToCompleteMs?: number;
  context?: LumiSurveyContext;
  answers: TransportAnswer[];
}

/**
 * Device type for analytics segmentation.
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Structured context for feedback segmentation and debugging.
 *
 * @example
 * ```tsx
 * <LumiSurveyDock
 *   context={{
 *     tags: { harSykmelding: true, rolle: "arbeidsgiver" },
 *     debug: { sessionId: "abc-123" }
 *   }}
 * />
 * ```
 */
export interface LumiSurveyContext {
  // ============================================
  // System-collected (auto-populated by widget)
  // ============================================

  /** Current page URL */
  url?: string;
  /** Current pathname (without domain) */
  pathname?: string;
  /** Browser viewport dimensions */
  viewport?: { width: number; height: number };
  /** Device type based on viewport width */
  deviceType?: DeviceType;
  /** Browser user agent */
  userAgent?: string;

  // ============================================
  // Tags (for analytics graphs) - LOW CARDINALITY
  // Only string/number/boolean values allowed
  // These will automatically become graphs in the dashboard
  // ============================================

  /**
   * Low-cardinality tags for analytics segmentation.
   *
   * ✅ Good: { harSykmelding: true, rolle: "arbeidsgiver" }
   * ❌ Bad: { behandlingId: "123...", timestamp: 169... }
   */
  tags?: Record<string, string | number | boolean>;

  // ============================================
  // Debug (for detailed debugging) - HIGH CARDINALITY OK
  // Shown only in individual feedback detail view
  // ============================================

  /**
   * High-cardinality debug info for individual feedback inspection.
   * Not used for graphs/segmentation.
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
