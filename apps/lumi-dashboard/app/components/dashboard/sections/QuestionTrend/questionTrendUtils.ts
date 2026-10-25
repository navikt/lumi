import type { QuestionTrendBucket, QuestionTrendResponse } from "~/types/api";
import {
  calculateNpsScore,
  calculateThumbsPositiveRate,
  normalizeRatingVariant,
} from "~/utils/ratingDisplay";
import type { AxisBucket, TimeAxis, TimeInterval } from "~/utils/timeBuckets";

export function questionTrendRatingMetric(
  trend: Pick<QuestionTrendResponse, "ratingVariant" | "ratingScale">,
) {
  const variant =
    normalizeRatingVariant(trend.ratingVariant) ??
    (trend.ratingScale === 11
      ? "nps"
      : trend.ratingScale === 2
        ? "thumbs"
        : trend.ratingScale === 5
          ? "emoji"
          : "unknown");
  return {
    variant,
    label:
      variant === "nps"
        ? "NPS"
        : variant === "thumbs"
          ? "Andel positive"
          : "Gjennomsnitt",
    domain:
      variant === "nps"
        ? [-100, 100]
        : variant === "thumbs"
          ? [0, 100]
          : variant === "unknown"
            ? ["auto", "auto"]
            : [1, 5],
    unit: variant === "thumbs" ? "%" : undefined,
  };
}

export function questionTrendRatingValue(
  trend: Pick<QuestionTrendResponse, "ratingVariant" | "ratingScale">,
  bucket: QuestionTrendBucket,
): number | null {
  if (bucket.masked || !bucket.responseCount) return null;
  const { variant } = questionTrendRatingMetric(trend);
  if (variant !== "nps" && variant !== "thumbs") return bucket.average ?? null;
  const distribution = bucket.ratingDistribution;
  if (
    !distribution ||
    Object.values(distribution).reduce((sum, count) => sum + count, 0) === 0
  )
    return null;
  return variant === "nps"
    ? calculateNpsScore(distribution)
    : calculateThumbsPositiveRate(distribution);
}

export function questionTrendChoiceValue(
  bucket: QuestionTrendBucket,
  optionId: string,
  measure: "count" | "percentage",
): number | null {
  if (bucket.masked || (measure === "percentage" && !bucket.responseCount))
    return null;
  return bucket.distribution[optionId]?.[measure] ?? 0;
}

export interface QuestionPoint extends AxisBucket {
  bucket: QuestionTrendBucket;
}

export interface QuestionSeries {
  interval: TimeInterval;
  withYear: boolean;
  points: QuestionPoint[];
}

/**
 * One point per bucket on the axis. Buckets the API has no answers for get
 * zero answers and keep their place on the time axis.
 */
export function questionSeries(
  axis: TimeAxis,
  trend: QuestionTrendResponse,
): QuestionSeries {
  const byStart = new Map(
    trend.buckets.map((bucket) => [bucket.startDate, bucket]),
  );
  return {
    interval: axis.interval,
    withYear: axis.withYear,
    points: axis.buckets.map((axisBucket) => ({
      ...axisBucket,
      bucket: byStart.get(axisBucket.start) ?? {
        startDate: axisBucket.start,
        masked: false,
        responseCount: 0,
        distribution: Object.fromEntries(
          trend.options.map((option) => [
            option.id,
            { count: 0, percentage: 0 },
          ]),
        ),
      },
    })),
  };
}

/** The chart's rows: one per point, with a value per line. */
export function questionTrendChartData(
  trend: QuestionTrendResponse,
  points: QuestionPoint[],
  measure: "count" | "percentage",
) {
  return points.map((point) => ({
    start: point.start,
    tick: point.tick,
    label: point.label,
    partial: point.partial,
    average:
      trend.fieldType === "RATING"
        ? questionTrendRatingValue(trend, point.bucket)
        : undefined,
    values: trend.options.map((option) =>
      questionTrendChoiceValue(point.bucket, option.id, measure),
    ),
  }));
}

/** True when the chart draws a point for the bucket. */
export function questionPointHasValue(
  trend: QuestionTrendResponse,
  bucket: QuestionTrendBucket,
  measure: "count" | "percentage",
): boolean {
  if (trend.fieldType === "RATING") {
    return questionTrendRatingValue(trend, bucket) !== null;
  }
  return trend.options.some(
    (option) => questionTrendChoiceValue(bucket, option.id, measure) !== null,
  );
}

/** Lower case in a sentence, except for names in capitals such as NPS. */
export function inSentence(label: string): string {
  return label === label.toUpperCase() ? label : label.toLowerCase();
}
