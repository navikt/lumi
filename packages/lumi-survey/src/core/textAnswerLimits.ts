import type { TextQuestion } from "./types.js";

export const DEFAULT_TEXT_ANSWER_MAX_LENGTH = 1_000;

// Keep aligned with SubmissionValidator.MAX_TEXT_ANSWER_LENGTH in lumi-api.
export const MAX_TEXT_ANSWER_LENGTH = 2_000;

export function getTextAnswerMaxLength(question: TextQuestion): number {
  const configuredMaxLength = question.maxLength;
  if (
    configuredMaxLength === undefined ||
    !Number.isFinite(configuredMaxLength) ||
    configuredMaxLength <= 0
  ) {
    return DEFAULT_TEXT_ANSWER_MAX_LENGTH;
  }

  // Authored documents reject fractions. Normalize legacy/untyped configs
  // defensively so a positive fraction cannot make the field impossible.
  return Math.min(
    Math.max(1, Math.floor(configuredMaxLength)),
    MAX_TEXT_ANSWER_LENGTH,
  );
}
