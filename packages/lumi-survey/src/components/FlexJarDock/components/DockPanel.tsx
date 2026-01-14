import { XMarkIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  HStack,
  Heading,
  VStack,
} from "@navikt/ds-react";
import type { BoxNewProps } from "@navikt/ds-react/Box";
import type React from "react";
import type { FlexJarAnswerValue, FlexJarQuestion } from "../../../core";
import type { FlexJarRenderQuestionProps } from "../../../types.js";
import { CLASS_NAMES, joinClassNames } from "../classNames.js";
import { SuccessContent } from "./SuccessContent.js";

interface DockPanelProps {
  panelId: string;
  panelLabel: string;
  panelClassName?: string;
  panelStyle: React.CSSProperties;
  panelBackground: BoxNewProps["background"];
  panelBorderColor?: BoxNewProps["borderColor"];
  promptQuestion: FlexJarQuestion;
  promptHeadingId: string;
  promptDescriptionId?: string;
  successHeadingId: string;
  successTitle: string;
  successBody?: React.ReactNode;
  successPrimaryLabel: string;
  isSuccess: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  orderedQuestions: FlexJarQuestion[];
  answers: Record<string, FlexJarAnswerValue>;
  renderQuestion: (props: FlexJarRenderQuestionProps) => React.ReactNode;
  validationMissing: string[];
  isSubmitting: boolean;
  submitLabel: string;
  submitPendingLabel: string;
  cancelLabel: string;
  showPersonalDataNotice: boolean;
  personalDataNotice?: React.ReactNode;
  isSubmitBlocked: boolean;
  hasTransportError: boolean;
  transportErrorMessage: string;
  onQuestionChange: (
    questionId: string,
    value: FlexJarAnswerValue | null | undefined,
  ) => void;
  // Step mode props (branching logic)
  isStepMode?: boolean;
  currentStep?: number;
  currentStepQuestion?: FlexJarQuestion;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isLastStep?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
}

export const DockPanel = ({
  panelId,
  panelLabel,
  panelClassName,
  panelStyle,
  panelBackground,
  panelBorderColor,
  promptQuestion,
  promptHeadingId,
  promptDescriptionId,
  successHeadingId,
  successTitle,
  successBody,
  successPrimaryLabel,
  isSuccess,
  onClose,
  onSubmit,
  orderedQuestions,
  answers,
  renderQuestion,
  validationMissing,
  isSubmitting,
  submitLabel,
  submitPendingLabel,
  cancelLabel,
  showPersonalDataNotice,
  personalDataNotice,
  isSubmitBlocked,
  hasTransportError,
  transportErrorMessage,
  onQuestionChange,
  // Step mode props
  isStepMode = false,
  currentStep = 0,
  currentStepQuestion,
  canGoBack = false,
  canGoNext = true,
  isLastStep = false,
  onNext,
  onBack,
  nextLabel = "Neste",
  backLabel = "Tilbake",
}: DockPanelProps) => {
  return (
    <div style={{ position: "relative" }}>
      <Box.New
        padding="space-16"
        background={panelBackground}
        borderRadius="large"
        shadow="dialog"
        borderWidth={panelBorderColor ? "1" : undefined}
        borderColor={panelBorderColor}
        className={joinClassNames(CLASS_NAMES.panel, panelClassName)}
        style={panelStyle}
        data-flexjar-panel-label={panelLabel}
        data-flexjar-step={isStepMode ? currentStep : undefined}
        aria-labelledby={isSuccess ? successHeadingId : promptHeadingId}
        id={panelId}
      >
        <HStack
          className={CLASS_NAMES.header}
          justify="space-between"
          align="start"
          gap="space-8"
          wrap={false}
        >
          <div
            className={CLASS_NAMES.headerText}
            role={isSuccess ? "status" : undefined}
            aria-live={isSuccess ? "polite" : undefined}
            style={{ flex: 1 }}
          >
            {isSuccess ? (
              <Heading
                level="2"
                size="medium"
                className={CLASS_NAMES.ratingHeading}
                id={successHeadingId}
              >
                {successTitle}
              </Heading>
            ) : (
              <>
                <Heading
                  level="2"
                  size="medium"
                  className={CLASS_NAMES.ratingHeading}
                  id={promptHeadingId}
                >
                  {/* In step mode, show current step's prompt; otherwise show first question */}
                  {isStepMode && currentStepQuestion
                    ? currentStepQuestion.prompt
                    : promptQuestion.prompt}
                </Heading>
                {/* Show description from current step in step mode, or from first question otherwise */}
                {(isStepMode && currentStepQuestion
                  ? currentStepQuestion.description
                  : promptQuestion.description) && (
                  <BodyShort
                    size="small"
                    className={CLASS_NAMES.ratingDescription}
                    id={promptDescriptionId}
                  >
                    {isStepMode && currentStepQuestion
                      ? currentStepQuestion.description
                      : promptQuestion.description}
                  </BodyShort>
                )}
              </>
            )}
          </div>
          {/* Close button - circular hover effect for better affordance */}
          <Button
            variant="tertiary-neutral"
            size="small"
            icon={<XMarkIcon aria-hidden />}
            onClick={onClose}
            aria-label={cancelLabel ?? "Avbryt"}
            style={{
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              minWidth: "32px",
              padding: 0,
              flexShrink: 0,
            }}
          />
        </HStack>

        {isSuccess ? (
          <VStack gap="space-16">
            <SuccessContent
              title={successTitle}
              body={successBody}
              showTitle={false}
              announce={Boolean(successBody)}
            />
            <Button onClick={onClose}>{successPrimaryLabel}</Button>
          </VStack>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <VStack gap="space-16">
              {isStepMode && currentStepQuestion ? (
                // Step mode: Show only the current question
                <>
                  <div className="flexjar-question">
                    {renderQuestion({
                      question: currentStepQuestion,
                      value: answers[currentStepQuestion.id],
                      onChange: (nextValue) =>
                        onQuestionChange(currentStepQuestion.id, nextValue),
                      isMissing: validationMissing.includes(
                        currentStepQuestion.id,
                      ),
                      disabled: isSubmitting,
                      hideLabel: true, // Header now shows current step's prompt
                    })}
                  </div>

                  {hasTransportError && (
                    <Alert variant="error" role="alert">
                      {transportErrorMessage}
                    </Alert>
                  )}

                  {/* Show privacy notice only on last step before submit */}
                  {showPersonalDataNotice && isLastStep && (
                    <Alert variant="warning" role="alert">
                      {personalDataNotice}
                    </Alert>
                  )}

                  <HStack gap="space-8" wrap>
                    {canGoBack && (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={onBack}
                        disabled={isSubmitting}
                      >
                        {backLabel}
                      </Button>
                    )}
                    {isLastStep ? (
                      <Button
                        key="submit-btn"
                        type="submit"
                        loading={isSubmitting}
                        disabled={isSubmitting || !canGoNext}
                      >
                        {isSubmitting ? submitPendingLabel : submitLabel}
                      </Button>
                    ) : (
                      <Button
                        key="next-btn"
                        type="button"
                        onClick={onNext}
                        disabled={isSubmitting || !canGoNext}
                      >
                        {nextLabel}
                      </Button>
                    )}
                  </HStack>
                </>
              ) : (
                // All visible questions mode
                <>
                  {orderedQuestions.map((question) => {
                    const value = answers[question.id];
                    const isMissing = validationMissing.includes(question.id);
                    const handleChange = (
                      nextValue: FlexJarAnswerValue | null | undefined,
                    ) => {
                      onQuestionChange(question.id, nextValue);
                    };

                    return (
                      <div key={question.id} className="flexjar-question">
                        {renderQuestion({
                          question,
                          value,
                          onChange: handleChange,
                          isMissing,
                          disabled: isSubmitting,
                          hideLabel: question.id === promptQuestion.id,
                        })}
                      </div>
                    );
                  })}

                  {hasTransportError && (
                    <Alert variant="error" role="alert">
                      {transportErrorMessage}
                    </Alert>
                  )}

                  {showPersonalDataNotice && !isSubmitBlocked && (
                    <Alert variant="warning" role="alert">
                      {personalDataNotice}
                    </Alert>
                  )}

                  <HStack gap="space-8" wrap>
                    {/* Only show Submit button when form is valid (not blocked) */}
                    {!isSubmitBlocked && (
                      <Button
                        type="submit"
                        loading={isSubmitting}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? submitPendingLabel : submitLabel}
                      </Button>
                    )}
                  </HStack>
                </>
              )}
            </VStack>
          </form>
        )}
      </Box.New>
    </div>
  );
};

DockPanel.displayName = "FlexJarDockPanel";
