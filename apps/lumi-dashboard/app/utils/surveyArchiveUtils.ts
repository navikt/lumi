/**
 * Helpers for survey archive state (per-team display metadata from
 * the filter bootstrap's `surveyMeta`). Archiving only affects what the
 * dashboard shows — submissions are unaffected.
 */

export interface SurveyMetaEntry {
  archivedAt: string | null;
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
 * Archived surveys are hidden unless `showArchived` is on — except the
 * currently selected survey, which must stay in the list so the select
 * keeps a valid value (e.g. when opened from a bookmarked URL).
 */
export function partitionSurveyOptions({
  availableSurveys,
  surveyMeta,
  showArchived,
  selectedSurveyId,
}: {
  availableSurveys: string[];
  surveyMeta: SurveyMetaMap | undefined;
  showArchived: boolean;
  selectedSurveyId?: string;
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

  const archived = showArchived
    ? allArchived
    : allArchived.filter((surveyId) => surveyId === selectedSurveyId);

  return { active, archived, hasArchived: allArchived.length > 0 };
}
