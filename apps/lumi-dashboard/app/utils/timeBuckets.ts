import type { QuestionTrendInterval } from "~/types/api";

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
/**
 * A safety net for a resolution the viewer chose over a window far longer
 * than Lumi keeps answers for. The most recent buckets are kept.
 */
const MAX_BUCKETS = 1500;

/**
 * A day, ISO week or month on the time axis. The field names stay clear of
 * SVG attributes such as `from`, `to` and `end`, since recharts passes a
 * data point's fields on to the shapes it draws.
 */
export interface TimeBucket {
  /** First day of the calendar bucket, also its key. */
  start: string;
  /** Last day of the calendar bucket. */
  calendarEnd: string;
  /** First day of the bucket that is inside the window. */
  firstDay: string;
  /** Last day of the bucket that is inside the window. */
  lastDay: string;
  /** True when part of the bucket is outside the window. */
  partial: boolean;
}

/** A bucket with its names on the axis and in tooltips and tables. */
export interface AxisBucket extends TimeBucket {
  tick: string;
  label: string;
}

/** The days a time series shows. */
export interface SeriesWindow {
  from: string;
  to: string;
}

/** A window with the resolution chosen for it. */
export interface ResolvedSeries {
  window: SeriesWindow;
  interval: TimeInterval;
}

/** How a chart draws a partial bucket, for one bucket and for several. */
export interface PartialLook {
  one: string;
  many: string;
}

export interface TimeAxis {
  interval: TimeInterval;
  /** True when the buckets run over more than one calendar year. */
  withYear: boolean;
  buckets: AxisBucket[];
}

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * True for a real date in this century. Lumi has no answers outside it, and
 * dates before year 1000 do not survive the conversion to ISO strings.
 */
export function isCalendarDate(value: string | null | undefined): boolean {
  if (!value || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  // Some engines reject 2026-02-30, others roll it over to 2 March.
  const date = toUtcDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

function addDays(date: string, days: number): string {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toIsoDate(value);
}

/** Number of days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): number {
  return (
    Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 864e5) +
    1
  );
}

/** The earliest `YYYY-MM-DD` date, without sorting. */
export function earliestDate(dates: Iterable<string>): string | undefined {
  let earliest: string | undefined;
  for (const date of dates) {
    if (earliest === undefined || date < earliest) earliest = date;
  }
  return earliest;
}

/** The latest `YYYY-MM-DD` date, without sorting. */
export function latestDate(dates: Iterable<string>): string | undefined {
  let latest: string | undefined;
  for (const date of dates) {
    if (latest === undefined || date > latest) latest = date;
  }
  return latest;
}

/** The later of two `YYYY-MM-DD` dates. */
export function laterDate(a: string, b: string | undefined): string {
  return b && b > a ? b : a;
}

/**
 * The days a time series shows, and the resolution for them. The window runs
 * from the period's start to its end, but never past today.
 *
 * Answers before the retention start are deleted. The window starts there at
 * the earliest, or at the oldest answer left when that is older. Without a
 * start, the window begins with the bucket of the first answer, as no answers
 * came before it. It still never begins before that floor, since answers in
 * the bucket may have been deleted.
 *
 * Returns nothing when there is no start or the period has not begun.
 */
export function resolveSeriesWindow({
  fromDate,
  toDate,
  today,
  firstDataDay,
  retentionStartDate,
}: {
  fromDate?: string | null;
  toDate?: string | null;
  today: string;
  firstDataDay?: string;
  retentionStartDate?: string | null;
}): ResolvedSeries | undefined {
  const firstAnswer = isCalendarDate(firstDataDay) ? firstDataDay : undefined;
  const openStart = !isCalendarDate(fromDate);
  const start = openStart ? firstAnswer : (fromDate as string);
  if (!start) return undefined;
  const floor = isCalendarDate(retentionStartDate)
    ? earliestDate([
        retentionStartDate as string,
        ...(firstAnswer ? [firstAnswer] : []),
      ])
    : undefined;
  const from = laterDate(start, floor);
  const to =
    isCalendarDate(toDate) && (toDate as string) < today
      ? (toDate as string)
      : today;
  if (to < from) return undefined;

  const interval = chooseInterval({ from, to });
  return {
    window: {
      from: openStart ? laterDate(bucketStart(from, interval), floor) : from,
      to,
    },
    interval,
  };
}

/**
 * The resolution that keeps a window readable: per day up to 92 days, per
 * ISO week up to two years, and per month beyond that. Without a window the
 * resolution is per week.
 */
export function chooseInterval(window: SeriesWindow | undefined): TimeInterval {
  if (!window) return "week";
  const days = daysBetween(window.from, window.to);
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

function nextBucketStart(start: string, interval: TimeInterval): string {
  if (interval === "week") return addDays(start, 7);
  if (interval === "month") {
    const value = toUtcDate(start);
    value.setUTCMonth(value.getUTCMonth() + 1);
    return toIsoDate(value);
  }
  return addDays(start, 1);
}

function previousBucketStart(start: string, interval: TimeInterval): string {
  if (interval === "week") return addDays(start, -7);
  if (interval === "month") {
    const value = toUtcDate(start);
    value.setUTCMonth(value.getUTCMonth() - 1);
    return toIsoDate(value);
  }
  return addDays(start, -1);
}

/** The calendar buckets that cover the window, each clipped to it. */
function windowBuckets(
  window: SeriesWindow,
  interval: TimeInterval,
): TimeBucket[] {
  // Walking back from the end makes the safety net keep the latest buckets.
  const buckets: TimeBucket[] = [];
  for (
    let start = bucketStart(window.to, interval);
    start >= bucketStart(window.from, interval) && buckets.length < MAX_BUCKETS;
    start = previousBucketStart(start, interval)
  ) {
    const calendarEnd = addDays(nextBucketStart(start, interval), -1);
    const firstDay = start < window.from ? window.from : start;
    const lastDay = calendarEnd > window.to ? window.to : calendarEnd;
    buckets.push({
      start,
      calendarEnd,
      firstDay,
      lastDay,
      partial: firstDay !== start || lastDay !== calendarEnd,
    });
  }
  return buckets.reverse();
}

/** ISO 8601 week, where the week belongs to the year of its Thursday. */
export function isoWeek(date: string): { week: number; year: number } {
  const thursday = addDays(bucketStart(date, "week"), 3);
  const year = thursday.slice(0, 4);
  const firstThursday = addDays(bucketStart(`${year}-01-04`, "week"), 3);
  return {
    week: 1 + Math.round((daysBetween(firstThursday, thursday) - 1) / 7),
    year: Number(year),
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

/** How many of the bucket's days are in the window, such as «4 av 7 dager». */
function coverage(bucket: TimeBucket): string {
  return `${daysBetween(bucket.firstDay, bucket.lastDay)} av ${daysBetween(bucket.start, bucket.calendarEnd)} dager`;
}

/**
 * The bucket's name in tooltips and tables. A bucket that is only partly
 * inside the window shows the days it covers. A short last week would
 * otherwise look like a drop.
 */
export function formatBucketLabel(
  bucket: TimeBucket,
  interval: TimeInterval,
): string {
  if (interval === "day") return dayMonthYear(bucket.start);

  const range =
    bucket.firstDay === bucket.lastDay
      ? dayMonth(bucket.firstDay)
      : `${dayMonth(bucket.firstDay)}–${dayMonth(bucket.lastDay)}`;
  const days = bucket.partial ? ` (${coverage(bucket)})` : "";

  if (interval === "week") {
    const { week, year } = isoWeek(bucket.start);
    return `Uke ${week}, ${year} · ${range}${days}`;
  }

  const month = `${capitalize(monthName(bucket.start))} ${bucket.start.slice(0, 4)}`;
  return bucket.partial ? `${month} · ${range}${days}` : month;
}

/**
 * The bucket's short name on the time axis. Days and weeks are named by
 * their first day in the window, with the year when the window spans more
 * than one calendar year. Months always have the year.
 */
function formatBucketTick(
  bucket: TimeBucket,
  interval: TimeInterval,
  withYear: boolean,
): string {
  if (interval === "month") {
    return `${monthName(bucket.start).slice(0, 3)} ${bucket.start.slice(0, 4)}`;
  }
  const date = interval === "week" ? bucket.firstDay : bucket.start;
  return withYear ? `${dayMonth(date)}.${date.slice(2, 4)}` : dayMonth(date);
}

/** The buckets of a window with their names, ready for a chart. */
export function buildTimeAxis(
  window: SeriesWindow,
  interval: TimeInterval,
): TimeAxis {
  const buckets = windowBuckets(window, interval);
  const first = buckets[0];
  const last = buckets.at(-1);
  const withYear = Boolean(
    first && last && first.firstDay.slice(0, 4) !== last.lastDay.slice(0, 4),
  );
  return {
    interval,
    withYear,
    buckets: buckets.map((bucket) => ({
      ...bucket,
      tick: formatBucketTick(bucket, interval, withYear),
      label: formatBucketLabel(bucket, interval),
    })),
  };
}

/** Day counts summed per bucket, keyed by the bucket's first day. */
export function sumByBucket(
  byDay: Record<string, number>,
  interval: TimeInterval,
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const [day, count] of Object.entries(byDay)) {
    if (!isCalendarDate(day)) continue;
    const key = bucketStart(day, interval);
    sums.set(key, (sums.get(key) ?? 0) + count);
  }
  return sums;
}

/**
 * Names the weeks or months that are only partly in the window, with how
 * many of their days the chart has, and says how the chart draws them. For
 * example: «Bare 5 av 7 dager i uke 1 og 4 av 7 dager i uke 43 er med i
 * grafen. Ukene har hule prikker.»
 *
 * Weeks get their year when the window spans several years, and when a
 * week's days lie in another year than the ISO week, as 29.12.2025 does in
 * week 1 of 2026.
 */
export function describePartialBuckets(
  buckets: TimeBucket[],
  interval: TimeInterval,
  look: PartialLook,
  withYear: boolean,
): string | undefined {
  if (buckets.length === 0 || interval === "day") return undefined;
  const several = buckets.length > 1;

  let parts: string[];
  let subject: string;
  if (interval === "month") {
    parts = buckets.map(
      (bucket) =>
        `${coverage(bucket)} i ${monthName(bucket.start)} ${bucket.start.slice(0, 4)}`,
    );
    subject = several ? "Månedene" : "Måneden";
  } else {
    const weeks = buckets.map((bucket) => ({
      bucket,
      ...isoWeek(bucket.start),
    }));
    const showYear =
      withYear ||
      weeks.some(
        ({ bucket, year }) =>
          bucket.firstDay.slice(0, 4) !== String(year) ||
          bucket.lastDay.slice(0, 4) !== String(year),
      );
    parts = weeks.map(
      ({ bucket, week, year }) =>
        `${coverage(bucket)} i uke ${week}${showYear ? ` i ${year}` : ""}`,
    );
    subject = several ? "Ukene" : "Uka";
  }

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} og ${parts.at(-1)}`;
  return `Bare ${list} er med i grafen. ${subject} har ${several ? look.many : look.one}.`;
}

/**
 * How many days, weeks or months the bucket of `to` comes after the bucket
 * of `from`. Computed in UTC, as the rest of this file.
 */
export function bucketDistance(
  from: string,
  to: string,
  interval: TimeInterval,
): number {
  if (interval === "month") {
    return (
      (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
      Number(to.slice(5, 7)) -
      Number(from.slice(5, 7))
    );
  }
  const days =
    daysBetween(bucketStart(from, interval), bucketStart(to, interval)) - 1;
  return interval === "week" ? Math.round(days / 7) : days;
}

export const INTERVAL_NOUNS: Record<
  TimeInterval,
  { one: string; many: string; rowHeader: string }
> = {
  day: { one: "dag", many: "dager", rowHeader: "Dato" },
  week: { one: "uke", many: "uker", rowHeader: "Uke" },
  month: { one: "måned", many: "måneder", rowHeader: "Måned" },
};
