import { type MutableRefObject, useCallback, useRef, useState } from "react";
import type { FlexJarAnswerValue } from "./types";

export interface UseAnswerStateOptions {
  initialAnswers?: Record<string, FlexJarAnswerValue>;
  onAnswer?: (
    questionId: string,
    value: FlexJarAnswerValue | null | undefined,
  ) => void;
}

export interface UseAnswerStateReturn {
  answers: Record<string, FlexJarAnswerValue>;
  setAnswer: (
    questionId: string,
    value: FlexJarAnswerValue | null | undefined,
  ) => void;
  resetAnswers: () => void;
  startedAtRef: MutableRefObject<string>;
}

export function useAnswerState(
  options: UseAnswerStateOptions,
): UseAnswerStateReturn {
  const { initialAnswers, onAnswer } = options;

  const initialAnswersRef = useRef<Record<string, FlexJarAnswerValue>>(
    initialAnswers ? cloneAnswers(initialAnswers) : {},
  );

  const [answers, setAnswers] = useState<Record<string, FlexJarAnswerValue>>(
    initialAnswersRef.current,
  );
  const startedAtRef = useRef<string>(new Date().toISOString());

  const setAnswer = useCallback(
    (questionId: string, value: FlexJarAnswerValue | null | undefined) => {
      setAnswers((prev: Record<string, FlexJarAnswerValue>) => {
        const next = { ...prev };
        if (shouldDropValue(value)) {
          delete next[questionId];
        } else {
          const safeValue = value as FlexJarAnswerValue;
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
  source: Record<string, FlexJarAnswerValue>,
): Record<string, FlexJarAnswerValue> {
  const copy: Record<string, FlexJarAnswerValue> = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== undefined) {
      copy[key] = cloneAnswerValue(value);
    }
  }
  return copy;
}

function shouldDropValue(
  value: FlexJarAnswerValue | null | undefined,
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

function cloneAnswerValue(value: FlexJarAnswerValue): FlexJarAnswerValue {
  if (Array.isArray(value)) {
    return [...value];
  }

  return value;
}
