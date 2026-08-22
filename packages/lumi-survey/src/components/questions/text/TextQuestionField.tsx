import { Textarea } from "@navikt/ds-react";
import type React from "react";
import type { LumiSurveyAnswerValue, TextQuestion } from "../../../core";
import { getTextAnswerMaxLength } from "../../../core/textAnswerLimits.js";
import { DEFAULT_COPY } from "../../shared/commonDefaults.js";
import { formatQuestionPrompt } from "../utils/formatQuestionPrompt.js";

interface TextQuestionFieldProps {
  question: TextQuestion;
  value: LumiSurveyAnswerValue | undefined;
  onChange: (value: string) => void;
  validationErrorMessage: string;
  textTooLongErrorMessage?: (maxLength: number) => string;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

export const TextQuestionField = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  textTooLongErrorMessage = DEFAULT_COPY.textTooLongErrorMessage,
  isMissing,
  disabled,
  hideLabel,
}: TextQuestionFieldProps) => {
  const textValue = typeof value === "string" ? value : "";
  const maxLength = getTextAnswerMaxLength(question);
  const isOverLimit = textValue.length > maxLength;
  const errorMessage = isOverLimit
    ? textTooLongErrorMessage(maxLength)
    : validationErrorMessage;

  return (
    <Textarea
      label={formatQuestionPrompt(question)}
      hideLabel={hideLabel}
      description={question.description}
      value={textValue}
      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(event.target.value)
      }
      maxLength={maxLength}
      minRows={question.minRows}
      placeholder={question.placeholder}
      autoComplete={question.autoComplete}
      disabled={disabled}
      error={isMissing || isOverLimit ? errorMessage : undefined}
    />
  );
};
