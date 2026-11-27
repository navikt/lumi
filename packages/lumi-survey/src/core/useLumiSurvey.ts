import { useCallback, useRef, useState } from "react";
import { cloneAnswers, useAnswerState } from "./answers.js";
import { generateDeduplicationKey } from "./deduplicationKey.js";
import { resolveDocumentVisibility } from "./documentVisibility.js";
import { getVisibleAnswers } from "./evaluateVisibility.js";
import { submitWithRetry } from "./submitWithRetry.js";
import { buildTransportPayload } from "./transportPayload.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyContext,
  LumiSurveyError,
  LumiSurveyEvents,
  LumiSurveyQuestion,
  LumiSurveyStatus,
  LumiSurveySubmission,
  LumiSurveySubmitResult,
  LumiSurveyTransport,
  LumiSurveyValidationError,
  SurveyType,
} from "./types";
import { validateAnswers } from "./validation.js";
import { getVisibilityMetadata } from "./visibilityMetadata.js";

export interface UseLumiSurveyOptions {
  surveyId: string;
  questions: LumiSurveyQuestion[];
  transport: LumiSurveyTransport;
  events?: LumiSurveyEvents;
  /**
   * Structured context. `tags` support segmentation; `debug` is stored but is
   * not exposed by the current dashboard/export read model.
   */
  context?: LumiSurveyContext;
  initialAnswers?: Record<string, LumiSurveyAnswerValue>;
  surveyType?: SurveyType;
}

export interface UseLumiSurveyReturn {
  answers: Record<string, LumiSurveyAnswerValue>;
  status: LumiSurveyStatus;
  error: LumiSurveyError | null;
  setAnswer: (
    questionId: string,
    value: LumiSurveyAnswerValue | null | undefined,
  ) => void;
  submit: (
    questionsToValidate?: LumiSurveyQuestion[],
  ) => Promise<LumiSurveySubmitResult>;
  validate: (questionsToValidate?: LumiSurveyQuestion[]) => string[];
  reset: () => void;
}

export function useLumiSurvey(
  options: UseLumiSurveyOptions,
): UseLumiSurveyReturn {
  // The timer control is not part of the public hook.
  const { restartTimer: _restartTimer, ...survey } =
    useLumiSurveyState(options);
  return survey;
}

export interface LumiSurveyState extends UseLumiSurveyReturn {
  /**
   * Moves `startedAt` to now. The clock otherwise starts when the hook
   * mounts, which for a survey further down a page is long before the user
   * sees it.
   */
  restartTimer: () => void;
}

/** Internal document-aware state hook; the public hook retains flat semantics. */
export function useLumiSurveyState(
  options: UseLumiSurveyOptions,
  documentVisibility = false,
): LumiSurveyState {
  const {
    surveyId,
    questions,
    transport,
    events,
    context,
    initialAnswers,
    surveyType,
  } = options;

  const { answers, setAnswer, resetAnswers, startedAtRef } = useAnswerState({
    initialAnswers,
    onAnswer: events?.onAnswer,
  });
  const [status, setStatus] = useState<LumiSurveyStatus>("idle");
  const [error, setError] = useState<LumiSurveyError | null>(null);
  const deduplicationKeyRef = useRef<string | null>(null);
  // Bumped by reset(). A submit that settles after a reset still reports its
  // outcome through events, but must not change the fresh survey's state.
  const generationRef = useRef(0);

  const getDeduplicationKey = useCallback(() => {
    if (deduplicationKeyRef.current === null) {
      deduplicationKeyRef.current = generateDeduplicationKey();
    }
    return deduplicationKeyRef.current;
  }, []);

  const validate = useCallback(
    (questionsToValidate?: LumiSurveyQuestion[]): string[] => {
      const candidates = questionsToValidate ?? questions;
      const visibleIds = documentVisibility
        ? resolveDocumentVisibility(
            questions,
            answers,
            getVisibilityMetadata(context),
          ).visibleQuestionIds
        : undefined;
      return validateAnswers(
        visibleIds
          ? candidates.filter((question) => visibleIds.has(question.id))
          : candidates,
        answers,
      );
    },
    [answers, context, documentVisibility, questions],
  );

  const submit = useCallback(
    async (
      questionsToValidate?: LumiSurveyQuestion[],
    ): Promise<LumiSurveySubmitResult> => {
      const missing = validate(questionsToValidate);

      if (missing.length > 0) {
        const validationError: LumiSurveyValidationError = {
          type: "validation",
          missing,
        };
        setStatus("error");
        setError(validationError);
        events?.onValidationFailed?.(missing);
        return { ok: false, error: validationError };
      }

      setStatus("submitting");
      setError(null);
      const generation = generationRef.current;

      try {
        const answerSnapshot = cloneAnswers(answers);
        const submittedAnswers = documentVisibility
          ? // The answers have no prototype there. The transport and the
            // events get the plain object they have always had.
            {
              ...resolveDocumentVisibility(
                questions,
                answerSnapshot,
                getVisibilityMetadata(context),
              ).visibleAnswers,
            }
          : getVisibleAnswers(
              questions,
              answerSnapshot,
              getVisibilityMetadata(context),
            );
        const submittedAtTimestamp = new Date().toISOString();
        const deduplicationKey = getDeduplicationKey();
        const submission: LumiSurveySubmission = {
          surveyId,
          answers: submittedAnswers,
          startedAt: startedAtRef.current,
          submittedAt: submittedAtTimestamp,
          context: context ? { ...context } : undefined,
          transportPayload: buildTransportPayload(
            surveyId,
            submittedAnswers,
            questions,
            deduplicationKey,
            surveyType,
            context,
            startedAtRef.current,
            submittedAtTimestamp,
          ),
        };

        events?.onSubmitStart?.(submission);
        await submitWithRetry(transport, submission);
        if (generation === generationRef.current) {
          setStatus("success");
          setError(null);
          // Rotate deduplication key after successful submit
          deduplicationKeyRef.current = generateDeduplicationKey();
        }
        events?.onSubmitSuccess?.(submission);
        return { ok: true, submission };
      } catch (cause) {
        const transportError: LumiSurveyError = { type: "transport", cause };
        if (generation === generationRef.current) {
          setStatus("error");
          setError(transportError);
        }
        events?.onSubmitError?.(cause);
        return { ok: false, error: transportError };
      }
    },
    [
      answers,
      context,
      documentVisibility,
      events,
      getDeduplicationKey,
      questions,
      startedAtRef,
      surveyId,
      surveyType,
      transport,
      validate,
    ],
  );

  const restartTimer = useCallback(() => {
    startedAtRef.current = new Date().toISOString();
  }, [startedAtRef]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    resetAnswers();
    setStatus("idle");
    setError(null);
    // Rotate deduplication key on reset
    deduplicationKeyRef.current = generateDeduplicationKey();
    events?.onReset?.();
  }, [events, resetAnswers]);

  return {
    answers,
    status,
    error,
    setAnswer,
    submit,
    validate,
    reset,
    restartTimer,
  };
}
