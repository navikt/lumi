import { Checkbox, CheckboxGroup } from "@navikt/ds-react";
import type {
  ChoiceOption,
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../core/types.js";
import {
  BuiltInText,
  QuestionPrompt,
  SurveyText,
} from "../../shared/surveyLanguage.js";
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
  const maxSelections = question.maxSelections;
  const selectionLimitReached =
    maxSelections !== undefined && selected.length >= maxSelections;
  const limitText = maxSelections ? `Velg opptil ${maxSelections}` : undefined;
  const description =
    question.description || limitText ? (
      <>
        {question.description && (
          <SurveyText>{question.description}</SurveyText>
        )}
        {question.description && limitText && " • "}
        {limitText && <BuiltInText>{limitText}</BuiltInText>}
      </>
    ) : undefined;

  return (
    <CheckboxGroup
      legend={<QuestionPrompt question={question} />}
      hideLegend={hideLabel}
      description={description}
      value={selected}
      onChange={(nextValues: string[]) => {
        if (maxSelections && nextValues.length > maxSelections) return;
        onChange(nextValues);
      }}
      disabled={disabled}
      error={isMissing ? validationErrorMessage : undefined}
    >
      {options.map((option: ChoiceOption) => (
        <Checkbox
          key={option.value}
          value={option.value}
          // Aksel takes a plain string here, so it cannot carry `lang`.
          description={option.description}
          disabled={
            disabled ||
            (selectionLimitReached && !selected.includes(option.value))
          }
        >
          <SurveyText>{option.label}</SurveyText>
        </Checkbox>
      ))}
    </CheckboxGroup>
  );
};
