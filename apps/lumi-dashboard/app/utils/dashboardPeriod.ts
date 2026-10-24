import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const OSLO_TIME_ZONE = "Europe/Oslo";

export function todayInOslo() {
  return dayjs().tz(OSLO_TIME_ZONE).format("YYYY-MM-DD");
}

export type DashboardDateMode = "auto" | "fixed";

export interface DashboardPeriod {
  dateMode: DashboardDateMode;
  fromDate?: string;
  toDate?: string;
  surveyPeriod?: {
    fromDate: string;
    toDate: string;
  };
  isOutsideSurveyPeriod?: boolean;
}

export interface SurveyPeriodMetadata {
  archivedAt?: string | null;
  firstSubmissionAt?: string | null;
  lastSubmissionAt?: string | null;
}

/** Whole days in Oslo, both dates included. */
export interface DateRange {
  fromDate: string;
  toDate: string;
}

/** The parts of the filter bootstrap that describe when surveys had answers. */
interface SurveyMetaSource {
  surveyMeta?: Record<string, SurveyPeriodMetadata>;
  surveyMetaByApp?: Record<string, Record<string, SurveyPeriodMetadata>>;
}

interface TeamSubmissionPeriodOptions {
  includeArchived?: boolean;
}

interface ResolveDashboardPeriodInput {
  dateMode?: DashboardDateMode;
  fromDate?: string;
  toDate?: string;
  surveyMeta?: SurveyPeriodMetadata;
  now?: Date;
}

function toOsloDate(timestamp: string | null | undefined) {
  if (!timestamp) return undefined;
  const date = dayjs(timestamp).tz(OSLO_TIME_ZONE);
  return date.isValid() ? date : undefined;
}

function getSurveyPeriod(surveyMeta: SurveyPeriodMetadata | undefined) {
  const first = toOsloDate(surveyMeta?.firstSubmissionAt);
  const last = toOsloDate(surveyMeta?.lastSubmissionAt);
  if (!first || !last || first.isAfter(last, "day")) return undefined;

  return {
    fromDate: first.format("YYYY-MM-DD"),
    toDate: last.format("YYYY-MM-DD"),
  };
}

export function resolveDashboardPeriod({
  dateMode,
  fromDate,
  toDate,
  surveyMeta,
  now = new Date(),
}: ResolveDashboardPeriodInput = {}): DashboardPeriod {
  const hasExplicitDate = Boolean(fromDate || toDate);
  const resolvedMode =
    hasExplicitDate && (dateMode === "fixed" || !dateMode) ? "fixed" : "auto";

  const surveyPeriod = getSurveyPeriod(surveyMeta);

  if (resolvedMode === "fixed") {
    const isOutsideSurveyPeriod = surveyPeriod
      ? Boolean(
          (toDate && toDate < surveyPeriod.fromDate) ||
            (fromDate && fromDate > surveyPeriod.toDate),
        )
      : undefined;

    return {
      dateMode: resolvedMode,
      fromDate,
      toDate,
      ...(surveyPeriod && { surveyPeriod, isOutsideSurveyPeriod }),
    };
  }

  const latestSubmission = toOsloDate(surveyMeta?.lastSubmissionAt);
  const end = latestSubmission?.isValid()
    ? latestSubmission
    : dayjs(now).tz(OSLO_TIME_ZONE);
  const defaultStart = end.subtract(29, "day");
  const firstSubmission = toOsloDate(surveyMeta?.firstSubmissionAt);
  const start =
    firstSubmission?.isValid() &&
    !firstSubmission.isAfter(end, "day") &&
    firstSubmission.isAfter(defaultStart, "day")
      ? firstSubmission
      : defaultStart;

  return {
    dateMode: "auto",
    fromDate: start.format("YYYY-MM-DD"),
    toDate: end.format("YYYY-MM-DD"),
  };
}

/**
 * The span from the team's first to its last registered submission across
 * surveys visible under the current archive filter. Used by empty states to
 * offer "show the full survey period" when the current period has no hits.
 */
export function getTeamSubmissionPeriod(
  surveyMeta: Record<string, SurveyPeriodMetadata> | undefined,
  { includeArchived = false }: TeamSubmissionPeriodOptions = {},
): { fromDate: string; toDate: string } | undefined {
  if (!surveyMeta) return undefined;

  let first: dayjs.Dayjs | undefined;
  let last: dayjs.Dayjs | undefined;

  for (const meta of Object.values(surveyMeta)) {
    if (!includeArchived && meta.archivedAt) continue;

    const metaFirst = toOsloDate(meta.firstSubmissionAt);
    const metaLast = toOsloDate(meta.lastSubmissionAt);
    if (metaFirst && (!first || metaFirst.isBefore(first))) first = metaFirst;
    if (metaLast && (!last || metaLast.isAfter(last))) last = metaLast;
  }

  if (!first || !last || first.isAfter(last, "day")) return undefined;

  return {
    fromDate: first.format("YYYY-MM-DD"),
    toDate: last.format("YYYY-MM-DD"),
  };
}

/**
 * The selected survey's metadata. A survey ID can be used by more than one
 * app. The selected app's own entry comes first.
 */
export function getSurveyPeriodMetadata(
  bootstrap: SurveyMetaSource | undefined,
  surveyId: string,
  app?: string,
): SurveyPeriodMetadata | undefined {
  return (
    (app ? bootstrap?.surveyMetaByApp?.[app]?.[surveyId] : undefined) ??
    bootstrap?.surveyMeta?.[surveyId]
  );
}

/**
 * First and last day with answers for the selected survey, or else for the
 * selected app or the team. Surveys hidden by the archive filter do not
 * count, unless one of them is selected.
 */
export function getAnswerSpan(
  bootstrap: SurveyMetaSource | undefined,
  {
    surveyId,
    app,
    includeArchived = false,
  }: { surveyId?: string; app?: string; includeArchived?: boolean },
): DateRange | undefined {
  if (surveyId) {
    return getSurveyPeriod(getSurveyPeriodMetadata(bootstrap, surveyId, app));
  }
  const surveyMeta =
    (app ? bootstrap?.surveyMetaByApp?.[app] : undefined) ??
    bootstrap?.surveyMeta;
  return getTeamSubmissionPeriod(surveyMeta, { includeArchived });
}

/**
 * Search params that show a fixed period from its first page. The preset is
 * cleared, since it describes periods chosen in the period selector.
 */
export function fixedPeriodSearch(fromDate: string, toDate: string) {
  return {
    dateMode: "fixed" as const,
    fromDate,
    toDate,
    periodPreset: undefined,
    page: "1",
  };
}
