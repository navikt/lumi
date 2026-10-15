import type { SearchParams } from "~/hooks/useSearchParams";
import type { ChoiceStats, FeedbackStats, TextTheme } from "~/types/api";
import { parseChoiceParam } from "~/utils/choiceFilterUtils";
import { inferRatingVariantFromDistribution } from "~/utils/ratingDisplay";
import { parseRatingParam } from "~/utils/ratingFilterUtils";

export interface ActiveFilterLabel {
  fieldId: string;
  key: string;
  label: string;
  value: string;
}

interface FilterLabelInput {
  params: SearchParams;
  stats?: FeedbackStats;
  /** True while stats have not loaded yet. False after a failed request. */
  isStatsPending?: boolean;
  themes?: TextTheme[];
}

export function getThemeLabel({
  params,
  themes,
}: Pick<FilterLabelInput, "params" | "themes">): string | undefined {
  return params.theme === "uncategorized"
    ? "Annet"
    : params.theme
      ? (themes?.find((theme) => theme.id === params.theme)?.name ??
        params.theme)
      : undefined;
}

/**
 * The URL stores the Top Tasks `taskId`, which stays stable when the team
 * rewrites the task text. Show the text when stats include it, a placeholder
 * while they load, and the id when they fail or lack the task.
 */
export function getTaskLabel({
  params,
  stats,
  isStatsPending = false,
}: Pick<FilterLabelInput, "params" | "stats" | "isStatsPending">):
  | string
  | undefined {
  if (!params.task) return undefined;

  const taskField = stats?.fieldStats?.find(
    (field) => field.fieldId === "task",
  );
  const label = (taskField?.stats as ChoiceStats | undefined)?.distribution?.[
    params.task
  ]?.label;

  return label ?? (isStatsPending ? "…" : params.task);
}

export function getActiveRatingFilterLabels({
  params,
  stats,
}: Pick<FilterLabelInput, "params" | "stats">): ActiveFilterLabel[] {
  return Object.entries(parseRatingParam(params.rating)).map(
    ([fieldId, ratingValue]) => {
      const field = stats?.fieldStats?.find(
        (candidate) => candidate.fieldId === fieldId,
      );
      const label = field?.fieldType === "RATING" ? field.label : "Vurdering";

      let value = ratingValue;
      if (field?.fieldType === "RATING") {
        const ratingStats = field.stats as unknown as {
          distribution?: Record<string, number>;
          ratingVariant?: string;
        };
        const ratingVariant = inferRatingVariantFromDistribution(
          ratingStats.distribution,
          ratingStats.ratingVariant,
        );
        if (ratingVariant === "thumbs") {
          value =
            ratingValue === "2"
              ? "Ja"
              : ratingValue === "1"
                ? "Nei"
                : ratingValue;
        }
      }

      return {
        fieldId,
        key: `rating-${fieldId}-${ratingValue}`,
        label,
        value,
      };
    },
  );
}

export function getActiveChoiceFilterLabels({
  params,
  stats,
}: Pick<FilterLabelInput, "params" | "stats">): ActiveFilterLabel[] {
  return Object.entries(parseChoiceParam(params.choice)).map(
    ([fieldId, optionId]) => {
      const field = stats?.fieldStats?.find(
        (candidate) => candidate.fieldId === fieldId,
      );
      const label =
        field &&
        (field.fieldType === "SINGLE_CHOICE" ||
          field.fieldType === "MULTI_CHOICE")
          ? field.label
          : "Valg";

      const choiceStats = field?.stats as ChoiceStats | undefined;
      const resolvedLabel = choiceStats?.distribution?.[optionId]?.label;
      const value = resolvedLabel ?? (stats ? optionId : "…");

      return {
        fieldId,
        key: `choice-${fieldId}-${optionId}`,
        label,
        value,
      };
    },
  );
}

export function getFilterLabels({
  params,
  stats,
  isStatsPending,
  themes,
}: FilterLabelInput): {
  choiceFilters: ActiveFilterLabel[];
  ratingFilters: ActiveFilterLabel[];
  taskLabel?: string;
  themeLabel?: string;
} {
  return {
    choiceFilters: getActiveChoiceFilterLabels({ params, stats }),
    ratingFilters: getActiveRatingFilterLabels({ params, stats }),
    taskLabel: getTaskLabel({ params, stats, isStatsPending }),
    themeLabel: getThemeLabel({ params, themes }),
  };
}
