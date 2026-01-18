import { StarFillIcon, StarIcon } from "@navikt/aksel-icons";
import { BodyShort, Box, Heading, HStack, VStack } from "@navikt/ds-react";
import type React from "react";
import type { ComponentProps } from "react";
import { useCallback, useState } from "react";
import type {
  LumiSurveyAnswerValue,
  StarRatingQuestion,
} from "../../../core/types.js";
import styles from "./emo.module.css";
import "./emo.fallback.css";

interface StarRatingProps {
  question: StarRatingQuestion;
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
  /**
   * Controls label display behavior:
   * - 'never': No labels shown (default, no layout jump)
   * - 'always': Labels always visible below stars
   * - 'hover': Labels shown on hover/selection (causes minor layout shift)
   */
  showLabels?: "never" | "always" | "hover";
}

/** Labels for 5-star rating (fixed scale) */
const STAR_LABELS = ["Veldig dårlig", "Dårlig", "Ok", "Bra", "Veldig bra"];

/**
 * 5-star rating: ⭐⭐⭐⭐⭐
 * Fixed at 5 stars (industry standard).
 */
export function StarRating({
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
  showLabels = "never",
}: StarRatingProps) {
  const scale = 5; // Fixed 5-star scale
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const activeState = typeof value === "number" ? value : null;
  const displayValue = hoverValue ?? activeState;

  const fallbackHeadingId = `${question.id}-heading`;
  const fallbackDescriptionId = `${question.id}-description`;
  const errorId = `${question.id}-error`;

  const labels = question.labels
    ? question.labels.reduce<Record<number, string>>((acc, label) => {
        acc[label.value] = label.label;
        return acc;
      }, {})
    : STAR_LABELS.reduce<Record<number, string>>((acc, label, index) => {
        acc[index + 1] = label;
        return acc;
      }, {});

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
      const currentIndex = activeState ? activeState - 1 : 0;
      let nextIndex: number;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = Math.min(currentIndex + 1, scale - 1);
          handleSelect(nextIndex + 1);
          event.preventDefault();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = Math.max(currentIndex - 1, 0);
          handleSelect(nextIndex + 1);
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
          {question.prompt}
        </Heading>
      )}
      {question.description && !hideDescription && (
        <BodyShort id={ariaDescribedBy ? undefined : fallbackDescriptionId}>
          {question.description}
        </BodyShort>
      )}
      <Box
        as="fieldset"
        className={styles.fieldset ?? "lumi-survey-rating__fieldset"}
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
        <legend className={styles.legend ?? "lumi-survey-rating__legend"}>
          {question.prompt}
        </legend>
        <VStack gap="space-4" align="center">
          <HStack
            gap="space-2"
            justify="space-between"
            align="center"
            wrap={false}
            role="radiogroup"
            onKeyDown={handleKeyDown}
            style={{ width: "100%", flexWrap: "nowrap" }}
          >
            {Array.from({ length: scale }, (_, index) => {
              const starValue = index + 1;
              const isFilled =
                displayValue !== null && starValue <= displayValue;
              const isActive = activeState === starValue;
              const label = labels[starValue] ?? String(starValue);

              return (
                <button
                  key={starValue}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${starValue} av ${scale} stjerner. ${label}`}
                  onClick={() => handleSelect(starValue)}
                  onMouseEnter={() => !disabled && setHoverValue(starValue)}
                  onMouseLeave={() => setHoverValue(null)}
                  onFocus={() => !disabled && setHoverValue(starValue)}
                  onBlur={() => setHoverValue(null)}
                  disabled={disabled}
                  tabIndex={
                    isActive || (!activeState && starValue === 1) ? 0 : -1
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding:
                      scale <= 5 ? "var(--ax-space-8)" : "var(--ax-space-6)",
                    border: "none",
                    borderRadius: "var(--ax-radius-4)",
                    background: "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    transition: "transform 0.1s ease",
                    transform:
                      hoverValue === starValue ? "scale(1.2)" : "scale(1)",
                    flex: "1 1 0",
                    minWidth: 0,
                  }}
                >
                  {isFilled ? (
                    <StarFillIcon
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        color: "var(--ax-text-warning)",
                      }}
                    />
                  ) : (
                    <StarIcon
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        color: "var(--ax-text-neutral-subtle)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </HStack>
          {/* Label display based on showLabels prop */}
          {showLabels === "always" && (
            <BodyShort
              size="small"
              style={{
                color: "var(--ax-text-neutral-subtle)",
                minHeight: "1.5rem",
                textAlign: "center",
              }}
            >
              {activeState
                ? (labels[activeState] ?? `${activeState} av ${scale}`)
                : `Velg 1-${scale}`}
            </BodyShort>
          )}
          {showLabels === "hover" && displayValue && (
            <BodyShort
              size="small"
              style={{
                color: "var(--ax-text-neutral-subtle)",
                minHeight: "1.5rem",
                textAlign: "center",
              }}
            >
              {labels[displayValue] ?? `${displayValue} av ${scale}`}
            </BodyShort>
          )}
        </VStack>
      </Box>
      {isMissing && (
        <BodyShort
          id={errorId}
          className={styles.errorMessage ?? "lumi-survey-rating__error-message"}
          role="alert"
        >
          {validationErrorMessage}
        </BodyShort>
      )}
    </VStack>
  );
}
