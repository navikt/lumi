import { UNSAFE_Combobox } from "@navikt/ds-react";
import { useMemo } from "react";
import type {
  ChoiceQuestion,
  LumiSurveyAnswerValue,
} from "../../../core/types.js";
import { useSurveyFieldIds } from "../../shared/surveyFieldId.js";
import { useFieldFormOwner } from "../../shared/surveyFormOwner.js";
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
  const fieldIds = useSurveyFieldIds(question.id);
  const formOwner = useFieldFormOwner();
  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const maxSelections = question.maxSelections;

  // Aksel builds the DOM id of each option from the value it is given: lower
  // case, with spaces as hyphens. Two values from a document can then get the
  // same id, such as `A B` and `a-b`, and the keyboard picks the wrong one.
  // Aksel is given the position of the option as its value, and the answer
  // is mapped back to the value in the document.
  const comboboxOptions = useMemo(
    () =>
      options.map((opt, index) => ({ value: String(index), label: opt.label })),
    [options],
  );

  const selectedOptions = useMemo(
    () =>
      selected.flatMap((val) => {
        const index = options.findIndex((opt) => opt.value === val);
        return index === -1 ? [] : [comboboxOptions[index]];
      }),
    [comboboxOptions, options, selected],
  );

  const handleToggle = (position: string, isSelected: boolean) => {
    const option = options[Number(position)]?.value;
    if (option === undefined) {
      return;
    }
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
      {...formOwner}
      // Aksel adds to this id to name the list and its options. The part is
      // the field's own, so none of those ids can be the id of another field.
      {...(fieldIds && { id: fieldIds("combobox") })}
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
