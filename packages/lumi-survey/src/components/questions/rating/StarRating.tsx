import { StarFillIcon, StarIcon } from "@navikt/aksel-icons";
import { BodyShort, type Box, HStack, VStack } from "@navikt/ds-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import type {
  LumiSurveyAnswerValue,
  StarRatingQuestion,
} from "../../../core/types.js";
import styles from "./emo.module.css";
import { RatingFieldset } from "./RatingFieldset.js";
import { useRatingRadioGroup } from "./useRatingRadioGroup.js";
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
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

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

  const labels = question.labels
    ? question.labels.reduce<Record<number, string>>((acc, label) => {
        acc[label.value] = label.label;
        return acc;
      }, {})
    : STAR_LABELS.reduce<Record<number, string>>((acc, label, index) => {
        acc[index + 1] = label;
        return acc;
      }, {});

  const handleSelect = (nextValue: number) => {
    if (!disabled) {
      onChange(nextValue);
    }
  };
  const radioGroup = useRatingRadioGroup({
    values: STAR_VALUES,
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
      fieldsetClassName={styles.fieldset ?? "lumi-survey-rating__fieldset"}
      ariaLabelledBy={ariaLabelledBy}
      ariaDescribedBy={ariaDescribedBy}
      hidePrompt={hidePrompt}
      hideDescription={hideDescription}
      fieldsetPaddingBlock={fieldsetPaddingBlock}
      fieldsetPaddingInline={fieldsetPaddingInline}
    >
      {(groupProps) => (
        <VStack gap="space-4" align="center">
          <HStack
            {...groupProps}
            gap="space-2"
            justify="space-between"
            align="center"
            wrap={false}
            onKeyDown={radioGroup.onKeyDown}
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
                  tabIndex={radioGroup.getTabIndex(starValue)}
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
                      aria-hidden
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        color: "var(--ax-text-warning)",
                      }}
                    />
                  ) : (
                    <StarIcon
                      aria-hidden
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
      )}
    </RatingFieldset>
  );
}
