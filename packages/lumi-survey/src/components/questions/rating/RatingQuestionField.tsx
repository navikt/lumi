import { BodyShort, Box, HStack, Heading, VStack } from "@navikt/ds-react";
import type { BoxNewProps } from "@navikt/ds-react/Box";
import type React from "react";
import type { ReactElement } from "react";
import type {
  EmojiRatingQuestion,
  LumiSurveyAnswerValue,
  RatingQuestion,
} from "../../../core/types.js";
import { EmojiButton } from "./EmojiButton.js";
import { NpsRating } from "./NpsRating.js";
import { StarRating } from "./StarRating.js";
import { ThumbsRating } from "./ThumbsRating.js";
import styles from "./emo.module.css";
import { Glad, Lei, Noytral, Sinna, VeldigGlad } from "./emojies.js";
import "./emo.fallback.css";

interface RatingQuestionFieldProps {
  question: RatingQuestion;
  value: LumiSurveyAnswerValue | undefined;
  onChange: (value: number | null) => void;
  validationErrorMessage: string;
  isMissing: boolean;
  disabled: boolean;
  /** Optional class applied to the outer wrapper */
  className?: string;
  /** Extra class added to the fieldset element */
  fieldsetClassName?: string;
  /** Extra class added to the emoji button row */
  rowClassName?: string;
  /** Extra class appended to each emoji button */
  buttonClassName?: string;
  /** Provide external aria-labelledby id; skip internal heading when set */
  ariaLabelledBy?: string;
  /** Provide external aria-describedby id; skip internal description when set */
  ariaDescribedBy?: string;
  /** Hide the prompt heading inside the component */
  hidePrompt?: boolean;
  /** Hide the description text inside the component */
  hideDescription?: boolean;
  /** Hide the visible emoji labels while keeping them in aria attributes */
  hideValueLabels?: boolean;
  /** Control whether the emoji row should wrap to multiple lines */
  wrap?: boolean;
  /** Override the paddingBlock token on the underlying fieldset */
  fieldsetPaddingBlock?: BoxNewProps["paddingBlock"];
  /** Override the paddingInline token on the underlying fieldset */
  fieldsetPaddingInline?: BoxNewProps["paddingInline"];
}

interface EmojiVariant {
  className: string;
  activeFill: string;
  activeColor: string;
  fallbackLabel: string;
  Icon: (props: { fill?: string }) => ReactElement;
}

const CLASS_NAMES = {
  row: styles.emojiRow ?? "flexjar-rating__row",
  fieldset: styles.fieldset ?? "flexjar-rating__fieldset",
  legend: styles.legend ?? "flexjar-rating__legend",
  button: styles.emobutton ?? "flexjar-rating__emoji-button",
  active: styles.active ?? "flexjar-rating__emoji-button--active",
  error: styles.errorMessage ?? "flexjar-rating__error-message",
  variants: {
    sinna: styles.sinnaButton ?? "flexjar-rating__emoji-button--sinna",
    lei: styles.leiButton ?? "flexjar-rating__emoji-button--lei",
    noytral: styles.noytralButton ?? "flexjar-rating__emoji-button--noytral",
    glad: styles.gladButton ?? "flexjar-rating__emoji-button--glad",
    veldigGlad:
      styles.veldigGladButton ?? "flexjar-rating__emoji-button--veldig-glad",
  },
} as const;

const VARIANTS: EmojiVariant[] = [
  {
    className: CLASS_NAMES.variants.sinna,
    activeFill: "var(--ax-bg-danger-soft)",
    activeColor: "var(--ax-text-danger-subtle)",
    fallbackLabel: "Veldig dårlig",
    Icon: Sinna,
  },
  {
    className: CLASS_NAMES.variants.lei,
    activeFill: "var(--ax-bg-warning-soft)",
    activeColor: "var(--ax-text-warning-decoration)",
    fallbackLabel: "Dårlig",
    Icon: Lei,
  },
  {
    className: CLASS_NAMES.variants.noytral,
    activeFill: "var(--ax-bg-info-soft)",
    activeColor: "var(--ax-text-info-decoration)",
    fallbackLabel: "Nøytral",
    Icon: Noytral,
  },
  {
    className: CLASS_NAMES.variants.glad,
    activeFill: "var(--ax-bg-success-soft)",
    activeColor: "var(--ax-text-success-decoration)",
    fallbackLabel: "Bra",
    Icon: Glad,
  },
  {
    className: CLASS_NAMES.variants.veldigGlad,
    activeFill: "var(--ax-bg-success-moderate)",
    activeColor: "var(--a-text-success)",
    fallbackLabel: "Veldig bra",
    Icon: VeldigGlad,
  },
];

const joinClassNames = (
  ...classNames: Array<string | false | undefined>
): string => classNames.filter(Boolean).join(" ");

const resolveVariant = (index: number): EmojiVariant =>
  VARIANTS[Math.min(index, VARIANTS.length - 1)];

const resolveLabel = (question: RatingQuestion, value: number): string => {
  const override = question.labels?.find((label) => label.value === value);
  if (override) {
    return override.label;
  }

  const variant = resolveVariant(value - 1);
  return variant.fallbackLabel ?? String(value);
};

export const RatingQuestionField = ({
  question,
  value,
  onChange,
  validationErrorMessage,
  isMissing,
  disabled,
  className,
  fieldsetClassName,
  rowClassName,
  buttonClassName,
  ariaLabelledBy,
  ariaDescribedBy,
  hidePrompt = false,
  hideDescription = false,
  hideValueLabels = false,
  wrap = true,
  fieldsetPaddingBlock,
  fieldsetPaddingInline,
}: RatingQuestionFieldProps) => {
  // Props common to all rating types
  const commonProps = {
    value,
    onChange,
    validationErrorMessage,
    isMissing,
    disabled,
    className,
    ariaLabelledBy,
    ariaDescribedBy,
    hidePrompt,
    hideDescription,
    fieldsetPaddingBlock,
    fieldsetPaddingInline,
  };

  // Dispatch to specialized components based on variant
  switch (question.variant) {
    case "thumbs":
      return <ThumbsRating {...commonProps} question={question} />;

    case "stars":
      return <StarRating {...commonProps} question={question} />;

    case "nps":
      return <NpsRating {...commonProps} question={question} />;

    default:
      // Continue with emoji implementation below
      break;
  }

  // ============================================
  // Emoji rating implementation (5-point: 😡 🙁 😐 😀 😍)
  // ============================================
  const scale = 5; // Emoji is always 5-point
  const options = Array.from({ length: scale }, (_, index) => index + 1);
  const activeState = typeof value === "number" ? value : null;

  const fallbackHeadingId = `${question.id}-heading`;
  const fallbackDescriptionId = `${question.id}-description`;
  const headingId =
    ariaLabelledBy ?? (!hidePrompt ? fallbackHeadingId : undefined);
  const descriptionId =
    ariaDescribedBy ??
    (!hideDescription && question.description
      ? fallbackDescriptionId
      : undefined);
  const errorId = `${question.id}-error`;
  const describedBy =
    [descriptionId, isMissing ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  const handleSelect = (nextValue: number) => {
    if (!disabled) {
      onChange(nextValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const currentIndex = activeState ? activeState - 1 : 0;
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % options.length;
        handleSelect(options[nextIndex]);
        event.preventDefault();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + options.length) % options.length;
        handleSelect(options[nextIndex]);
        event.preventDefault();
        break;
    }
  };

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
        className={joinClassNames(CLASS_NAMES.fieldset, fieldsetClassName)}
        aria-labelledby={headingId}
        aria-describedby={describedBy}
        paddingBlock={fieldsetPaddingBlock ?? "space-12"}
        paddingInline={fieldsetPaddingInline ?? "space-16"}
      >
        <legend className={CLASS_NAMES.legend}>{question.prompt}</legend>
        <HStack
          gap="space-16"
          justify="start"
          align="center"
          wrap={wrap}
          className={joinClassNames(CLASS_NAMES.row, rowClassName)}
          role="radiogroup"
          aria-labelledby={headingId}
          onKeyDown={handleKeyDown}
        >
          {options.map((option, index) => {
            const variant = resolveVariant(index);
            const labelText = resolveLabel(
              question as EmojiRatingQuestion,
              option,
            );
            const isActive = activeState === option;
            const buttonClass = joinClassNames(
              CLASS_NAMES.button,
              variant.className,
              isActive ? CLASS_NAMES.active : undefined,
              buttonClassName,
            );
            const buttonStyle = isActive
              ? { color: variant.activeColor }
              : undefined;
            const Icon = variant.Icon;
            const ariaLabel = `${option}. ${labelText}`;

            return (
              <EmojiButton
                key={option}
                feedback={option}
                activeState={activeState}
                setActiveState={handleSelect}
                className={buttonClass}
                style={buttonStyle}
                text={labelText}
                renderText={!hideValueLabels}
                ariaLabel={ariaLabel}
                disabled={disabled}
              >
                <Icon fill={isActive ? variant.activeFill : undefined} />
              </EmojiButton>
            );
          })}
        </HStack>
      </Box.New>
      {isMissing && (
        <BodyShort id={errorId} className={CLASS_NAMES.error} role="alert">
          {validationErrorMessage}
        </BodyShort>
      )}
    </VStack>
  );
};
