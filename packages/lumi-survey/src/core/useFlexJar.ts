import { useCallback, useState } from "react";
import { cloneAnswers, useAnswerState } from "./answers.js";
import { buildTransportPayload } from "./transportPayload.js";
import type {
  FlexJarAnswerValue,
  FlexJarError,
  FlexJarEvents,
  FlexJarQuestion,
  FlexJarStatus,
  FlexJarSubmission,
  FlexJarSubmitResult,
  FlexJarTransport,
  FlexJarValidationError,
  FlexjarContext,
  SurveyType,
} from "./types";
import { validateAnswers } from "./validation.js";

export interface UseFlexJarOptions {
  surveyId: string;
  questions: FlexJarQuestion[];
  transport: FlexJarTransport;
  events?: FlexJarEvents;
  /** Structured context for segmentation (tags) and debugging (debug) */
  context?: FlexjarContext;
  initialAnswers?: Record<string, FlexJarAnswerValue>;
  surveyType?: SurveyType;
}

export type UseLumiSurveyOptions = UseFlexJarOptions;

export interface UseFlexJarReturn {
  answers: Record<string, FlexJarAnswerValue>;
  status: FlexJarStatus;
  error: FlexJarError | null;
  setAnswer: (
    questionId: string,
    value: FlexJarAnswerValue | null | undefined,
  ) => void;
  submit: () => Promise<FlexJarSubmitResult>;
  validate: () => string[];
  reset: () => void;
}

export type UseLumiSurveyReturn = UseFlexJarReturn;

export function useFlexJar(options: UseFlexJarOptions): UseFlexJarReturn {
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
  const [status, setStatus] = useState<FlexJarStatus>("idle");
  const [error, setError] = useState<FlexJarError | null>(null);

  const validate = useCallback((): string[] => {
    return validateAnswers(questions, answers);
  }, [answers, questions]);

  const submit = useCallback(async (): Promise<FlexJarSubmitResult> => {
    const missing = validate();

    if (missing.length > 0) {
      const validationError: FlexJarValidationError = {
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

    const answerSnapshot = cloneAnswers(answers);
    const submittedAtTimestamp = new Date().toISOString();
    const submission: FlexJarSubmission = {
      surveyId,
      answers: answerSnapshot,
      startedAt: startedAtRef.current,
      submittedAt: submittedAtTimestamp,
      context: context ? { ...context } : undefined,
      transportPayload: buildTransportPayload(
        surveyId,
        answerSnapshot,
        questions,
        surveyType,
        context,
        startedAtRef.current,
        submittedAtTimestamp,
      ),
    };

    events?.onSubmitStart?.(submission);

    try {
      await transport.submit(submission);
      setStatus("success");
      setError(null);
      events?.onSubmitSuccess?.(submission);
      return { ok: true, submission };
    } catch (cause) {
      const transportError: FlexJarError = { type: "transport", cause };
      setStatus("error");
      setError(transportError);
      events?.onSubmitError?.(cause);
      return { ok: false, error: transportError };
    }
  }, [
    answers,
    context,
    events,
    surveyId,
    questions,
    surveyType,
    transport,
    validate,
    startedAtRef,
  ]);

  const reset = useCallback(() => {
    resetAnswers();
    setStatus("idle");
    setError(null);
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

export function useLumiSurvey(
  options: UseLumiSurveyOptions,
): UseLumiSurveyReturn {
  return useFlexJar(options);
}
