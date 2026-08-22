import { BodyShort, Box, Fieldset, Heading, VStack } from "@navikt/ds-react";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import type { RatingQuestion } from "../../../core/types.js";
import { formatQuestionPrompt } from "../utils/formatQuestionPrompt.js";

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
  children: ReactNode;
}

const joinIds = (...ids: Array<string | undefined>): string | undefined =>
  ids.filter(Boolean).join(" ") || undefined;

/**
 * Uses Aksel for the standard form-field semantics while rating variants keep
 * their domain-specific visual controls and ARIA radio interaction.
 *
 * The fieldset itself carries `role="radiogroup"` (an allowed role for
 * fieldset), so the accessibility tree exposes exactly one named group per
 * question. The prompt exists in one place only: as the legend. When the
 * prompt is visible it is a level 3 heading inside the legend; when an
 * external heading labels the group, the legend copy is removed from the
 * accessibility tree entirely.
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
  const headingId = `${instanceId}-heading`;
  const fallbackDescriptionId = `${instanceId}-description`;
  const legendContentId = `${instanceId}-legend`;
  const errorId = `${instanceId}-error`;
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
  const promptText = formatQuestionPrompt(question);

  // Exactly one name source for the group:
  // - visible prompt: the heading inside the legend (named via Aksel's legend
  //   wiring, since no aria-labelledby is passed)
  // - hidden prompt with an external heading: the external heading names the
  //   group; the legend copy is aria-hidden so the text is not duplicated
  // - hidden prompt without an external heading: the visually hidden legend
  //   is the only name source
  const legend = !hidePrompt ? (
    <Heading id={headingId} level="3" size="xsmall">
      {promptText}
    </Heading>
  ) : ariaLabelledBy ? (
    <span aria-hidden="true">{promptText}</span>
  ) : (
    <span id={legendContentId}>{promptText}</span>
  );

  return (
    <VStack gap="space-8" className={className}>
      <Fieldset
        className={fieldsetClassName}
        legend={legend}
        hideLegend={hidePrompt}
        error={hasError ? validationErrorMessage : undefined}
        errorId={errorId}
        disabled={disabled}
        role="radiogroup"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
      >
        {question.description && !hideDescription && (
          <BodyShort id={fallbackDescriptionId}>
            {question.description}
          </BodyShort>
        )}
        <Box
          paddingBlock={fieldsetPaddingBlock ?? "space-12"}
          paddingInline={fieldsetPaddingInline ?? "space-16"}
        >
          {children}
        </Box>
      </Fieldset>
    </VStack>
  );
}
