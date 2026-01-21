import { UNSAFE_Combobox } from "@navikt/ds-react";
import { useMemo } from "react";
import type {
  ChoiceOption,
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../core/types.js";
import { formatQuestionPrompt } from "../utils/formatQuestionPrompt.js";
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
  const description = useMemo(() => {
    const parts: string[] = [];
    if (question.description) {
      parts.push(question.description);
    }
    if (maxSelections) {
      const remaining = maxSelections - selected.length;
      if (remaining > 0) {
        parts.push(`Velg ${remaining} til`);
      } else {
        parts.push(`Maks ${maxSelections} valgt`);
      }
    }
    return parts.join(" • ");
  }, [question.description, maxSelections, selected.length]);

  return (
    <UNSAFE_Combobox
      label={formatQuestionPrompt(question)}
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
