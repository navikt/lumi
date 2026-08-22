import { ThumbDownIcon, ThumbUpIcon } from "@navikt/aksel-icons";
import { Box, Button, HStack } from "@navikt/ds-react";
import type { ComponentProps } from "react";
import type {
  LumiSurveyAnswerValue,
  ThumbsRatingQuestion,
} from "../../../core/types.js";
import { RatingFieldset } from "./RatingFieldset.js";
import { useRatingRadioGroup } from "./useRatingRadioGroup.js";
import "./emo.fallback.css";

const THUMBS_VALUES = [1, 2] as const;

interface ThumbsRatingProps {
  question: ThumbsRatingQuestion;
  value: LumiSurveyAnswerValue | undefined;
  onChange: (value: number | null) => void;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  className?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  hidePrompt?: boolean;
  hideDescription?: boolean;
  fieldsetPaddingBlock?: ComponentProps<typeof Box>["paddingBlock"];
  fieldsetPaddingInline?: ComponentProps<typeof Box>["paddingInline"];
}

/**
 * 2-point thumbs rating: 👎 👍
 * Modern inline style inspired by ChatGPT/Claude feedback.
 * Clean, minimal, with subtle hover effects.
 */
export function ThumbsRating({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  className,
  ariaLabelledBy,
  ariaDescribedBy,
  hidePrompt = false,
  hideDescription = false,
  fieldsetPaddingBlock,
  fieldsetPaddingInline,
}: ThumbsRatingProps) {
  const activeState = typeof value === "number" ? value : null;
  const handleSelect = (nextValue: number) => {
    if (!disabled) {
      onChange(nextValue);
    }
  };
  const radioGroup = useRatingRadioGroup({
    values: THUMBS_VALUES,
    value: activeState,
    onChange: handleSelect,
    disabled,
  });

  return (
    <RatingFieldset
      question={question}
      validationErrorMessage={validationErrorMessage}
      isMissing={isMissing}
      disabled={disabled}
      className={className}
      fieldsetClassName="lumi-survey-rating__fieldset"
      ariaLabelledBy={ariaLabelledBy}
      ariaDescribedBy={ariaDescribedBy}
      hidePrompt={hidePrompt}
      hideDescription={hideDescription}
      fieldsetPaddingBlock={fieldsetPaddingBlock}
      fieldsetPaddingInline={fieldsetPaddingInline}
    >
      <HStack
        gap="space-8"
        justify="center"
        align="center"
        onKeyDown={radioGroup.onKeyDown}
        wrap
      >
        <Box style={{ flex: "1 1 0" }}>
          <Button
            type="button"
            role="radio"
            aria-checked={activeState === 1}
            aria-label="Nei, tommel ned"
            onClick={() => handleSelect(1)}
            disabled={disabled}
            tabIndex={radioGroup.getTabIndex(1)}
            data-color={activeState === 1 ? "danger" : undefined}
            variant={activeState === 1 ? "primary" : "secondary"}
            icon={<ThumbDownIcon fontSize="1.75rem" aria-hidden />}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Nei
          </Button>
        </Box>

        <Box style={{ flex: "1 1 0" }}>
          <Button
            type="button"
            role="radio"
            aria-checked={activeState === 2}
            aria-label="Ja, tommel opp"
            onClick={() => handleSelect(2)}
            disabled={disabled}
            tabIndex={radioGroup.getTabIndex(2)}
            variant={activeState === 2 ? "primary" : "secondary"}
            icon={<ThumbUpIcon fontSize="1.75rem" aria-hidden />}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Ja
          </Button>
        </Box>
      </HStack>
    </RatingFieldset>
  );
}
