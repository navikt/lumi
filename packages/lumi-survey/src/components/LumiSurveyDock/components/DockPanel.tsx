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
import type { CanonicalSurveyPage } from "../../shared/canonicalSurvey.js";
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
  headerTitle?: string;
  headerDescription?: string;
  successHeadingId: string;
  introHeadingId: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  orderedQuestions: LumiSurveyQuestion[];
  orderedPages?: CanonicalSurveyPage[];
  answers: Record<string, LumiSurveyAnswerValue>;
  validationMissing: string[];
  validationAttempt: number;
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
  headerTitle,
  headerDescription,
  successHeadingId,
  introHeadingId,
  onClose,
  onSubmit,
  orderedQuestions,
  orderedPages,
  answers,
  validationMissing,
  validationAttempt,
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
  /*
   * The header is the panel's title block and always uses title typography,
   * no matter what fills it: an authored page title, or the first question
   * standing in when the page has none. Questions in the form below stay on
   * the field scale. Sizing the header from the number of visible questions
   * made it resize mid-interaction as answers revealed follow-ups, and made
   * a page title indistinguishable from the question right beneath it.
   */
  const headerIsPageTitle = Boolean(headerTitle);
  const activeHeading = headerTitle ?? formatQuestionPrompt(activeQuestion);
  const activeDescription = headerTitle
    ? headerDescription
    : (headerDescription ?? activeQuestion.description);

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
                  tabIndex={-1}
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
              className={joinClassNames(
                CLASS_NAMES.header,
                // A page title heads a group of questions that each carry
                // their own label, so it needs a visible group boundary —
                // two bold lines two pixels apart are not a hierarchy.
                !isSuccess && headerIsPageTitle && CLASS_NAMES.groupHeader,
              )}
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
                    tabIndex={-1}
                  >
                    {successTitle}
                  </Heading>
                ) : (
                  <>
                    <Heading
                      level="2"
                      size="small"
                      className={CLASS_NAMES.ratingHeading}
                      id={promptHeadingId}
                      tabIndex={-1}
                    >
                      {activeHeading}
                    </Heading>
                    {activeDescription && (
                      <BodyShort
                        size="small"
                        className={CLASS_NAMES.ratingDescription}
                        id={promptDescriptionId}
                      >
                        {activeDescription}
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
                orderedPages={orderedPages}
                answers={answers}
                onQuestionChange={onQuestionChange}
                validationMissing={validationMissing}
                validationAttempt={validationAttempt}
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
