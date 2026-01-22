import { HStack, VStack } from "@navikt/ds-react";
import type { RatingVariant } from "~/utils/ratingDisplay";
import { getRatingColor } from "~/utils/ratingDisplay";

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

  const labelWidth = (() => {
    if (variant === "thumbs") return "4rem";
    if (variant === "stars") return "1.5rem";
    if (variant === "nps") return "1.5rem";
    return "1.25rem";
  })();

  const label = (rating: number): string => {
    if (variant === "thumbs") return rating >= 2 ? "👍 Ja" : "👎 Nei";
    return String(rating);
  };

  return (
    <VStack gap="space-4" marginBlock="space-12 space-0">
      {ratingValues.map((rating) => {
        const count = distribution[String(rating)] || 0;
        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

        return (
          <HStack
            key={rating}
            gap="space-8"
            align="center"
            style={{ fontSize: "0.875rem" }}
          >
            <span
              style={{
                width: labelWidth,
                textAlign: "center",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {label(rating)}
            </span>

            <div
              style={{
                flex: 1,
                height: 10,
                background: "var(--ax-bg-neutral-moderate)",
                borderRadius: 5,
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: `${barWidth}%`,
                  height: "100%",
                  borderRadius: 5,
                  backgroundColor: getRatingColor(rating, variant),
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <span
              style={{
                width: "2rem",
                textAlign: "right",
                color: "var(--ax-text-neutral-subtle)",
                fontSize: "0.75rem",
              }}
            >
              {count}
            </span>
          </HStack>
        );
      })}
    </VStack>
  );
}
