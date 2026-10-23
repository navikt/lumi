import type { QuestionTrendInterval } from "~/types/api";
import { todayInOslo } from "~/utils/dashboardPeriod";

/**
 * Calendar buckets for the time series. Dates are `YYYY-MM-DD` in Oslo time,
 * as the API returns them, and are computed in UTC so no local time zone or
 * daylight saving shift can move a date.
 */
export type TimeInterval = QuestionTrendInterval;

/** Periods up to this many days are shown per day. */
const MAX_DAYS_PER_DAY = 92;
/** Periods up to this many days are shown per ISO week. */
const MAX_DAYS_PER_WEEK = 731;

export interface TimeBucket {
  /** First day of the calendar bucket. */
  start: string;
  /** Last day of the calendar bucket. */
  end: string;
  /** First day of the bucket that is inside the period. */
  from: string;
  /** Last day of the bucket that is inside the period. */
  to: string;
  /** True when part of the bucket is outside the period. */
  partial: boolean;
}

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Some engines reject 2026-02-30 and others roll it over, so check both.
  const date = toUtcDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

/**
 * The last day of the period that can have answers: its end, or today when
 * the end is later, missing or not a date. The API reads such a period up
 * to now.
 */
function lastDay(toDate: string | undefined, today: string): string {
  return isCalendarDate(toDate) && toDate < today ? toDate : today;
}

function addDays(date: string, days: number): string {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toIsoDate(value);
}

/** Number of days from `from` to `to`, both included. */
function daysBetween(from: string, to: string): number {
  return (
    Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 864e5) +
    1
  );
}

/**
 * The resolution that keeps a period readable: per day up to 92 days, per
 * ISO week up to two years, and per month beyond that. Days after today have
 * no answers yet, so they do not count.
 */
export function chooseInterval(
  fromDate?: string,
  toDate?: string,
  today = todayInOslo(),
): TimeInterval {
  if (!isCalendarDate(fromDate)) return "day";
  const last = lastDay(toDate, today);
  if (last < fromDate) return "day";

  const days = daysBetween(fromDate, last);
  if (days <= MAX_DAYS_PER_DAY) return "day";
  if (days <= MAX_DAYS_PER_WEEK) return "week";
  return "month";
}

export function bucketStart(date: string, interval: TimeInterval): string {
  if (interval === "week") {
    const weekday = (toUtcDate(date).getUTCDay() + 6) % 7;
    return addDays(date, -weekday);
  }
  if (interval === "month") return `${date.slice(0, 7)}-01`;
  return date;
}

export function nextBucketStart(start: string, interval: TimeInterval): string {
  if (interval === "week") return addDays(start, 7);
  if (interval === "month") {
    const value = toUtcDate(start);
    value.setUTCMonth(value.getUTCMonth() + 1);
    return toIsoDate(value);
  }
  return addDays(start, 1);
}

/**
 * The calendar buckets that cover the period up to today, each clipped to
 * the period. Returns no buckets without a valid start.
 */
export function periodBuckets(
  fromDate: string | undefined,
  toDate: string | undefined,
  interval: TimeInterval,
  today = todayInOslo(),
): TimeBucket[] {
  if (!isCalendarDate(fromDate)) return [];
  const last = lastDay(toDate, today);
  if (last < fromDate) return [];

  const buckets: TimeBucket[] = [];
  for (
    let start = bucketStart(fromDate, interval);
    start <= last;
    start = nextBucketStart(start, interval)
  ) {
    const end = addDays(nextBucketStart(start, interval), -1);
    const from = start < fromDate ? fromDate : start;
    const to = end > last ? last : end;
    buckets.push({
      start,
      end,
      from,
      to,
      partial: from !== start || to !== end,
    });
  }
  return buckets;
}

/** ISO 8601 week, where the week belongs to the year of its Thursday. */
export function isoWeek(date: string): { week: number; year: number } {
  const thursday = addDays(bucketStart(date, "week"), 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDays(bucketStart(`${year}-01-04`, "week"), 3);
  return {
    week: 1 + Math.round((daysBetween(firstThursday, thursday) - 1) / 7),
    year,
  };
}

// Fixed names, since Node and the browsers abbreviate months differently.
const MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function monthName(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1] ?? date.slice(5, 7);
}

function dayMonth(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

function dayMonthYear(date: string): string {
  return `${dayMonth(date)}.${date.slice(0, 4)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The bucket's name in tooltips and tables. A bucket that is only partly
 * inside the period shows the days it covers, so a short last week is not
 * read as a drop.
 */
export function formatBucketLabel(
  bucket: TimeBucket,
  interval: TimeInterval,
): string {
  if (interval === "day") return dayMonthYear(bucket.start);

  const range =
    bucket.from === bucket.to
      ? dayMonth(bucket.from)
      : `${dayMonth(bucket.from)}–${dayMonth(bucket.to)}`;
  const coverage = bucket.partial
    ? ` (${daysBetween(bucket.from, bucket.to)} av ${daysBetween(bucket.start, bucket.end)} dager)`
    : "";

  if (interval === "week") {
    const { week, year } = isoWeek(bucket.start);
    return `Uke ${week}, ${year} · ${range}${coverage}`;
  }

  const month = `${capitalize(monthName(bucket.start))} ${bucket.start.slice(0, 4)}`;
  return bucket.partial ? `${month} · ${range}${coverage}` : month;
}

/**
 * The bucket's short name on the time axis. Days and weeks are named by
 * their first day in the period, with the year when the period spans more
 * than one calendar year. Months always have the year, since a period
 * shown per month spans more than two years.
 */
export function formatBucketTick(
  bucket: TimeBucket,
  interval: TimeInterval,
  withYear: boolean,
): string {
  if (interval === "month") {
    return `${monthName(bucket.start).slice(0, 3)} ${bucket.start.slice(0, 4)}`;
  }
  const date = interval === "week" ? bucket.from : bucket.start;
  return withYear ? `${dayMonth(date)}.${date.slice(2, 4)}` : dayMonth(date);
}

/**
 * Names the weeks or months that are only partly in the period and says how
 * the chart shows them, for example «Uke 41 og uke 43 er bare delvis med i
 * perioden og har lysere søyle.»
 */
export function describePartialBuckets(
  starts: string[],
  interval: TimeInterval,
  look: string,
): string | undefined {
  if (starts.length === 0 || interval === "day") return undefined;
  const names = starts.map((start) =>
    interval === "week"
      ? `uke ${isoWeek(start).week}`
      : `${monthName(start)} ${start.slice(0, 4)}`,
  );
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} og ${names.at(-1)}`;
  return `${capitalize(list ?? "")} er bare delvis med i perioden og har ${look}.`;
}

/** The latest of two `YYYY-MM-DD` dates. */
export function laterDate(a: string, b: string | undefined): string {
  return b && b > a ? b : a;
}

/** True when the buckets run over more than one calendar year. */
export function spansSeveralYears(buckets: TimeBucket[]): boolean {
  const first = buckets[0];
  const last = buckets.at(-1);
  return Boolean(
    first && last && first.from.slice(0, 4) !== last.to.slice(0, 4),
  );
}

/** The whole calendar bucket that starts on `start`. */
export function calendarBucket(
  start: string,
  interval: TimeInterval,
): TimeBucket {
  const end = addDays(nextBucketStart(start, interval), -1);
  return { start, end, from: start, to: end, partial: false };
}

export const INTERVAL_NOUNS: Record<
  TimeInterval,
  { one: string; many: string; rowHeader: string; this: string }
> = {
  day: { one: "dag", many: "dager", rowHeader: "Dato", this: "denne dagen" },
  week: { one: "uke", many: "uker", rowHeader: "Uke", this: "denne uka" },
  month: {
    one: "måned",
    many: "måneder",
    rowHeader: "Måned",
    this: "denne måneden",
  },
};
