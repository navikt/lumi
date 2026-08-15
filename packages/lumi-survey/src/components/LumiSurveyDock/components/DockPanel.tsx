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
import type {
  IntroProps,
  ProgressProps,
  QuestionContextProps,
  StepNavigationProps,
  SuccessProps,
} from "../dockTypes.js";
import { CloseButton } from "./CloseButton.js";
import { IntroContent } from "./IntroContent.js";
import { SuccessContent } from "./SuccessContent.js";
import { SurveyFormContent } from "./SurveyFormContent.js";

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
  // Destructure intro/success — DockPanel uses these for header rendering
  const {
    isIntro = false,
    introTitle,
    introBody,
    introStartLabel = "Start",
    onIntroStart,
  } = intro;

  const { isSuccess, successTitle, successBody, successPrimaryLabel } = success;

  // Destructure only what DockPanel needs for its own rendering
  const {
    isStepMode = false,
    currentStep = 0,
    currentStepQuestion,
  } = stepNavigation;
  const { promptHeadingId, promptDescriptionId } = questionContext;

  const activeQuestion =
    isStepMode && currentStepQuestion ? currentStepQuestion : promptQuestion;
  const usesFieldTypography = !isStepMode && orderedQuestions.length > 1;

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
                  size="small"
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
                    size="small"
                    className={CLASS_NAMES.ratingHeading}
                    id={successHeadingId}
                  >
                    {successTitle}
                  </Heading>
                ) : (
                  <>
                    <Heading
                      level="2"
                      size={usesFieldTypography ? "xsmall" : "small"}
                      className={CLASS_NAMES.ratingHeading}
                      id={promptHeadingId}
                      tabIndex={-1}
                    >
                      {formatQuestionPrompt(activeQuestion)}
                    </Heading>
                    {activeQuestion.description && (
                      <BodyShort
                        size={usesFieldTypography ? "medium" : "small"}
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
                validationMissing={validationMissing}
                stepNavigation={stepNavigation}
                progress={progress}
                questionContext={questionContext}
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
