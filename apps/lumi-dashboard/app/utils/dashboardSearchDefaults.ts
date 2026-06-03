import dayjs, { type Dayjs } from "dayjs";

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
  if (!hasFromDate && !hasToDate) {
    const end = options.now ?? dayjs();
    const start = end.subtract(29, "day");

    nextSearch.fromDate = start.format("YYYY-MM-DD");
    nextSearch.toDate = end.format("YYYY-MM-DD");
    nextSearch.page = "1";
    changed = true;
  }

  return { search: nextSearch, changed };
}
