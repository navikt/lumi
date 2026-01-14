import { useMemo } from "react";
import type { ChoiceOption, ChoiceQuestion } from "../../../core/types.js";

export const useChoiceOptions = (question: ChoiceQuestion): ChoiceOption[] => {
  return useMemo(() => {
    if (!question.randomize) {
      return question.options;
    }

    const copy = [...question.options];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }

    return copy;
  }, [question.options, question.randomize]);
};
