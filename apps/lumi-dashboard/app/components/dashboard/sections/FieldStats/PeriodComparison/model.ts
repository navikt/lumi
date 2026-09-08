import type {
  ChoiceStats,
  FeedbackStats,
  FieldStat,
  RatingStats,
} from "~/types/api";
import {
  calculateNpsScore,
  calculateThumbsPositiveRate,
  normalizeRatingVariant,
  type RatingVariant,
} from "~/utils/ratingDisplay";

export interface RatingMetric {
  label: string;
  value: number;
  formatted: string;
  unit: "poeng" | "prosentpoeng" | "NPS-poeng";
  min: number;
  max: number;
  variant: RatingVariant | "unknown";
}

export function usableComparisonStats(
  data: FeedbackStats | undefined,
  isError: boolean,
): FeedbackStats | undefined {
  return isError || data?.privacy?.masked ? undefined : data;
}

export function ratingResponseCount(field: FieldStat | undefined) {
  if (!field || field.fieldType !== "RATING") return 0;
  const stats = field.stats as RatingStats;
  return Object.values(stats.distribution).reduce(
    (sum, count) => sum + count,
    0,
  );
}

export function choiceResponseCount(
  field: FieldStat | undefined,
  totalCount: number,
) {
  if (
    !field ||
    (field.fieldType !== "SINGLE_CHOICE" && field.fieldType !== "MULTI_CHOICE")
  ) {
    return 0;
  }

  const stats = field.stats as ChoiceStats;
  const selectionSum = Object.values(stats.distribution).reduce(
    (sum, choice) => sum + choice.count,
    0,
  );
  const totalSelections = stats.totalSelections ?? selectionSum;
  return (
    stats.responseCount ??
    (field.fieldType === "MULTI_CHOICE"
      ? Math.min(totalSelections, totalCount)
      : totalSelections)
  );
}

export function getRatingMetric(
  field: FieldStat,
  forcedVariant?: RatingVariant,
): RatingMetric {
  const stats = field.stats as RatingStats;
  const distribution = stats.distribution as Record<string, number>;
  const explicitVariant =
    normalizeRatingVariant(stats.ratingVariant) ??
    (stats.ratingScale === 2
      ? "thumbs"
      : stats.ratingScale === 11
        ? "nps"
        : stats.ratingScale === 5
          ? "emoji"
          : undefined);
  const variant = forcedVariant ?? explicitVariant ?? "unknown";

  if (variant === "unknown")
    return {
      label: "Gjennomsnitt",
      value: stats.average,
      formatted: stats.average.toLocaleString("nb-NO", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      unit: "poeng",
      min: 0,
      max: 0,
      variant,
    };

  if (variant === "thumbs") {
    const value = calculateThumbsPositiveRate(distribution);
    return {
      label: "Andel positive",
      value,
      formatted: `${Math.round(value)} % positive`,
      unit: "prosentpoeng",
      min: 0,
      max: 100,
      variant,
    };
  }

  if (variant === "nps") {
    const value = calculateNpsScore(distribution);
    return {
      label: "NPS",
      value,
      formatted: `${formatSigned(value, 0)} NPS`,
      unit: "NPS-poeng",
      min: -100,
      max: 100,
      variant,
    };
  }

  return {
    label: "Gjennomsnitt",
    value: stats.average,
    formatted: `${stats.average.toLocaleString("nb-NO", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} av 5`,
    unit: "poeng",
    min: 1,
    max: 5,
    variant,
  };
}

function getRatingScale(field: FieldStat, variant: RatingVariant) {
  const explicitScale = (field.stats as RatingStats).ratingScale;

  return (
    explicitScale ?? (variant === "nps" ? 11 : variant === "thumbs" ? 2 : 5)
  );
}

export function ratingFieldsAreComparable(
  current: FieldStat,
  previous: FieldStat,
) {
  if (current.fieldType !== "RATING" || previous.fieldType !== "RATING") {
    return false;
  }

  const currentVariant = getRatingMetric(current).variant;
  const previousVariant = getRatingMetric(previous).variant;

  return (
    currentVariant !== "unknown" &&
    previousVariant !== "unknown" &&
    currentVariant === previousVariant &&
    getRatingScale(current, currentVariant) ===
      getRatingScale(previous, previousVariant)
  );
}

export function formatSigned(value: number, digits = 1) {
  const roundedValue = Number(value.toFixed(digits));
  const rounded = Object.is(roundedValue, -0) ? 0 : roundedValue;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toLocaleString("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
