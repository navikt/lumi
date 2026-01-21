import { Radio, RadioGroup } from "@navikt/ds-react";
import type {
  ChoiceOption,
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../core/types.js";
import { formatQuestionPrompt } from "../utils/formatQuestionPrompt.js";
import { useChoiceOptions } from "./useChoiceOptions.js";

interface SingleChoiceFieldProps {
  question: ChoiceQuestion & { type: "singleChoice" };
  value: LumiSurveyAnswerValue | undefined;
  onChange: (value: string | null) => void;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

export const SingleChoiceField = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  hideLabel,
}: SingleChoiceFieldProps) => {
  const options = useChoiceOptions(question);
  const selected = typeof value === "string" ? value : "";

  return (
    <RadioGroup
      legend={formatQuestionPrompt(question)}
      hideLegend={hideLabel}
      description={question.description}
      value={selected}
      onChange={(nextValue: string) => onChange(nextValue ?? null)}
      disabled={disabled}
      error={isMissing ? validationErrorMessage : undefined}
    >
      {options.map((option: ChoiceOption) => (
        <Radio
          key={option.value}
          value={option.value}
          description={option.description}
        >
          {option.label}
        </Radio>
      ))}
    </RadioGroup>
  );
};
