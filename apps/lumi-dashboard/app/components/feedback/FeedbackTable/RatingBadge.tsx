import { getNpsCategory } from "~/utils/ratingDisplay";

import styles from "./styles.module.css";
import { ratingToEmoji } from "./utils";

export function RatingBadge({
  rating,
  variant,
  scale,
}: {
  rating: number;
  variant: "emoji" | "stars" | "thumbs" | "nps";
  scale: number;
}) {
  switch (variant) {
    case "emoji":
      return (
        <span className={styles.ratingEmoji}>{ratingToEmoji(rating)}</span>
      );

    case "thumbs":
      return (
        <span className={styles.ratingEmoji}>{rating >= 2 ? "👍" : "👎"}</span>
      );

    case "stars":
      return (
        <span className={styles.ratingPill}>
          <span>{rating}</span>
          <span aria-hidden className={styles.ratingStarIcon}>
            ⭐
          </span>
        </span>
      );

    case "nps": {
      const category = getNpsCategory(rating);
      const categoryClass =
        category === "promoter"
          ? styles.ratingPillPromoter
          : category === "passive"
            ? styles.ratingPillPassive
            : styles.ratingPillDetractor;

      return (
        <span className={`${styles.ratingPill} ${categoryClass}`}>
          {rating}/{Math.max(scale - 1, 10)}
        </span>
      );
    }
  }
}
