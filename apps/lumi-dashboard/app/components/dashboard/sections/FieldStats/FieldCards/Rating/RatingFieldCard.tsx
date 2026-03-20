import { StarIcon } from "@navikt/aksel-icons";
import { HStack } from "@navikt/ds-react";

import { DashboardCard } from "~/components/dashboard";
import { useSearchParams } from "~/hooks/useSearchParams";
import type { FieldStat, RatingStats } from "~/types/api";
import {
  inferRatingVariantFromDistribution,
  type RatingVariant,
} from "~/utils/ratingDisplay";

import { FieldCardHeader } from "../FieldCardHeader";
import type { FieldCardProps } from "../types";
import { RatingBars } from "./RatingBars";
import { RatingSummary } from "./RatingSummary";
import { ThumbsDrilldown } from "./ThumbsDrilldown";

function sumDistribution(distribution: Record<string, number>) {
  return Object.values(distribution).reduce((sum, count) => sum + count, 0);
}

function ratingValuesForVariant(variant: RatingVariant): number[] {
  if (variant === "thumbs") return [2, 1];
  if (variant === "nps") return [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  return [5, 4, 3, 2, 1];
}

export function RatingFieldCard({ field, totalCount }: FieldCardProps) {
  const { params, setParams } = useSearchParams();

  const stats = field.stats as RatingStats;
  const distribution = stats.distribution as unknown as Record<string, number>;

  const ratingVariant: RatingVariant = inferRatingVariantFromDistribution(
    distribution,
    (stats as RatingStats & { ratingVariant?: RatingVariant })?.ratingVariant,
  );

  const fieldTotalResponses = sumDistribution(distribution);

  const activeRatingFieldId = params.ratingFieldId;
  const activeRatingValue = params.ratingValue;
  const isFilteringThisField = activeRatingFieldId === field.fieldId;
  const parsedActiveRatingValue = Number(activeRatingValue);
  const activeRatingNumericValue =
    isFilteringThisField && Number.isFinite(parsedActiveRatingValue)
      ? parsedActiveRatingValue
      : undefined;

  const responsePct =
    totalCount > 0 ? Math.round((fieldTotalResponses / totalCount) * 100) : 0;

  const onSelectRating = (nextValue: string) => {
    const isAlreadySelected =
      isFilteringThisField && activeRatingValue === String(nextValue);

    setParams({
      ratingFieldId: isAlreadySelected ? undefined : field.fieldId,
      ratingValue: isAlreadySelected ? undefined : String(nextValue),
      page: "1",
    });
  };

  const onClearRating = () =>
    setParams({
      ratingFieldId: undefined,
      ratingValue: undefined,
      page: "1",
    });

  const onSelectThumb = (nextValue: "1" | "2") => onSelectRating(nextValue);
  const onClearThumb = () => onClearRating();

  return (
    <DashboardCard padding="space-20">
      <FieldCardHeader
        icon={<StarIcon fontSize="1.25rem" aria-hidden />}
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        subtitle={`${fieldTotalResponses} av ${totalCount} har svart (${responsePct}%)`}
      />

      <HStack gap="space-8" align="center" marginBlock="space-8">
        <RatingSummary
          variant={ratingVariant}
          average={stats.average}
          distribution={distribution}
        />
      </HStack>

      {ratingVariant === "thumbs" ? (
        <ThumbsDrilldown
          fieldId={field.fieldId}
          distribution={distribution}
          fieldTotalResponses={fieldTotalResponses}
          activeRatingValue={activeRatingValue}
          isFilteringThisField={isFilteringThisField}
          onSelect={onSelectThumb}
          onClear={onClearThumb}
        />
      ) : (
        <RatingBars
          variant={ratingVariant}
          distribution={distribution}
          ratingValues={ratingValuesForVariant(ratingVariant)}
          activeRatingValue={activeRatingNumericValue}
          onRatingSelect={(value) => onSelectRating(String(value))}
          onRatingClear={onClearRating}
        />
      )}
    </DashboardCard>
  );
}

export type { FieldStat };
