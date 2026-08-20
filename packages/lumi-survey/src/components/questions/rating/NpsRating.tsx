import { BodyShort, Box, Heading, HStack, VStack } from "@navikt/ds-react";
import type React from "react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import type {
  LumiSurveyAnswerValue,
  NpsRatingQuestion,
} from "../../../core/types.js";
import { formatQuestionPrompt } from "../utils/formatQuestionPrompt.js";
import styles from "./emo.module.css";
import npsStyles from "./nps.module.css";
import { RatingErrorMessage } from "./RatingErrorMessage.js";
import "./emo.fallback.css";
import "./nps.fallback.css";

interface NpsRatingProps {
  question: NpsRatingQuestion;
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

// NPS color zones: 0-6 detractors (red), 7-8 passives (yellow), 9-10 promoters (green)
const getNpsColor = (value: number, isActive: boolean): string => {
  if (!isActive) return "var(--ax-bg-neutral-soft)";
  if (value <= 6) return "var(--ax-bg-danger-soft)";
  if (value <= 8) return "var(--ax-bg-warning-soft)";
  return "var(--ax-bg-success-soft)";
};

const getNpsBorderColor = (value: number, isActive: boolean): string => {
  if (!isActive) return "transparent";
  if (value <= 6) return "var(--ax-border-danger)";
  if (value <= 8) return "var(--ax-border-warning)";
  return "var(--ax-border-success)";
};

/**
 * NPS (Net Promoter Score) rating: 0-10 number buttons
 * Standard NPS scale with color-coded zones.
 */
export function NpsRating({
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
}: NpsRatingProps) {
  const activeState = typeof value === "number" ? value : null;
  const fallbackHeadingId = `${question.id}-heading`;
  const fallbackDescriptionId = `${question.id}-description`;
  const errorId = `${question.id}-error`;
  const describedBy =
    [
      ariaDescribedBy,
      !hideDescription && question.description
        ? fallbackDescriptionId
        : undefined,
      isMissing ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const lowLabel = question.lowLabel ?? "Lite sannsynlig";
  const highLabel = question.highLabel ?? "Svært sannsynlig";

  const handleSelect = useCallback(
    (nextValue: number) => {
      if (!disabled) {
        onChange(nextValue);
      }
    },
    [disabled, onChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentValue = activeState ?? 0;
      let nextValue: number;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextValue = Math.min(currentValue + 1, 10);
          handleSelect(nextValue);
          event.preventDefault();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextValue = Math.max(currentValue - 1, 0);
          handleSelect(nextValue);
          event.preventDefault();
          break;
      }
    },
    [activeState, handleSelect],
  );

  return (
    <VStack gap="space-8" className={className}>
      {!hidePrompt && (
        <Heading
          id={ariaLabelledBy ? undefined : fallbackHeadingId}
          level="3"
          size="xsmall"
        >
          {formatQuestionPrompt(question)}
        </Heading>
      )}
      {question.description && !hideDescription && (
        <BodyShort id={fallbackDescriptionId}>{question.description}</BodyShort>
      )}
      <Box
        as="fieldset"
        className={styles.fieldset ?? "lumi-survey-rating__fieldset"}
        aria-labelledby={
          ariaLabelledBy ?? (!hidePrompt ? fallbackHeadingId : undefined)
        }
        aria-describedby={describedBy}
        paddingBlock={fieldsetPaddingBlock ?? "space-8"}
        paddingInline={fieldsetPaddingInline ?? "space-12"}
      >
        <legend className={styles.legend ?? "lumi-survey-rating__legend"}>
          {formatQuestionPrompt(question)}
        </legend>
        <VStack gap="space-8">
          <Box
            as="div"
            role="radiogroup"
            onKeyDown={handleKeyDown}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "repeat(11, minmax(0, 1fr))",
              gap: "var(--ax-space-2)",
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 11 }, (_, value) => value).map((value) => {
              const isActive = activeState === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${value} av 10`}
                  onClick={() => handleSelect(value)}
                  disabled={disabled}
                  tabIndex={isActive || (!activeState && value === 0) ? 0 : -1}
                  className={
                    npsStyles.npsButton ?? "lumi-survey-rating__nps-button"
                  }
                  style={{
                    ["--lumi-nps-bg" as string]: getNpsColor(value, isActive),
                    ["--lumi-nps-border" as string]: getNpsBorderColor(
                      value,
                      isActive,
                    ),
                    ["--lumi-nps-hover-bg" as string]: isActive
                      ? getNpsColor(value, true)
                      : "var(--ax-bg-neutral-soft)",
                    ["--lumi-nps-hover-border" as string]: isActive
                      ? getNpsBorderColor(value, true)
                      : "var(--ax-border-neutral-subtle)",
                    ["--lumi-nps-font-weight" as string]: isActive ? 700 : 500,
                  }}
                >
                  {value}
                </button>
              );
            })}
          </Box>
          <HStack justify="space-between" style={{ width: "100%" }}>
            <BodyShort
              size="small"
              style={{ color: "var(--ax-text-neutral-subtle)" }}
            >
              {lowLabel}
            </BodyShort>
            <BodyShort
              size="small"
              style={{ color: "var(--ax-text-neutral-subtle)" }}
            >
              {highLabel}
            </BodyShort>
          </HStack>
        </VStack>
      </Box>
      <RatingErrorMessage
        id={errorId}
        isMissing={isMissing}
        message={validationErrorMessage}
        className={styles.errorMessage ?? "lumi-survey-rating__error-message"}
      />
    </VStack>
  );
}
