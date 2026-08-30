import type {
  QuestionTrendBucket,
  QuestionTrendInterval,
  QuestionTrendResponse,
} from "~/types/api";

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
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
