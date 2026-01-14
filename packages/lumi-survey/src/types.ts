import type { FlexJarAnswerValue, FlexJarQuestion } from "./core/types.js";

export interface FlexJarRenderQuestionProps {
  question: FlexJarQuestion;
  value: FlexJarAnswerValue | undefined;
  onChange: (nextValue: FlexJarAnswerValue | null | undefined) => void;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

export interface FlexJarDefaultQuestionProps
  extends FlexJarRenderQuestionProps {
  validationErrorMessage: string;
}
