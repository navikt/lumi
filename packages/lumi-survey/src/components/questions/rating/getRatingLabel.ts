import type { RatingScaleLabel } from "../../../core/types.js";

export const getRatingLabel = (
  value: number,
  labels: RatingScaleLabel[] | undefined,
): string | null => {
  if (!labels || labels.length === 0) {
    return null;
  }

  return labels.find((label) => label.value === value)?.label ?? null;
};
