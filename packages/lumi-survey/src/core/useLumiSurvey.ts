import { useCallback, useRef, useState } from "react";
import { cloneAnswers, useAnswerState } from "./answers.js";
import { generateDeduplicationKey } from "./deduplicationKey.js";
import { getVisibleAnswers } from "./evaluateVisibility.js";
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
  /** Structured context for segmentation (tags) and debugging (debug) */
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

  const getDeduplicationKey = useCallback(() => {
    if (deduplicationKeyRef.current === null) {
      deduplicationKeyRef.current = generateDeduplicationKey();
    }
    return deduplicationKeyRef.current;
  }, []);

  const validate = useCallback(
    (questionsToValidate?: LumiSurveyQuestion[]): string[] => {
      return validateAnswers(questionsToValidate ?? questions, answers);
    },
    [answers, questions],
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

      try {
        const answerSnapshot = cloneAnswers(answers);
        const submittedAnswers = getVisibleAnswers(
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
        await transport.submit(submission);
        setStatus("success");
        setError(null);
        // Rotate deduplication key after successful submit
        deduplicationKeyRef.current = generateDeduplicationKey();
        events?.onSubmitSuccess?.(submission);
        return { ok: true, submission };
      } catch (cause) {
        const transportError: LumiSurveyError = { type: "transport", cause };
        setStatus("error");
        setError(transportError);
        events?.onSubmitError?.(cause);
        return { ok: false, error: transportError };
      }
    },
    [
      answers,
      context,
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

  const reset = useCallback(() => {
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
  };
}
