/**
 * Helpers for survey archive state (per-team display metadata from
 * the filter bootstrap's `surveyMeta`). Archiving only affects what the
 * dashboard shows — submissions are unaffected.
 */

export interface SurveyMetaEntry {
  archivedAt: string | null;
  lastSubmissionAt?: string | null;
}

export type SurveyMetaMap = Record<string, SurveyMetaEntry>;

export function isSurveyArchived(
  surveyId: string,
  surveyMeta: SurveyMetaMap | undefined,
): boolean {
  return surveyMeta?.[surveyId]?.archivedAt != null;
}

export interface SurveyOptionGroups {
  active: string[];
  archived: string[];
  /** True when any available survey is archived — drives the toggle's visibility. */
  hasArchived: boolean;
}

/**
 * Splits the available surveys into active and archived dropdown groups.
 *
 * Archived surveys are hidden unless `showArchived` is on.
 */
export function partitionSurveyOptions({
  availableSurveys,
  surveyMeta,
  showArchived,
}: {
  availableSurveys: string[];
  surveyMeta: SurveyMetaMap | undefined;
  showArchived: boolean;
}): SurveyOptionGroups {
  const active: string[] = [];
  const allArchived: string[] = [];

  for (const surveyId of availableSurveys) {
    if (isSurveyArchived(surveyId, surveyMeta)) {
      allArchived.push(surveyId);
    } else {
      active.push(surveyId);
    }
  }

  const archived = showArchived ? allArchived : [];

  return { active, archived, hasArchived: allArchived.length > 0 };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Relative wording for a survey's newest submission ("i dag", "i går",
 * "for N dager/md./år siden"). Coarse on purpose — decision support for
 * archiving, not an exact timestamp.
 */
export function formatRelativeSubmissionTime(
  lastSubmissionAt: string,
  now: Date = new Date(),
): string {
  const days = Math.floor(
    (now.getTime() - new Date(lastSubmissionAt).getTime()) / DAY_MS,
  );
  if (days < 1) return "i dag";
  if (days === 1) return "i går";
  if (days < 30) return `for ${days} dager siden`;
  if (days < 365) return `for ${Math.max(1, Math.floor(days / 30))} md. siden`;
  return `for ${Math.floor(days / 365)} år siden`;
}

/**
 * True when an archived survey has received submissions after it was
 * archived — archiving hides data but does not stop intake, and this is
 * how the dashboard makes that visible. Parses timestamps because the
 * backend emits archivedAt with offset and lastSubmissionAt in UTC.
 */
export function isReceivingAfterArchive(
  entry: SurveyMetaEntry | undefined,
): boolean {
  if (!entry?.archivedAt || !entry.lastSubmissionAt) return false;
  return (
    new Date(entry.lastSubmissionAt).getTime() >
    new Date(entry.archivedAt).getTime()
  );
}
