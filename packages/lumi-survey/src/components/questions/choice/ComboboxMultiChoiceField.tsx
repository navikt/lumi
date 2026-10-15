import { UNSAFE_Combobox } from "@navikt/ds-react";
import { useMemo } from "react";
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

interface ComboboxMultiChoiceFieldProps {
  question: ChoiceQuestion & { type: "multiChoice" };
  value: LumiSurveyAnswerValue | undefined;
  onChange: (value: string[]) => void;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  hideLabel?: boolean;
}

/**
 * Multi-choice field using Aksel Combobox.
 * Ideal for questions with many options (10+) like Task Priority surveys.
 * Features:
 * - Searchable/filterable dropdown
 * - Selected options shown as chips
 * - Supports maxSelections limit
 */
export const ComboboxMultiChoiceField = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  hideLabel,
}: ComboboxMultiChoiceFieldProps) => {
  const options = useChoiceOptions(question);
  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const maxSelections = question.maxSelections;

  // Build a map for quick label lookup
  const optionMap = useMemo(() => {
    const map = new Map<string, ChoiceOption>();
    for (const opt of options) {
      map.set(opt.value, opt);
    }
    return map;
  }, [options]);

  // Convert options to Combobox format (value/label pairs)
  const comboboxOptions = useMemo(
    () => options.map((opt) => ({ value: opt.value, label: opt.label })),
    [options],
  );

  // Convert selected values to Combobox format
  const selectedOptions = useMemo(
    () =>
      selected
        .map((val) => {
          const opt = optionMap.get(val);
          return opt ? { value: opt.value, label: opt.label } : null;
        })
        .filter(Boolean) as { value: string; label: string }[],
    [selected, optionMap],
  );

  const handleToggle = (option: string, isSelected: boolean) => {
    if (isSelected) {
      // Check max selections limit
      if (maxSelections && selected.length >= maxSelections) {
        return; // Don't add more
      }
      onChange([...selected, option]);
    } else {
      onChange(selected.filter((v) => v !== option));
    }
  };

  // Build description with selection limit
  const limitText = useMemo(() => {
    if (!maxSelections) {
      return undefined;
    }
    const remaining = maxSelections - selected.length;
    return remaining > 0
      ? `Velg ${remaining} til`
      : `Maks ${maxSelections} valgt`;
  }, [maxSelections, selected.length]);
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
    <UNSAFE_Combobox
      label={<QuestionPrompt question={question} />}
      hideLabel={hideLabel}
      description={description}
      options={comboboxOptions}
      selectedOptions={selectedOptions}
      onToggleSelected={handleToggle}
      isMultiSelect
      disabled={disabled}
      error={isMissing ? validationErrorMessage : undefined}
      maxSelected={maxSelections ? { limit: maxSelections } : undefined}
    />
  );
};
