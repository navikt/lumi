import type { RatingVariant } from "~/utils/ratingDisplay";
import {
  calculateThumbsPositiveRate,
  getRatingSingleIcon,
} from "~/utils/ratingDisplay";
import styles from "./RatingFieldCard.module.css";

export function RatingSummary({
  variant,
  average,
  distribution,
}: {
  variant: RatingVariant;
  average: number;
  distribution: Record<string, number>;
}) {
  if (variant === "thumbs") {
    const positiveRate = calculateThumbsPositiveRate(distribution);
    return (
      <>
        <span className={styles.summaryValue}>{Math.round(positiveRate)}%</span>
        <span className={styles.summaryIcon}>👍</span>
      </>
    );
  }

  if (variant === "nps") {
    return (
      <>
        <span className={styles.summaryValue}>{average.toFixed(1)}</span>
        <span className={styles.summaryMeta}>av 10 mulige</span>
      </>
    );
  }

  return (
    <>
      <span className={styles.summaryValue}>{average.toFixed(1)}</span>
      <span className={styles.summaryIcon}>
        {getRatingSingleIcon(average, variant)}
      </span>
    </>
  );
}
