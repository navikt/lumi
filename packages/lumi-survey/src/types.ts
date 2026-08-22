import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "./core/types.js";

export interface LumiSurveyRenderQuestionProps {
  question: LumiSurveyQuestion;
  value: LumiSurveyAnswerValue | undefined;
  onChange: (nextValue: LumiSurveyAnswerValue | null | undefined) => void;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

export interface LumiSurveyDefaultQuestionProps
  extends LumiSurveyRenderQuestionProps {
  validationErrorMessage: string;
  textTooLongErrorMessage?: (maxLength: number) => string;
}
