import type {
  QuestionTrendBucket,
  QuestionTrendInterval,
  QuestionTrendResponse,
} from "~/types/api";
import {
  calculateNpsScore,
  calculateThumbsPositiveRate,
  normalizeRatingVariant,
} from "~/utils/ratingDisplay";

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

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
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
) {
  return buckets.map((bucket) => ({
    label: formatQuestionTrendBucket(bucket.startDate, trend.interval),
    average:
      trend.fieldType === "RATING"
        ? questionTrendRatingValue(trend, bucket)
        : undefined,
    values: trend.options.map((option) =>
      questionTrendChoiceValue(bucket, option.id, measure),
    ),
  }));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addCalendarUnit(
  date: string,
  interval: QuestionTrendInterval,
): string {
  const value = toUtcDate(date);
  if (interval === "day") value.setUTCDate(value.getUTCDate() + 1);
  if (interval === "week") value.setUTCDate(value.getUTCDate() + 7);
  if (interval === "month") value.setUTCMonth(value.getUTCMonth() + 1);
  return toIsoDate(value);
}

function startOfIsoWeek(date: string): string {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return toIsoDate(value);
}

function bucketStart(date: string, interval: QuestionTrendInterval): string {
  if (interval === "week") return startOfIsoWeek(date);
  if (interval === "month") return `${date.slice(0, 7)}-01`;
  return date;
}

export function fillQuestionTrendBuckets(
  trend: QuestionTrendResponse,
  fromDate?: string,
  toDate?: string,
): QuestionTrendBucket[] {
  if (!fromDate || !toDate || fromDate > toDate) return trend.buckets;

  const byDate = new Map(
    trend.buckets.map((bucket) => [bucket.startDate, bucket]),
  );
  const first = bucketStart(fromDate, trend.interval);
  const last = bucketStart(toDate, trend.interval);
  const result: QuestionTrendBucket[] = [];

  for (
    let cursor = first;
    cursor <= last;
    cursor = addCalendarUnit(cursor, trend.interval)
  ) {
    result.push(
      byDate.get(cursor) ?? {
        startDate: cursor,
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

  return result;
}

function isoWeekNumber(date: string): number {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + 3 - ((value.getUTCDay() + 6) % 7));
  const weekOne = new Date(Date.UTC(value.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((value.getTime() - weekOne.getTime()) / 86_400_000 -
        3 +
        ((weekOne.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

const MONTH_FORMAT = new Intl.DateTimeFormat("nb-NO", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatQuestionTrendBucket(
  startDate: string,
  interval: QuestionTrendInterval,
): string {
  const value = toUtcDate(startDate);
  if (interval === "month") {
    const formatted = MONTH_FORMAT.format(value).replace(".", "");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  if (interval === "week") {
    const end = toUtcDate(startDate);
    end.setUTCDate(end.getUTCDate() + 6);
    const startLabel = `${String(value.getUTCDate()).padStart(2, "0")}.${String(
      value.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    const endLabel = `${String(end.getUTCDate()).padStart(2, "0")}.${String(
      end.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    return `Uke ${isoWeekNumber(startDate)} · ${startLabel}–${endLabel}`;
  }
  return `${String(value.getUTCDate()).padStart(2, "0")}.${String(
    value.getUTCMonth() + 1,
  ).padStart(2, "0")}.${value.getUTCFullYear()}`;
}
