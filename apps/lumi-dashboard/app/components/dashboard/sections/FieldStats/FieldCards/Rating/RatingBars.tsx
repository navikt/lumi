import { Button, HStack, VStack } from "@navikt/ds-react";
import type { RatingVariant } from "~/utils/ratingDisplay";
import styles from "./RatingFieldCard.module.css";

export interface RatingBarsProps {
  variant: RatingVariant;
  distribution: Record<string, number>;
  ratingValues: number[];
  activeRatingValue?: number;
  onRatingSelect: (value: number) => void;
  onRatingClear: () => void;
}

export function RatingBars({
  variant,
  distribution,
  ratingValues,
  activeRatingValue,
  onRatingSelect,
  onRatingClear,
}: RatingBarsProps) {
  const maxCount = Math.max(
    ...ratingValues.map((v) => distribution[String(v)] || 0),
    1,
  );

  const labelClass = (() => {
    if (variant === "thumbs") return styles.barLabelThumbs;
    if (variant === "stars") return styles.barLabelStars;
    if (variant === "nps") return styles.barLabelNps;
    return styles.barLabelEmoji;
  })();

  const label = (rating: number): string => {
    if (variant === "thumbs") return rating >= 2 ? "👍 Ja" : "👎 Nei";
    return String(rating);
  };

  const getFillClass = (rating: number): string => {
    if (variant === "thumbs") {
      return rating >= 2 ? styles.barFillPositive : styles.barFillNegative;
    }

    if (variant === "nps") {
      if (rating >= 9) return styles.barFillPositive;
      if (rating >= 7) return styles.barFillMedium;
      return styles.barFillNegative;
    }

    if (rating >= 5) return styles.barFillPositive;
    if (rating >= 4) return styles.barFillGood;
    if (rating >= 3) return styles.barFillMedium;
    if (rating >= 2) return styles.barFillWarning;
    if (rating >= 1) return styles.barFillNegative;
    return styles.barFillNeutral;
  };

  const isFiltering = typeof activeRatingValue === "number";

  return (
    <VStack gap="space-4" marginBlock="space-12 space-0">
      <VStack gap="space-2">
        {ratingValues.map((rating) => {
          const count = distribution[String(rating)] || 0;
          const fillClass = getFillClass(rating);
          const isActive = activeRatingValue === rating;
          const isDimmed = isFiltering && !isActive;

          return (
            <button
              key={rating}
              type="button"
              onClick={() => onRatingSelect(rating)}
              className={`${styles.barRowButton} ${
                isDimmed ? styles.barRowDimmed : ""
              }`}
              aria-pressed={isActive}
            >
              <HStack gap="space-8" align="center" className={styles.barRow}>
                <span className={`${styles.barLabel} ${labelClass}`}>
                  {label(rating)}
                </span>

                <progress
                  className={`${styles.barTrack} ${fillClass}`}
                  value={count}
                  max={maxCount}
                  aria-hidden="true"
                />

                <span className={styles.barCount}>{count}</span>
              </HStack>
            </button>
          );
        })}
      </VStack>

      {isFiltering && (
        <Button
          type="button"
          onClick={onRatingClear}
          variant="tertiary"
          size="xsmall"
          style={{ alignSelf: "flex-start" }}
        >
          Nullstill filter
        </Button>
      )}
    </VStack>
  );
}
