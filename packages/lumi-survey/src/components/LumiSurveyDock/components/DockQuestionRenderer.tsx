import React from "react";
import type { RatingQuestion } from "../../../core";
import type { LumiSurveyRenderQuestionProps } from "../../../types.js";
import { DefaultQuestionRenderer, RatingQuestionField } from "../../questions";
import { CLASS_NAMES } from "../classNames.js";

interface DockQuestionRendererProps extends LumiSurveyRenderQuestionProps {
  promptQuestionId?: string;
  promptHeadingId: string;
  promptDescriptionId?: string;
  promptDescriptionIsQuestionDescription?: boolean;
  validationErrorMessage: string;
  textTooLongErrorMessage: (maxLength: number) => string;
}

export const DockQuestionRenderer = React.memo(
  ({
    question,
    value,
    onChange,
    isMissing,
    disabled,
    hideLabel,
    promptQuestionId,
    promptHeadingId,
    promptDescriptionId,
    promptDescriptionIsQuestionDescription = true,
    validationErrorMessage,
    textTooLongErrorMessage,
  }: DockQuestionRendererProps) => {
    if (question.type === "rating") {
      const rating = question as RatingQuestion;
      const isPromptQuestion = question.id === promptQuestionId;
      const shouldHideInternalHeading = Boolean(hideLabel) || isPromptQuestion;

      return (
        <div className={CLASS_NAMES.ratingSection}>
          <div className={CLASS_NAMES.ratingField}>
            <RatingQuestionField
              question={rating}
              value={value}
              onChange={onChange}
              validationErrorMessage={validationErrorMessage}
              isMissing={isMissing}
              disabled={disabled}
              fieldsetClassName={CLASS_NAMES.ratingFieldset}
              hidePrompt={shouldHideInternalHeading}
              hideDescription={
                shouldHideInternalHeading &&
                promptDescriptionIsQuestionDescription
              }
              hideValueLabels
              wrap={false}
              ariaLabelledBy={
                shouldHideInternalHeading ? promptHeadingId : undefined
              }
              ariaDescribedBy={
                shouldHideInternalHeading ? promptDescriptionId : undefined
              }
              rowClassName={CLASS_NAMES.ratingRow}
              buttonClassName={CLASS_NAMES.ratingButton}
              fieldsetPaddingBlock="space-8"
              fieldsetPaddingInline="space-0"
            />
          </div>
        </div>
      );
    }

    return (
      <DefaultQuestionRenderer
        question={question}
        value={value}
        onChange={onChange}
        isMissing={isMissing}
        disabled={disabled}
        validationErrorMessage={validationErrorMessage}
        textTooLongErrorMessage={textTooLongErrorMessage}
        hideLabel={hideLabel}
      />
    );
  },
);

DockQuestionRenderer.displayName = "DockQuestionRenderer";
