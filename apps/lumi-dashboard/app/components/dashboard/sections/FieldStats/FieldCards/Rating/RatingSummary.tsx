import type { RatingVariant } from "~/utils/ratingDisplay";
import {
  calculateThumbsPositiveRate,
  getRatingSingleIcon,
} from "~/utils/ratingDisplay";

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
        <span style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
          {Math.round(positiveRate)}%
        </span>
        <span style={{ fontSize: "1.5rem", marginLeft: "0.5rem" }}>👍</span>
      </>
    );
  }

  if (variant === "nps") {
    return (
      <>
        <span style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
          {average.toFixed(1)}
        </span>
        <span
          style={{
            fontSize: "0.875rem",
            marginLeft: "0.5rem",
            color: "var(--ax-text-neutral-subtle)",
          }}
        >
          av 10 mulige
        </span>
      </>
    );
  }

  return (
    <>
      <span style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
        {average.toFixed(1)}
      </span>
      <span style={{ fontSize: "1.5rem", marginLeft: "0.5rem" }}>
        {getRatingSingleIcon(average, variant)}
      </span>
    </>
  );
}
