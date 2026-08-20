import { BodyShort, Box, Fieldset, Heading, VStack } from "@navikt/ds-react";
import type { AriaAttributes, ComponentProps, ReactNode } from "react";
import { useId } from "react";
import type { RatingQuestion } from "../../../core/types.js";
import { formatQuestionPrompt } from "../utils/formatQuestionPrompt.js";

export interface RatingGroupAccessibilityProps {
  role: "radiogroup";
  "aria-labelledby": string;
  "aria-describedby": AriaAttributes["aria-describedby"];
  "aria-invalid": AriaAttributes["aria-invalid"];
}

interface RatingFieldsetProps {
  question: RatingQuestion;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  className?: string;
  fieldsetClassName?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  hidePrompt?: boolean;
  hideDescription?: boolean;
  fieldsetPaddingBlock?: ComponentProps<typeof Box>["paddingBlock"];
  fieldsetPaddingInline?: ComponentProps<typeof Box>["paddingInline"];
  children: (groupProps: RatingGroupAccessibilityProps) => ReactNode;
}

const joinIds = (...ids: Array<string | undefined>): string | undefined =>
  ids.filter(Boolean).join(" ") || undefined;

/**
 * Uses Aksel for the standard form-field semantics while rating variants keep
 * their domain-specific visual controls and ARIA radio interaction.
 */
export function RatingFieldset({
  question,
  validationErrorMessage,
  isMissing,
  disabled,
  className,
  fieldsetClassName,
  ariaLabelledBy,
  ariaDescribedBy,
  hidePrompt = false,
  hideDescription = false,
  fieldsetPaddingBlock,
  fieldsetPaddingInline,
  children,
}: RatingFieldsetProps) {
  const instanceId = useId();
  const fallbackHeadingId = `${instanceId}-heading`;
  const fallbackDescriptionId = `${instanceId}-description`;
  const legendContentId = `${instanceId}-legend`;
  const errorId = `${instanceId}-error`;
  const headingId =
    ariaLabelledBy ?? (!hidePrompt ? fallbackHeadingId : legendContentId);
  const descriptionId =
    !hideDescription && question.description
      ? fallbackDescriptionId
      : undefined;
  const hasError = isMissing && !disabled;
  const describedBy = joinIds(
    ariaDescribedBy,
    descriptionId,
    hasError ? errorId : undefined,
  );

  const groupProps: RatingGroupAccessibilityProps = {
    role: "radiogroup",
    "aria-labelledby": headingId,
    "aria-describedby": describedBy,
    "aria-invalid": hasError || undefined,
  };

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
      <Fieldset
        className={fieldsetClassName}
        legend={
          <span id={legendContentId}>{formatQuestionPrompt(question)}</span>
        }
        hideLegend
        error={hasError ? validationErrorMessage : undefined}
        errorId={errorId}
        disabled={disabled}
        aria-labelledby={headingId}
      >
        <Box
          paddingBlock={fieldsetPaddingBlock ?? "space-12"}
          paddingInline={fieldsetPaddingInline ?? "space-16"}
        >
          {children(groupProps)}
        </Box>
      </Fieldset>
    </VStack>
  );
}
