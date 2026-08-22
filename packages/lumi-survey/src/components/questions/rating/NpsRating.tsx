import { BodyShort, Box, HStack, VStack } from "@navikt/ds-react";
import type { ComponentProps } from "react";
import { useId } from "react";
import type {
  LumiSurveyAnswerValue,
  NpsRatingQuestion,
} from "../../../core/types.js";
import { RatingFieldset } from "./RatingFieldset.js";
import { useRatingRadioGroup } from "./useRatingRadioGroup.js";
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

const NPS_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
  const endpointId = useId();
  const lowLabelId = `${endpointId}-low`;
  const highLabelId = `${endpointId}-high`;
  const groupDescriptionIds = [ariaDescribedBy, lowLabelId, highLabelId]
    .filter(Boolean)
    .join(" ");
  const activeState = typeof value === "number" ? value : null;
  const lowLabel = question.lowLabel ?? "Lite sannsynlig";
  const highLabel = question.highLabel ?? "Svært sannsynlig";

  const handleSelect = (nextValue: number) => {
    if (!disabled) {
      onChange(nextValue);
    }
  };
  const radioGroup = useRatingRadioGroup({
    values: NPS_VALUES,
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
      ariaDescribedBy={groupDescriptionIds}
      hidePrompt={hidePrompt}
      hideDescription={hideDescription}
      fieldsetPaddingBlock={fieldsetPaddingBlock ?? "space-8"}
      fieldsetPaddingInline={fieldsetPaddingInline ?? "space-12"}
    >
      {(groupProps) => (
        <VStack gap="space-8">
          <Box
            {...groupProps}
            as="div"
            onKeyDown={radioGroup.onKeyDown}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "repeat(11, minmax(0, 1fr))",
              gap: "var(--ax-space-2)",
              overflow: "hidden",
            }}
          >
            {NPS_VALUES.map((value) => {
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
                  tabIndex={radioGroup.getTabIndex(value)}
                  className="lumi-survey-rating__nps-button"
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
              id={lowLabelId}
              size="small"
              style={{ color: "var(--ax-text-neutral-subtle)" }}
            >
              {lowLabel}
            </BodyShort>
            <BodyShort
              id={highLabelId}
              size="small"
              style={{ color: "var(--ax-text-neutral-subtle)" }}
            >
              {highLabel}
            </BodyShort>
          </HStack>
        </VStack>
      )}
    </RatingFieldset>
  );
}
