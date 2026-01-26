import type { SearchParams } from "~/hooks/useSearchParams";
import type { FeedbackStats, TextTheme } from "~/types/api";
import { inferRatingVariantFromDistribution } from "~/utils/ratingDisplay";

interface FilterLabelInput {
  params: SearchParams;
  stats?: FeedbackStats;
  themes?: TextTheme[];
}

export function getFilterLabels({ params, stats, themes }: FilterLabelInput): {
  ratingLabel?: string;
  ratingValueLabel?: string;
  themeLabel?: string;
} {
  const themeLabel =
    params.theme === "uncategorized"
      ? "Annet"
      : params.theme
        ? (themes?.find((theme) => theme.id === params.theme)?.name ??
          params.theme)
        : undefined;

  const ratingField = stats?.fieldStats?.find(
    (field) => field.fieldId === params.ratingFieldId,
  );
  const ratingLabel =
    ratingField && ratingField.fieldType === "RATING"
      ? ratingField.label
      : params.ratingFieldId
        ? "Vurdering"
        : undefined;

  let ratingValueLabel = params.ratingValue;
  if (
    params.ratingFieldId &&
    params.ratingValue &&
    ratingField?.fieldType === "RATING"
  ) {
    const ratingStats = ratingField.stats as unknown as {
      distribution?: Record<string, number>;
      ratingVariant?: string;
    };
    const ratingVariant = inferRatingVariantFromDistribution(
      ratingStats.distribution,
      ratingStats.ratingVariant,
    );
    if (ratingVariant === "thumbs") {
      ratingValueLabel =
        params.ratingValue === "2"
          ? "Ja"
          : params.ratingValue === "1"
            ? "Nei"
            : params.ratingValue;
    }
  }

  return { ratingLabel, ratingValueLabel, themeLabel };
}
