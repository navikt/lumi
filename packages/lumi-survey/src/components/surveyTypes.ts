import type {
  LogicOperator,
  LumiSurveyQuestion,
  SurveyType,
} from "../core/types.js";

export type { SurveyType };

/**
 * Configuration for a Lumi survey.
 * Questions are displayed in array order.
 * Use `visibleIf` on individual questions for progressive disclosure.
 */
export interface LumiSurveyConfig {
  /** Versioned documents use `SurveyDocumentV1` instead. */
  authoringSchemaVersion?: never;
  /** Versioned documents use `pages` instead. */
  pages?: never;
  /**
   * Survey type for analytics categorization.
   * Determines how the dashboard displays and aggregates results.
   * @default "custom"
   */
  type?: SurveyType;

  /**
   * All questions to display, in order.
   * The first question is rendered prominently in the dock header.
   * Use `visibleIf` on subsequent questions for progressive disclosure.
   */
  questions: LumiSurveyQuestion[];
}

type SurveyConditionTargetV1 =
  | {
      field?: "ANSWER";
      questionId: string;
    }
  | {
      field: "METADATA";
      key: string;
    };

type SurveyConditionOperatorV1 =
  | {
      operator: "EXISTS";
      value?: never;
    }
  | {
      operator: Exclude<LogicOperator, "EXISTS">;
      value: string | number | boolean;
    };

type SurveyConditionLeafV1 = SurveyConditionTargetV1 &
  SurveyConditionOperatorV1;

type SurveyVisibleIfV1 =
  | SurveyConditionLeafV1
  | { any: SurveyConditionLeafV1[] }
  | { all: SurveyConditionLeafV1[] };

type RemoveLegacyLogic<T> = T extends unknown
  ? Omit<T, "logic" | "visibleIf"> & {
      readonly logic?: never;
      visibleIf?: SurveyVisibleIfV1;
    }
  : never;

/** A question authored in the version 1 survey document format. */
export type SurveyQuestionV1 = RemoveLegacyLogic<LumiSurveyQuestion>;

/** An authored page. Visible questions on the page are rendered together. */
export interface SurveyPageV1 {
  /** Stable identifier within the authoring document. */
  id: string;
  /** Optional page heading. */
  title?: string;
  /** Optional shared context shown below the page heading. */
  description?: string;
  /** Ordered, non-empty question list. Runtime validation also enforces this. */
  questions: [SurveyQuestionV1, ...SurveyQuestionV1[]];
}

/**
 * Serializable authoring format for surveys with explicit pages.
 * This version is separate from the submission payload schema version.
 */
export interface SurveyDocumentV1 {
  authoringSchemaVersion: 1;
  type?: SurveyType;
  pages: [SurveyPageV1, ...SurveyPageV1[]];
  /** Legacy flat configurations use `questions` instead. */
  questions?: never;
}

/** Public survey input: legacy flat configuration or an explicit page document. */
export type LumiSurveyDefinition = LumiSurveyConfig | SurveyDocumentV1;
