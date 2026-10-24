import type {
  QuestionTrendBucket,
  QuestionTrendInterval,
  QuestionTrendResponse,
} from "~/types/api";
import { todayInOslo } from "~/utils/dashboardPeriod";
import {
  calculateNpsScore,
  calculateThumbsPositiveRate,
  normalizeRatingVariant,
} from "~/utils/ratingDisplay";
import {
  calendarBucket,
  formatBucketLabel,
  laterDate,
  periodBuckets,
  type TimeBucket,
} from "~/utils/timeBuckets";

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

export function questionTrendChartData(
  trend: QuestionTrendResponse,
  buckets: QuestionTrendBucket[],
  measure: "count" | "percentage",
  labelFor: (startDate: string) => string = (startDate) =>
    formatQuestionTrendBucket(startDate, trend.interval),
) {
  return buckets.map((bucket) => ({
    start: bucket.startDate,
    label: labelFor(bucket.startDate),
    average:
      trend.fieldType === "RATING"
        ? questionTrendRatingValue(trend, bucket)
        : undefined,
    values: trend.options.map((option) =>
      questionTrendChoiceValue(bucket, option.id, measure),
    ),
  }));
}

/**
 * The calendar days, weeks or months of the period up to today. Answers
 * dated after the browser's today still count, in case its clock is behind.
 */
export function questionTrendPeriodBuckets(
  trend: QuestionTrendResponse,
  fromDate?: string,
  toDate?: string,
  today = todayInOslo(),
): TimeBucket[] {
  const latest = trend.buckets
    .map((bucket) => bucket.startDate)
    .sort()
    .at(-1);
  return periodBuckets(
    fromDate,
    toDate,
    trend.interval,
    laterDate(today, latest),
  );
}

/**
 * One bucket per calendar day, week or month in the period, up to today.
 * Empty buckets get zero answers, so the time axis stays even.
 */
export function fillQuestionTrendBuckets(
  trend: QuestionTrendResponse,
  fromDate?: string,
  toDate?: string,
  today?: string,
): QuestionTrendBucket[] {
  const buckets = questionTrendPeriodBuckets(trend, fromDate, toDate, today);
  if (buckets.length === 0) return trend.buckets;

  const byDate = new Map(
    trend.buckets.map((bucket) => [bucket.startDate, bucket]),
  );
  return buckets.map(
    ({ start }) =>
      byDate.get(start) ?? {
        startDate: start,
        masked: false,
        responseCount: 0,
        distribution: Object.fromEntries(
          trend.options.map((option) => [
            option.id,
            { count: 0, percentage: 0 },
          ]),
        ),
      },
  );
}

/** The whole bucket's name, for buckets without a period to clip them. */
export function formatQuestionTrendBucket(
  startDate: string,
  interval: QuestionTrendInterval,
): string {
  return formatBucketLabel(calendarBucket(startDate, interval), interval);
}
