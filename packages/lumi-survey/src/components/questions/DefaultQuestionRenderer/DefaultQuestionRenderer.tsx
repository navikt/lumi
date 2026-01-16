import type {
  ChoiceQuestion,
  RatingQuestion,
  TextQuestion,
} from "../../../core/types.js";
import type { LumiSurveyDefaultQuestionProps } from "../../../types.js";
import {
  ComboboxMultiChoiceField,
  MultiChoiceField,
  SingleChoiceField,
} from "../choice/index.js";
import { RatingQuestionField } from "../rating/index.js";
import { TextQuestionField } from "../text/index.js";

export const DefaultQuestionRenderer = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  hideLabel,
}: LumiSurveyDefaultQuestionProps) => {
  switch (question.type) {
    case "rating": {
      const ratingQuestion: RatingQuestion = question;
      return (
        <RatingQuestionField
          question={ratingQuestion}
          value={value}
          onChange={(next: number | null) => onChange(next)}
          validationErrorMessage={validationErrorMessage}
          isMissing={isMissing}
          disabled={disabled}
          hidePrompt={hideLabel}
        />
      );
    }
    case "text": {
      const textQuestion: TextQuestion = question;
      return (
        <TextQuestionField
          question={textQuestion}
          value={value}
          onChange={(next: string) => onChange(next)}
          validationErrorMessage={validationErrorMessage}
          isMissing={isMissing}
          disabled={disabled}
          hideLabel={hideLabel}
        />
      );
    }
    case "singleChoice": {
      const choiceQuestion: ChoiceQuestion & { type: "singleChoice" } =
        question;
      return (
        <SingleChoiceField
          question={choiceQuestion}
          value={value}
          onChange={(next: string | null) => onChange(next)}
          validationErrorMessage={validationErrorMessage}
          isMissing={isMissing}
          disabled={disabled}
          hideLabel={hideLabel}
        />
      );
    }
    case "multiChoice": {
      const choiceQuestion: ChoiceQuestion & { type: "multiChoice" } = question;

      // Use Combobox variant for better UX with many options (10+)
      if (choiceQuestion.variant === "combobox") {
        return (
          <ComboboxMultiChoiceField
            question={choiceQuestion}
            value={value}
            onChange={(next: string[]) => onChange(next)}
            validationErrorMessage={validationErrorMessage}
            isMissing={isMissing}
            disabled={disabled}
            hideLabel={hideLabel}
          />
        );
      }

      // Default: checkbox list
      return (
        <MultiChoiceField
          question={choiceQuestion}
          value={value}
          onChange={(next: string[]) => onChange(next)}
          validationErrorMessage={validationErrorMessage}
          isMissing={isMissing}
          disabled={disabled}
          hideLabel={hideLabel}
        />
      );
    }
    default:
      return null;
  }
};
