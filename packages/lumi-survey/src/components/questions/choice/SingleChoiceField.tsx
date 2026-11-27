import { Radio, RadioGroup } from "@navikt/ds-react";
import type {
  ChoiceOption,
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../core/types.js";
import { useSurveyFieldIds } from "../../shared/surveyFieldId.js";
import { useFieldFormOwner } from "../../shared/surveyFormOwner.js";
import { QuestionPrompt, SurveyText } from "../../shared/surveyLanguage.js";
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
  const fieldIds = useSurveyFieldIds(question.id);
  const formOwner = useFieldFormOwner();
  const selected = typeof value === "string" ? value : "";

  return (
    <RadioGroup
      {...(fieldIds && {
        name: fieldIds("field"),
        errorId: fieldIds("error"),
      })}
      legend={<QuestionPrompt question={question} />}
      hideLegend={hideLabel}
      description={
        question.description ? (
          <SurveyText>{question.description}</SurveyText>
        ) : undefined
      }
      value={selected}
      onChange={(nextValue: string) => onChange(nextValue ?? null)}
      disabled={disabled}
      error={isMissing ? validationErrorMessage : undefined}
    >
      {options.map((option: ChoiceOption, index: number) => (
        <Radio
          key={option.value}
          {...formOwner}
          {...(fieldIds && { id: fieldIds(`option-${index}`) })}
          value={option.value}
          // Aksel takes a plain string here, so it cannot carry `lang`.
          description={option.description}
        >
          <SurveyText>{option.label}</SurveyText>
        </Radio>
      ))}
    </RadioGroup>
  );
};
