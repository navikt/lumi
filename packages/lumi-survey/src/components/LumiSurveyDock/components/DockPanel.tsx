import { XMarkIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  Heading,
  HStack,
  ProgressBar,
  VStack,
} from "@navikt/ds-react";
import type React from "react";
import type { ComponentProps } from "react";
import type { LumiSurveyAnswerValue, LumiSurveyQuestion } from "../../../core";
import type { LumiSurveyRenderQuestionProps } from "../../../types.js";
import { formatQuestionPrompt } from "../../questions/utils/formatQuestionPrompt.js";
import { CLASS_NAMES, joinClassNames } from "../classNames.js";
import { IntroContent } from "./IntroContent.js";
import { SuccessContent } from "./SuccessContent.js";

const noop = () => {};

type BoxProps = ComponentProps<typeof Box>;

interface DockPanelProps {
  panelId: string;
  panelLabel: string;
  panelClassName?: string;
  panelStyle: React.CSSProperties;
  panelBackground: BoxProps["background"];
  panelBorderColor?: BoxProps["borderColor"];
  promptQuestion: LumiSurveyQuestion;
  promptHeadingId: string;
  promptDescriptionId?: string;
  successHeadingId: string;
  introHeadingId: string;
  successTitle: string;
  successBody?: React.ReactNode;
  successPrimaryLabel: string;
  isSuccess: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  orderedQuestions: LumiSurveyQuestion[];
  answers: Record<string, LumiSurveyAnswerValue>;
  renderQuestion: (props: LumiSurveyRenderQuestionProps) => React.ReactNode;
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
    value: LumiSurveyAnswerValue | null | undefined,
  ) => void;
  // Step mode props (branching logic)
  isStepMode?: boolean;
  currentStep?: number;
  currentStepQuestion?: LumiSurveyQuestion;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isLastStep?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  // Intro props
  isIntro?: boolean;
  introTitle?: string;
  introBody?: React.ReactNode;
  introStartLabel?: string;
  onIntroStart?: () => void;
  // Progress bar props
  showProgress?: boolean;
  totalSteps?: number;
  visitedSteps?: number[];
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
  introHeadingId,
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
  // Intro props
  isIntro = false,
  introTitle,
  introBody,
  introStartLabel = "Start",
  onIntroStart,
  // Progress bar props
  showProgress = false,
  totalSteps = 0,
  visitedSteps,
}: DockPanelProps) => {
  return (
    <div style={{ position: "relative" }}>
      <Box
        padding="space-16"
        background={panelBackground}
        borderRadius="12"
        shadow="dialog"
        borderWidth={panelBorderColor ? "1" : undefined}
        borderColor={panelBorderColor}
        className={joinClassNames(CLASS_NAMES.panel, panelClassName)}
        style={panelStyle}
        data-lumi-survey-panel-label={panelLabel}
        data-lumi-survey-step={isStepMode ? currentStep : undefined}
        aria-labelledby={
          isIntro
            ? introHeadingId
            : isSuccess
              ? successHeadingId
              : promptHeadingId
        }
        id={panelId}
      >
        {isIntro ? (
          <VStack gap="space-16">
            <HStack
              className={CLASS_NAMES.header}
              justify="space-between"
              align="start"
              gap="space-8"
              wrap={false}
            >
              <div className={CLASS_NAMES.headerText} style={{ flex: 1 }}>
                <Heading
                  level="2"
                  size="medium"
                  className={CLASS_NAMES.ratingHeading}
                  id={introHeadingId}
                >
                  {introTitle}
                </Heading>
              </div>
              {/* Close button */}
              <Button
                data-color="neutral"
                variant="tertiary"
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
            <IntroContent
              headingId={introHeadingId}
              title={introTitle ?? ""}
              body={introBody}
              startLabel={introStartLabel}
              onStart={onIntroStart ?? noop}
              showTitle={false}
            />
          </VStack>
        ) : (
          <VStack gap="space-12">
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
                      tabIndex={-1}
                    >
                      {/* In step mode, show current step's prompt; otherwise show first question */}
                      {isStepMode && currentStepQuestion
                        ? formatQuestionPrompt(currentStepQuestion)
                        : formatQuestionPrompt(promptQuestion)}
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
                data-color="neutral"
                variant="tertiary"
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

            {showProgress && isStepMode && !isSuccess && totalSteps > 0 && (
              <ProgressBar
                value={visitedSteps ? visitedSteps.length : currentStep + 1}
                valueMax={totalSteps}
                size="small"
                aria-label={`Steg ${visitedSteps ? visitedSteps.length : currentStep + 1} av ${totalSteps}`}
              />
            )}

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
                      <div className="lumi-survey-question">
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

                      {/* Show privacy notice when a text field is visible */}
                      {showPersonalDataNotice && (
                        <Alert variant="warning" role="alert">
                          {personalDataNotice}
                        </Alert>
                      )}

                      {hasTransportError && (
                        <Alert variant="error" role="alert">
                          {transportErrorMessage}
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
                        const isMissing = validationMissing.includes(
                          question.id,
                        );
                        const handleChange = (
                          nextValue: LumiSurveyAnswerValue | null | undefined,
                        ) => {
                          onQuestionChange(question.id, nextValue);
                        };

                        return (
                          <div
                            key={question.id}
                            className="lumi-survey-question"
                          >
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

                      {showPersonalDataNotice && (
                        <Alert variant="warning" role="alert">
                          {personalDataNotice}
                        </Alert>
                      )}

                      <HStack gap="space-8" wrap>
                        <Button
                          type="submit"
                          loading={isSubmitting}
                          disabled={isSubmitBlocked || isSubmitting}
                        >
                          {isSubmitting ? submitPendingLabel : submitLabel}
                        </Button>
                      </HStack>

                      {hasTransportError && (
                        <Alert variant="error" role="alert">
                          {transportErrorMessage}
                        </Alert>
                      )}
                    </>
                  )}
                </VStack>
              </form>
            )}
          </VStack>
        )}
      </Box>
    </div>
  );
};

DockPanel.displayName = "LumiSurveyDockPanel";
