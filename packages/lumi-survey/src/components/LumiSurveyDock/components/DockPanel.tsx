import { XMarkIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Button,
  Heading,
  HStack,
  VStack,
} from "@navikt/ds-react";
import type React from "react";
import type { ComponentProps } from "react";
import type { LumiSurveyAnswerValue, LumiSurveyQuestion } from "../../../core";
import { formatQuestionPrompt } from "../../questions/utils/formatQuestionPrompt.js";
import { CLASS_NAMES, joinClassNames } from "../classNames.js";
import { IntroContent } from "./IntroContent.js";
import { SuccessContent } from "./SuccessContent.js";
import { SurveyFormContent } from "./SurveyFormContent.js";

export interface StepNavigationProps {
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
}

export interface ProgressProps {
  showProgress?: boolean;
  totalSteps?: number;
  hasBranching?: boolean;
}

export interface QuestionContextProps {
  promptQuestionId: string;
  promptHeadingId: string;
  promptDescriptionId?: string;
  validationErrorMessage: string;
}

export interface IntroProps {
  isIntro?: boolean;
  introTitle?: string;
  introBody?: React.ReactNode;
  introStartLabel?: string;
  onIntroStart?: () => void;
}

export interface SuccessProps {
  isSuccess: boolean;
  successTitle: string;
  successBody?: React.ReactNode;
  successPrimaryLabel: string;
}

const noop = () => {};

const CloseButton = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) => (
  <Button
    data-color="neutral"
    variant="tertiary"
    size="small"
    icon={<XMarkIcon aria-hidden />}
    onClick={onClick}
    aria-label={label}
    style={{
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      minWidth: "32px",
      padding: 0,
      flexShrink: 0,
    }}
  />
);

type BoxProps = ComponentProps<typeof Box>;

interface DockPanelProps {
  panelId: string;
  panelLabel: string;
  panelClassName?: string;
  panelStyle: React.CSSProperties;
  panelBackground: BoxProps["background"];
  panelBorderColor?: BoxProps["borderColor"];
  promptQuestion: LumiSurveyQuestion;
  successHeadingId: string;
  introHeadingId: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  orderedQuestions: LumiSurveyQuestion[];
  answers: Record<string, LumiSurveyAnswerValue>;
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
  // Grouped props
  stepNavigation: StepNavigationProps;
  progress: ProgressProps;
  questionContext: QuestionContextProps;
  intro: IntroProps;
  success: SuccessProps;
}

export const DockPanel = ({
  panelId,
  panelLabel,
  panelClassName,
  panelStyle,
  panelBackground,
  panelBorderColor,
  promptQuestion,
  successHeadingId,
  introHeadingId,
  onClose,
  onSubmit,
  orderedQuestions,
  answers,
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
  stepNavigation,
  progress,
  questionContext,
  intro,
  success,
}: DockPanelProps) => {
  // Destructure grouped props with defaults
  const {
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
  } = stepNavigation;

  const {
    showProgress = false,
    totalSteps = 0,
    hasBranching = false,
  } = progress;

  const {
    promptQuestionId,
    promptHeadingId,
    promptDescriptionId,
    validationErrorMessage,
  } = questionContext;

  const {
    isIntro = false,
    introTitle,
    introBody,
    introStartLabel = "Start",
    onIntroStart,
  } = intro;

  const { isSuccess, successTitle, successBody, successPrimaryLabel } = success;

  const activeQuestion =
    isStepMode && currentStepQuestion ? currentStepQuestion : promptQuestion;

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
              <CloseButton onClick={onClose} label={cancelLabel ?? "Avbryt"} />
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
                      {formatQuestionPrompt(activeQuestion)}
                    </Heading>
                    {activeQuestion.description && (
                      <BodyShort
                        size="small"
                        className={CLASS_NAMES.ratingDescription}
                        id={promptDescriptionId}
                      >
                        {activeQuestion.description}
                      </BodyShort>
                    )}
                  </>
                )}
              </div>
              {/* Close button - circular hover effect for better affordance */}
              <CloseButton onClick={onClose} label={cancelLabel ?? "Avbryt"} />
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
              <SurveyFormContent
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                isSubmitBlocked={isSubmitBlocked}
                submitLabel={submitLabel}
                submitPendingLabel={submitPendingLabel}
                orderedQuestions={orderedQuestions}
                answers={answers}
                onQuestionChange={onQuestionChange}
                promptQuestionId={promptQuestionId}
                promptHeadingId={promptHeadingId}
                promptDescriptionId={promptDescriptionId}
                validationMissing={validationMissing}
                validationErrorMessage={validationErrorMessage}
                isStepMode={isStepMode}
                currentStepQuestion={currentStepQuestion}
                canGoBack={canGoBack}
                canGoNext={canGoNext}
                isLastStep={isLastStep}
                onNext={onNext}
                onBack={onBack}
                nextLabel={nextLabel}
                backLabel={backLabel}
                showProgress={showProgress}
                currentStep={currentStep}
                totalSteps={totalSteps}
                hasBranching={hasBranching}
                showPersonalDataNotice={showPersonalDataNotice}
                personalDataNoticeBody={personalDataNotice}
                hasTransportError={hasTransportError}
                transportErrorMessage={transportErrorMessage}
                disabled={isSubmitting}
              />
            )}
          </VStack>
        )}
      </Box>
    </div>
  );
};

DockPanel.displayName = "LumiSurveyDockPanel";
