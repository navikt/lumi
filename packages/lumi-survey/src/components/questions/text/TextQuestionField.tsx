import { Textarea } from "@navikt/ds-react";
import type React from "react";
import type { FlexJarAnswerValue, TextQuestion } from "../../../core";

interface TextQuestionFieldProps {
  question: TextQuestion;
  value: FlexJarAnswerValue | undefined;
  onChange: (value: string) => void;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

export const TextQuestionField = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  hideLabel,
}: TextQuestionFieldProps) => (
  <Textarea
    label={question.prompt}
    hideLabel={hideLabel}
    description={question.description}
    value={typeof value === "string" ? value : ""}
    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChange(event.target.value)
    }
    maxLength={question.maxLength ?? 1000}
    minRows={question.minRows}
    placeholder={question.placeholder}
    autoComplete={question.autoComplete}
    disabled={disabled}
    error={isMissing ? validationErrorMessage : undefined}
  />
);
