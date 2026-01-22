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
          <span aria-hidden style={{ lineHeight: 1 }}>
            ⭐
          </span>
        </span>
      );

    case "nps": {
      const category = getNpsCategory(rating);
      const colors =
        category === "promoter"
          ? { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" }
          : category === "passive"
            ? { bg: "#FEF9C3", text: "#854D0E", border: "#FDE047" }
            : { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" };

      return (
        <span
          className={styles.ratingPill}
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            borderColor: colors.border,
          }}
        >
          {rating}/{Math.max(scale - 1, 10)}
        </span>
      );
    }
  }
}
