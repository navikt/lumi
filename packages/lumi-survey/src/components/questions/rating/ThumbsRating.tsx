import { ThumbDownIcon, ThumbUpIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Button,
  HStack,
  Heading,
  VStack,
} from "@navikt/ds-react";
import type { BoxNewProps } from "@navikt/ds-react/Box";
import { useCallback } from "react";
import type {
  LumiSurveyAnswerValue,
  ThumbsRatingQuestion,
} from "../../../core/types.js";
import styles from "./emo.module.css";
import "./emo.fallback.css";

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
  fieldsetPaddingBlock?: BoxNewProps["paddingBlock"];
  fieldsetPaddingInline?: BoxNewProps["paddingInline"];
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
  const fallbackHeadingId = `${question.id}-heading`;
  const fallbackDescriptionId = `${question.id}-description`;
  const errorId = `${question.id}-error`;

  const handleSelect = useCallback(
    (nextValue: number) => {
      if (!disabled) {
        onChange(nextValue);
      }
    },
    [disabled, onChange],
  );

  return (
    <VStack gap="space-8" className={className}>
      {!hidePrompt && (
        <Heading
          id={ariaLabelledBy ? undefined : fallbackHeadingId}
          level="3"
          size="xsmall"
        >
          {question.prompt}
        </Heading>
      )}
      {question.description && !hideDescription && (
        <BodyShort id={ariaDescribedBy ? undefined : fallbackDescriptionId}>
          {question.description}
        </BodyShort>
      )}
      <Box.New
        as="fieldset"
        className={styles.fieldset ?? "flexjar-rating__fieldset"}
        aria-labelledby={
          ariaLabelledBy ?? (!hidePrompt ? fallbackHeadingId : undefined)
        }
        aria-describedby={
          ariaDescribedBy ??
          (!hideDescription && question.description
            ? fallbackDescriptionId
            : undefined)
        }
        paddingBlock={fieldsetPaddingBlock ?? "space-12"}
        paddingInline={fieldsetPaddingInline ?? "space-16"}
      >
        <legend className={styles.legend ?? "flexjar-rating__legend"}>
          {question.prompt}
        </legend>
        <HStack
          gap="space-8"
          justify="center"
          align="center"
          role="radiogroup"
          wrap
        >
          <Box.New style={{ flex: "1 1 0" }}>
            <Button
              type="button"
              role="radio"
              aria-checked={activeState === 1}
              aria-label="Tommel ned"
              onClick={() => handleSelect(1)}
              disabled={disabled}
              tabIndex={activeState === 1 || !activeState ? 0 : -1}
              variant={activeState === 1 ? "danger" : "secondary"}
              icon={<ThumbDownIcon fontSize="1.75rem" aria-hidden />}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Nei
            </Button>
          </Box.New>

          <Box.New style={{ flex: "1 1 0" }}>
            <Button
              type="button"
              role="radio"
              aria-checked={activeState === 2}
              aria-label="Tommel opp"
              onClick={() => handleSelect(2)}
              disabled={disabled}
              tabIndex={activeState === 2 ? 0 : -1}
              variant={activeState === 2 ? "primary" : "secondary"}
              icon={<ThumbUpIcon fontSize="1.75rem" aria-hidden />}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Ja
            </Button>
          </Box.New>
        </HStack>
      </Box.New>
      {isMissing && (
        <BodyShort
          id={errorId}
          className={styles.errorMessage ?? "flexjar-rating__error-message"}
          role="alert"
        >
          {validationErrorMessage}
        </BodyShort>
      )}
    </VStack>
  );
}
