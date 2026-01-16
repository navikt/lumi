import { Checkbox, CheckboxGroup } from "@navikt/ds-react";
import type {
  ChoiceOption,
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../core/types.js";
import { useChoiceOptions } from "./useChoiceOptions.js";

interface MultiChoiceFieldProps {
  question: ChoiceQuestion & { type: "multiChoice" };
  value: LumiSurveyAnswerValue | undefined;
  onChange: (value: string[]) => void;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

export const MultiChoiceField = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  hideLabel,
}: MultiChoiceFieldProps) => {
  const options = useChoiceOptions(question);
  const selected = Array.isArray(value) ? value : [];

  return (
    <CheckboxGroup
      legend={question.prompt}
      hideLegend={hideLabel}
      description={question.description}
      value={selected}
      onChange={(nextValues: string[]) => onChange(nextValues)}
      disabled={disabled}
      error={isMissing ? validationErrorMessage : undefined}
    >
      {options.map((option: ChoiceOption) => (
        <Checkbox
          key={option.value}
          value={option.value}
          description={option.description}
        >
          {option.label}
        </Checkbox>
      ))}
    </CheckboxGroup>
  );
};
