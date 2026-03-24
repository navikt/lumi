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

export function getFilterLabels({ params, stats, themes }: FilterLabelInput): {
  choiceFilters: ActiveFilterLabel[];
  ratingFilters: ActiveFilterLabel[];
  themeLabel?: string;
} {
  return {
    choiceFilters: getActiveChoiceFilterLabels({ params, stats }),
    ratingFilters: getActiveRatingFilterLabels({ params, stats }),
    themeLabel: getThemeLabel({ params, themes }),
  };
}
