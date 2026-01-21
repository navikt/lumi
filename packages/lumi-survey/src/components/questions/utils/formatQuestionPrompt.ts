import type { LumiSurveyQuestion } from "../../../core/types.js";

const OPTIONAL_SUFFIX = "(valgfritt)";

function hasOptionalSuffix(prompt: string): boolean {
  return prompt.toLowerCase().includes("valgfritt");
}

export function formatQuestionPrompt(
  question: Pick<LumiSurveyQuestion, "prompt" | "required">,
): string {
  if (question.required) {
    return question.prompt;
  }

  if (hasOptionalSuffix(question.prompt)) {
    return question.prompt;
  }

  return `${question.prompt} ${OPTIONAL_SUFFIX}`;
}
