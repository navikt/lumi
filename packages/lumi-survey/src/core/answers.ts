import { type MutableRefObject, useCallback, useRef, useState } from "react";
import type { LumiSurveyAnswerValue } from "./types";

export interface UseAnswerStateOptions {
  initialAnswers?: Record<string, LumiSurveyAnswerValue>;
  onAnswer?: (
    questionId: string,
    value: LumiSurveyAnswerValue | null | undefined,
  ) => void;
}

export interface UseAnswerStateReturn {
  answers: Record<string, LumiSurveyAnswerValue>;
  setAnswer: (
    questionId: string,
    value: LumiSurveyAnswerValue | null | undefined,
  ) => void;
  resetAnswers: () => void;
  startedAtRef: MutableRefObject<string>;
}

export function useAnswerState(
  options: UseAnswerStateOptions,
): UseAnswerStateReturn {
  const { initialAnswers, onAnswer } = options;

  const initialAnswersRef = useRef<Record<string, LumiSurveyAnswerValue>>(
    initialAnswers ? cloneAnswers(initialAnswers) : {},
  );

  const [answers, setAnswers] = useState<Record<string, LumiSurveyAnswerValue>>(
    initialAnswersRef.current,
  );
  const startedAtRef = useRef<string>(new Date().toISOString());

  const setAnswer = useCallback(
    (questionId: string, value: LumiSurveyAnswerValue | null | undefined) => {
      setAnswers((prev: Record<string, LumiSurveyAnswerValue>) => {
        const next = { ...prev };
        if (shouldDropValue(value)) {
          delete next[questionId];
        } else {
          const safeValue = value as LumiSurveyAnswerValue;
          next[questionId] = cloneAnswerValue(safeValue);
        }
        return next;
      });

      onAnswer?.(questionId, value);
    },
    [onAnswer],
  );

  const resetAnswers = useCallback(() => {
    const nextInitial = cloneAnswers(initialAnswersRef.current);
    setAnswers(nextInitial);
    startedAtRef.current = new Date().toISOString();
  }, []);

  return {
    answers,
    setAnswer,
    resetAnswers,
    startedAtRef,
  };
}

export function cloneAnswers(
  source: Record<string, LumiSurveyAnswerValue>,
): Record<string, LumiSurveyAnswerValue> {
  const copy: Record<string, LumiSurveyAnswerValue> = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== undefined) {
      copy[key] = cloneAnswerValue(value);
    }
  }
  return copy;
}

function shouldDropValue(
  value: LumiSurveyAnswerValue | null | undefined,
): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return true;
  }

  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  return false;
}

function cloneAnswerValue(value: LumiSurveyAnswerValue): LumiSurveyAnswerValue {
  if (Array.isArray(value)) {
    return [...value];
  }

  return value;
}
