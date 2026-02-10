import { HStack, VStack } from "@navikt/ds-react";
import type { RatingVariant } from "~/utils/ratingDisplay";
import styles from "./RatingFieldCard.module.css";

export function RatingBars({
  variant,
  distribution,
  ratingValues,
}: {
  variant: RatingVariant;
  distribution: Record<string, number>;
  ratingValues: number[];
}) {
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

  return (
    <VStack gap="space-4" marginBlock="space-12 space-0">
      {ratingValues.map((rating) => {
        const count = distribution[String(rating)] || 0;
        const fillClass = getFillClass(rating);

        return (
          <HStack
            key={rating}
            gap="space-8"
            align="center"
            className={styles.barRow}
          >
            <span className={`${styles.barLabel} ${labelClass}`}>
              {label(rating)}
            </span>

            <progress
              className={`${styles.barTrack} ${fillClass}`}
              value={count}
              max={maxCount}
            />

            <span className={styles.barCount}>{count}</span>
          </HStack>
        );
      })}
    </VStack>
  );
}
