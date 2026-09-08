import dayjs from "dayjs";
import { todayInOslo } from "~/utils/dashboardPeriod";
import type { ComparisonPeriod } from "./types";

export type ComparisonMode = "previous" | "none";

function calendarDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = dayjs(value);
  return date.isValid() && date.format("YYYY-MM-DD") === value
    ? date
    : undefined;
}

function period(from: dayjs.Dayjs, to: dayjs.Dayjs): ComparisonPeriod {
  const format = (date: dayjs.Dayjs) =>
    new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(date.year(), date.month(), date.date(), 12)));
  return {
    fromDate: from.format("YYYY-MM-DD"),
    toDate: to.format("YYYY-MM-DD"),
    label: from.isSame(to, "day")
      ? format(from)
      : `${format(from)}–${format(to)}`,
  };
}

export function getComparisonPeriods(
  fromDate?: string,
  toDate?: string,
  mode?: ComparisonMode,
  today = todayInOslo(),
  preset?: "rolling" | "yearToDate" | "custom",
) {
  const from = calendarDate(fromDate);
  const to = calendarDate(toDate);
  const now = calendarDate(today);
  if (!from || !to || !now || to.isBefore(from, "day")) return undefined;
  const days = to.diff(from, "day") + 1;
  const effectiveMode = mode ?? "previous";
  let previousTo = from.subtract(1, "day");
  let previousFrom = previousTo.subtract(days - 1, "day");
  let previousLabel = `Foregående ${days} ${days === 1 ? "dag" : "dager"}`;

  if (
    preset !== "rolling" &&
    from.isSame(from.startOf("year"), "day") &&
    to.isSame(from.endOf("year"), "day")
  ) {
    previousFrom = from.subtract(1, "year");
    previousTo = previousFrom.endOf("year");
    previousLabel = "Forrige år";
  } else if (
    preset !== "rolling" &&
    from.date() === 1 &&
    to.isSame(to.endOf("month"), "day")
  ) {
    const months = to.startOf("month").diff(from, "month") + 1;
    previousFrom = from.subtract(months, "month");
    previousLabel =
      months === 1 ? "Forrige måned" : `Foregående ${months} måneder`;
  } else if (from.day() === 1 && to.day() === 0 && days === 7) {
    previousLabel = "Forrige uke";
  }

  return {
    current: period(from, to),
    previous: period(previousFrom, previousTo),
    mode: effectiveMode,
    previousLabel,
    label: previousLabel,
    currentDays: days,
    previousDays: previousTo.diff(previousFrom, "day") + 1,
    incomplete: !to.isBefore(now, "day"),
    includesToday: !from.isAfter(now, "day") && !to.isBefore(now, "day"),
    hasFutureDates: to.isAfter(now, "day"),
  };
}
