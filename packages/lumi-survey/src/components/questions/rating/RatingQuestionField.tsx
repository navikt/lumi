import { type Box, HStack } from "@navikt/ds-react";
import type { ComponentProps, ReactElement } from "react";
import type {
  EmojiRatingQuestion,
  LumiSurveyAnswerValue,
  RatingQuestion,
} from "../../../core/types.js";
import { EmojiButton } from "./EmojiButton.js";
import styles from "./emo.module.css";
import { Glad, Lei, Noytral, Sinna, VeldigGlad } from "./emojies.js";
import { NpsRating } from "./NpsRating.js";
import { RatingFieldset } from "./RatingFieldset.js";
import { StarRating } from "./StarRating.js";
import { ThumbsRating } from "./ThumbsRating.js";
import { useRatingRadioGroup } from "./useRatingRadioGroup.js";
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
  /** Provide an additional external aria-describedby id. */
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
  fieldsetPaddingBlock?: ComponentProps<typeof Box>["paddingBlock"];
  /** Override the paddingInline token on the underlying fieldset */
  fieldsetPaddingInline?: ComponentProps<typeof Box>["paddingInline"];
}

interface EmojiVariant {
  className: string;
  activeFill: string;
  activeColor: string;
  fallbackLabel: string;
  Icon: (props: { fill?: string }) => ReactElement;
}

const CLASS_NAMES = {
  row: styles.emojiRow ?? "lumi-survey-rating__row",
  fieldset: styles.fieldset ?? "lumi-survey-rating__fieldset",
  button: styles.emobutton ?? "lumi-survey-rating__emoji-button",
  active: styles.active ?? "lumi-survey-rating__emoji-button--active",
  variants: {
    sinna: styles.sinnaButton ?? "lumi-survey-rating__emoji-button--sinna",
    lei: styles.leiButton ?? "lumi-survey-rating__emoji-button--lei",
    noytral:
      styles.noytralButton ?? "lumi-survey-rating__emoji-button--noytral",
    glad: styles.gladButton ?? "lumi-survey-rating__emoji-button--glad",
    veldigGlad:
      styles.veldigGladButton ??
      "lumi-survey-rating__emoji-button--veldig-glad",
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
    activeColor: "var(--ax-text-success)",
    fallbackLabel: "Veldig bra",
    Icon: VeldigGlad,
  },
];

const EMOJI_VALUES = [1, 2, 3, 4, 5] as const;

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

const EmojiRating = ({
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
  const options = EMOJI_VALUES;
  const activeState = typeof value === "number" ? value : null;

  const handleSelect = (nextValue: number) => {
    if (!disabled) {
      onChange(nextValue);
    }
  };
  const radioGroup = useRatingRadioGroup({
    values: options,
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
      fieldsetClassName={joinClassNames(
        CLASS_NAMES.fieldset,
        fieldsetClassName,
      )}
      ariaLabelledBy={ariaLabelledBy}
      ariaDescribedBy={ariaDescribedBy}
      hidePrompt={hidePrompt}
      hideDescription={hideDescription}
      fieldsetPaddingBlock={fieldsetPaddingBlock}
      fieldsetPaddingInline={fieldsetPaddingInline}
    >
      {(groupProps) => (
        <HStack
          {...groupProps}
          gap="space-16"
          justify="start"
          align="center"
          wrap={wrap}
          className={joinClassNames(CLASS_NAMES.row, rowClassName)}
          onKeyDown={radioGroup.onKeyDown}
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
                tabIndex={radioGroup.getTabIndex(option)}
              >
                <Icon fill={isActive ? variant.activeFill : undefined} />
              </EmojiButton>
            );
          })}
        </HStack>
      )}
    </RatingFieldset>
  );
};

export const RatingQuestionField = (props: RatingQuestionFieldProps) => {
  const { question } = props;
  const commonProps = {
    value: props.value,
    onChange: props.onChange,
    validationErrorMessage: props.validationErrorMessage,
    isMissing: props.isMissing,
    disabled: props.disabled,
    className: props.className,
    ariaLabelledBy: props.ariaLabelledBy,
    ariaDescribedBy: props.ariaDescribedBy,
    hidePrompt: props.hidePrompt,
    hideDescription: props.hideDescription,
    fieldsetPaddingBlock: props.fieldsetPaddingBlock,
    fieldsetPaddingInline: props.fieldsetPaddingInline,
  };

  switch (question.variant) {
    case "thumbs":
      return <ThumbsRating {...commonProps} question={question} />;
    case "stars":
      return <StarRating {...commonProps} question={question} />;
    case "nps":
      return <NpsRating {...commonProps} question={question} />;
    default:
      return <EmojiRating {...props} />;
  }
};
