import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const OSLO_TIME_ZONE = "Europe/Oslo";

export function todayInOslo() {
  return dayjs().tz(OSLO_TIME_ZONE).format("YYYY-MM-DD");
}

export type DashboardDateMode = "auto" | "fixed" | "relative";

/**
 * «Fra første svar»: the period starts at the first answer and ends today.
 * It is the only relative period.
 */
export function isSinceFirst(params: {
  dateMode?: string;
  periodPreset?: string;
}): boolean {
  return params.dateMode === "relative" && params.periodPreset === "sinceFirst";
}

/**
 * Search params for «Fra første svar» from its first page. The address has
 * no start. The start shown is the first answer for the selection in the
 * filter bootstrap, so the period follows the selection and the days.
 */
export function sinceFirstSearch(today = todayInOslo()) {
  return {
    dateMode: "relative" as const,
    periodPreset: "sinceFirst" as const,
    fromDate: undefined,
    toDate: today,
    page: "1",
  };
}

/** The name of «Fra første svar», with the first answer when it is known. */
export function sinceFirstLabel(firstAnswerDate?: string): string {
  return firstAnswerDate
    ? `Fra første svar (${dayjs(firstAnswerDate).format("DD.MM.YYYY")})`
    : "Fra første svar";
}

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
  // «Fra første svar» has no start in the address. Kept as it is, so the
  // filter bar does not turn it into an automatic period.
  if (dateMode === "relative") return { dateMode, toDate };

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

  // Comparing the timestamps is cheap. Only the first and the last become
  // days in Oslo, which is slow for a team with many surveys.
  let first: { at: number; timestamp: string } | undefined;
  let last: { at: number; timestamp: string } | undefined;

  for (const meta of Object.values(surveyMeta)) {
    if (!includeArchived && meta.archivedAt) continue;

    const firstAt = Date.parse(meta.firstSubmissionAt ?? "");
    const lastAt = Date.parse(meta.lastSubmissionAt ?? "");
    if (meta.firstSubmissionAt && firstAt < (first?.at ?? Infinity)) {
      first = { at: firstAt, timestamp: meta.firstSubmissionAt };
    }
    if (meta.lastSubmissionAt && lastAt > (last?.at ?? -Infinity)) {
      last = { at: lastAt, timestamp: meta.lastSubmissionAt };
    }
  }

  return getSurveyPeriod({
    firstSubmissionAt: first?.timestamp,
    lastSubmissionAt: last?.timestamp,
  });
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
 * count, unless one of them is selected. With an app, only its own answers
 * count: a survey or an app without answers there has no span.
 */
export function getAnswerSpan(
  bootstrap: SurveyMetaSource | undefined,
  {
    surveyId,
    app,
    includeArchived = false,
  }: { surveyId?: string; app?: string; includeArchived?: boolean },
): DateRange | undefined {
  const surveyMeta = app
    ? bootstrap?.surveyMetaByApp?.[app]
    : bootstrap?.surveyMeta;
  if (surveyId) return getSurveyPeriod(surveyMeta?.[surveyId]);
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
