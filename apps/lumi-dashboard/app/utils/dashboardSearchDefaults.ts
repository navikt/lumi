import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const OSLO_TIME_ZONE = "Europe/Oslo";

type Search = Record<string, unknown>;

type DashboardSearchDefaultsOptions = {
  now?: Dayjs;
};

type DashboardSearchDefaultsResult = {
  search: Search;
  changed: boolean;
};

function hasSearchValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function applyDashboardSearchDefaults(
  currentSearch: Search | undefined,
  options: DashboardSearchDefaultsOptions = {},
): DashboardSearchDefaultsResult {
  const nextSearch: Search = { ...(currentSearch ?? {}) };
  let changed = false;

  // «Fra første svar» has no start and ends today in Oslo, also after
  // midnight. No other period is relative, so another one gets the default.
  if (nextSearch.dateMode === "relative") {
    if (nextSearch.periodPreset === "sinceFirst") {
      const today = (options.now ?? dayjs())
        .tz(OSLO_TIME_ZONE)
        .format("YYYY-MM-DD");
      // Also a blank start, so the address loses it.
      const hadStart = nextSearch.fromDate !== undefined;
      delete nextSearch.fromDate;
      if (hadStart || nextSearch.toDate !== today) {
        nextSearch.toDate = today;
        changed = true;
      }
      return { search: nextSearch, changed };
    }
    delete nextSearch.dateMode;
    delete nextSearch.periodPreset;
    delete nextSearch.fromDate;
    delete nextSearch.toDate;
    changed = true;
  } else if (nextSearch.periodPreset === "sinceFirst") {
    // The preset belongs to the relative period.
    delete nextSearch.periodPreset;
    changed = true;
  }

  const hasFromDate = hasSearchValue(nextSearch.fromDate);
  const hasToDate = hasSearchValue(nextSearch.toDate);
  const hasDateMode =
    nextSearch.dateMode === "auto" || nextSearch.dateMode === "fixed";

  if ((hasFromDate || hasToDate) && !hasDateMode) {
    nextSearch.dateMode = "fixed";
    changed = true;
  }

  const needsAutomaticRange =
    (!hasFromDate && !hasToDate) ||
    (nextSearch.dateMode === "auto" &&
      (!hasFromDate || !hasToDate || !hasSearchValue(nextSearch.surveyId)));

  if (needsAutomaticRange) {
    const end = (options.now ?? dayjs()).tz(OSLO_TIME_ZONE);
    const start = end.subtract(29, "day");
    const resolvedFromDate = start.format("YYYY-MM-DD");
    const resolvedToDate = end.format("YYYY-MM-DD");

    if (
      nextSearch.dateMode !== "auto" ||
      nextSearch.fromDate !== resolvedFromDate ||
      nextSearch.toDate !== resolvedToDate
    ) {
      nextSearch.dateMode = "auto";
      nextSearch.fromDate = resolvedFromDate;
      nextSearch.toDate = resolvedToDate;
      nextSearch.page = "1";
      changed = true;
    }
  }

  return { search: nextSearch, changed };
}
