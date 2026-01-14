import type { RatingScaleLabel } from "./types";

const DEFAULT_EMOJI_LABELS = [
  "Veldig dårlig",
  "Dårlig",
  "Nøytral",
  "Bra",
  "Veldig bra",
] as const;

const createLabelsFromArray = (labels: readonly string[]): RatingScaleLabel[] =>
  labels.map((label, index) => ({ value: index + 1, label }));

export const DEFAULT_RATING_LABELS: RatingScaleLabel[] =
  createLabelsFromArray(DEFAULT_EMOJI_LABELS);

export const createRatingLabels = (
  labels: readonly string[],
): RatingScaleLabel[] => {
  if (labels.length === 0) {
    return DEFAULT_RATING_LABELS;
  }

  return createLabelsFromArray(labels);
};
