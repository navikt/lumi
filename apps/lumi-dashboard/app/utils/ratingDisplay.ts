/**
 * Shared utilities for displaying rating variants (emoji, stars, thumbs, NPS).
 * Used across StatsCards, FieldCards, and FeedbackTable components.
 */

export type RatingVariant = "emoji" | "stars" | "thumbs" | "nps";

const RATING_VARIANTS: ReadonlySet<RatingVariant> = new Set([
  "emoji",
  "stars",
  "thumbs",
  "nps",
]);

export function normalizeRatingVariant(
  value: unknown,
): RatingVariant | undefined {
  if (typeof value !== "string") return undefined;
  if (RATING_VARIANTS.has(value as RatingVariant))
    return value as RatingVariant;
  return undefined;
}

export function inferRatingVariantFromAnswer(input: {
  rating: number;
  ratingVariant?: unknown;
  ratingScale?: unknown;
}): RatingVariant {
  const normalized = normalizeRatingVariant(input.ratingVariant);
  if (normalized) return normalized;

  const ratingScale =
    typeof input.ratingScale === "number" ? input.ratingScale : undefined;

  if (ratingScale === 2) return "thumbs";
  if (ratingScale === 11) return "nps";

  // Heuristic: only NPS can produce 0 or >5.
  if (input.rating === 0 || input.rating > 5) return "nps";

  return "emoji";
}

export function inferRatingVariantFromDistribution(
  distribution: Record<string, number> | undefined,
  explicitVariant?: unknown,
): RatingVariant {
  const normalized = normalizeRatingVariant(explicitVariant);
  if (normalized) return normalized;

  if (!distribution) return "emoji";

  const keys = Object.entries(distribution)
    .filter(([, count]) => typeof count === "number" && count > 0)
    .map(([key]) => Number(key))
    .filter((k) => Number.isFinite(k));

  if (keys.length === 0) return "emoji";

  if (keys.includes(0) || keys.some((k) => k > 5)) return "nps";

  const hasOnlyThumbsKeys =
    keys.length > 0 && keys.every((k) => k === 1 || k === 2);
  if (hasOnlyThumbsKeys && keys.length <= 2) return "thumbs";

  // Can't reliably distinguish emoji vs stars from distribution alone.
  return "emoji";
}

/**
 * Get the scale range for a rating variant.
 * Returns [min, max] inclusive.
 */
export function getRatingScale(variant: RatingVariant): [number, number] {
  switch (variant) {
    case "nps":
      return [0, 10];
    case "thumbs":
      return [1, 2];
    default:
      return [1, 5];
  }
}

/**
 * Get the scale size (number of options) for a rating variant.
 */
export function getRatingScaleSize(variant: RatingVariant): number {
  switch (variant) {
    case "nps":
      return 11; // 0-10
    case "thumbs":
      return 2; // 1-2
    default:
      return 5; // 1-5
  }
}

/**
 * Get the scale label for display (e.g., "av 5 mulige").
 */
export function getRatingScaleLabel(
  variant: RatingVariant,
  scale?: number,
): string {
  switch (variant) {
    case "nps":
      return "av 10 mulige";
    case "thumbs":
      return "positiv rate";
    case "stars":
      return `av ${scale || 5} stjerner`;
    default:
      return `av ${scale || 5} mulige`;
  }
}

/**
 * Get icon/emoji for a rating value based on variant.
 */
export function getRatingIcon(
  rating: number,
  variant: RatingVariant,
  _scale?: number,
): string {
  switch (variant) {
    case "thumbs":
      return rating >= 2 ? "👍" : "👎";

    case "stars": {
      // Return filled/empty stars based on rating
      const filled = Math.round(rating);
      return "⭐".repeat(filled) + "☆".repeat(5 - filled);
    }

    case "nps":
      // Avoid emojis for NPS (show numeric elsewhere)
      return "";

    default:
      // Standard 5-point emoji scale
      if (Number.isNaN(rating)) return "";
      if (rating < 1.5) return "😡";
      if (rating < 2.5) return "🙁";
      if (rating < 3.5) return "😐";
      if (rating < 4.5) return "😀";
      return "😍";
  }
}

/**
 * Get a single emoji for a rating value (for compact display).
 */
export function getRatingSingleIcon(
  rating: number,
  variant: RatingVariant,
): string {
  switch (variant) {
    case "thumbs":
      return rating >= 2 ? "👍" : "👎";

    case "stars":
      return "⭐";

    case "nps":
      // Avoid emojis for NPS (show numeric elsewhere)
      return "";

    default:
      if (Number.isNaN(rating)) return "";
      if (rating < 1.5) return "😡";
      if (rating < 2.5) return "🙁";
      if (rating < 3.5) return "😐";
      if (rating < 4.5) return "😀";
      return "😍";
  }
}

/**
 * Get the label for a rating value (for distribution charts).
 */
export function getRatingLabel(rating: number, variant: RatingVariant): string {
  switch (variant) {
    case "thumbs":
      return rating >= 2 ? "👍 Ja" : "👎 Nei";

    case "nps":
      return String(rating);

    default:
      return String(rating);
  }
}

/**
 * Get the NPS category for a score.
 */
export function getNpsCategory(
  score: number,
): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

/**
 * Get color for a rating value based on variant.
 */
export function getRatingColor(rating: number, variant: RatingVariant): string {
  switch (variant) {
    case "thumbs":
      return rating >= 2 ? "#22C55E" : "#EF4444"; // Green / Red

    case "nps": {
      const category = getNpsCategory(rating);
      switch (category) {
        case "promoter":
          return "#22C55E"; // Green
        case "passive":
          return "#EAB308"; // Yellow
        case "detractor":
          return "#EF4444"; // Red
      }
      break;
    }
    default:
      switch (rating) {
        case 5:
          return "#22C55E"; // Green
        case 4:
          return "#84CC16"; // Lime
        case 3:
          return "#EAB308"; // Yellow
        case 2:
          return "#F97316"; // Orange
        case 1:
          return "#EF4444"; // Red
        default:
          return "#9CA3AF";
      }
  }
  return "#9CA3AF";
}

/**
 * Format rating value for display based on variant.
 */
export function formatRatingValue(
  rating: number,
  variant: RatingVariant,
  scale?: number,
): string {
  switch (variant) {
    case "thumbs":
      return rating >= 2 ? "Ja" : "Nei";

    case "nps":
      return `${rating}/10`;

    case "stars":
      return `${rating}/${scale || 5}`;

    default:
      return `${rating}/${scale || 5}`;
  }
}

/**
 * Calculate the "positive rate" for thumbs variant.
 * Returns percentage of positive (thumbs up) responses.
 */
export function calculateThumbsPositiveRate(
  distribution: Record<string, number>,
): number {
  const thumbsUp = distribution["2"] || 0;
  const thumbsDown = distribution["1"] || 0;
  const total = thumbsUp + thumbsDown;
  return total > 0 ? (thumbsUp / total) * 100 : 0;
}

/**
 * Calculate NPS score from distribution.
 * NPS = %Promoters - %Detractors
 */
export function calculateNpsScore(
  distribution: Record<string, number>,
): number {
  let promoters = 0;
  let detractors = 0;
  let total = 0;

  for (const [scoreStr, count] of Object.entries(distribution)) {
    const score = Number.parseInt(scoreStr, 10);
    total += count;
    if (score >= 9) promoters += count;
    else if (score <= 6) detractors += count;
  }

  if (total === 0) return 0;
  return Math.round(((promoters - detractors) / total) * 100);
}
