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
