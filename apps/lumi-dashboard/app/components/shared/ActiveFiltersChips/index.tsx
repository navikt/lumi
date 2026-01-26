import { XMarkIcon } from "@navikt/aksel-icons";
import { HStack, Tag } from "@navikt/ds-react";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useStats } from "~/hooks/useStats";
import { inferRatingVariantFromDistribution } from "~/utils/ratingDisplay";
import { formatMetadataLabel } from "~/utils/segmentUtils";

interface FilterChip {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobil",
  tablet: "Nettbrett",
  desktop: "Desktop",
};

/**
 * Displays active drill-down filters as removable chips.
 * Only shows filters that are NOT already visible in FilterBar.
 *
 * - App/Survey/Period: Already shown in FilterBar → no chip
 * - DeviceType: NOT shown on dashboard → show chip
 * - Segment: Metadata filters from SegmentBreakdown → global chip
 */
export function ActiveFiltersChips() {
  const { params, setParams } = useSearchParams();
  const { activeFilters, removeSegment } = useSegmentFilter();
  const statsQuery = useStats();

  const chips: FilterChip[] = [];

  // Device type filter - NOT shown in FilterBar on dashboard
  if (params.deviceType && params.deviceType !== "alle") {
    chips.push({
      key: "deviceType",
      label: "Enhet",
      value: DEVICE_LABELS[params.deviceType] || params.deviceType,
      onRemove: () =>
        setParams({
          deviceType: undefined,
          page: "1",
        }),
    });
  }

  // Task filter (Top Tasks drill-down)
  if (params.task) {
    chips.push({
      key: "task",
      label: "Oppgave",
      value: params.task,
      onRemove: () =>
        setParams({
          task: undefined,
          page: "1",
        }),
    });
  }

  // Rating field filter (e.g. thumbs donut drill-down)
  if (params.ratingFieldId && params.ratingValue) {
    const field = statsQuery.data?.fieldStats?.find(
      (f) => f.fieldId === params.ratingFieldId,
    );

    const fieldLabel = field?.label ?? "Vurdering";

    let valueLabel = params.ratingValue;
    if (field?.fieldType === "RATING") {
      const stats = field.stats as unknown as {
        distribution?: Record<string, number>;
        ratingVariant?: string;
      };
      const ratingVariant = inferRatingVariantFromDistribution(
        stats.distribution ?? {},
        stats.ratingVariant,
      );
      if (ratingVariant === "thumbs") {
        valueLabel =
          params.ratingValue === "2"
            ? "Ja"
            : params.ratingValue === "1"
              ? "Nei"
              : params.ratingValue;
      }
    }

    chips.push({
      key: `rating-${params.ratingFieldId}-${params.ratingValue}`,
      label: fieldLabel,
      value: valueLabel,
      onRemove: () =>
        setParams({
          ratingFieldId: undefined,
          ratingValue: undefined,
          page: "1",
        }),
    });
  }

  // Segment filters (metadata)
  for (const [key, value] of Object.entries(activeFilters)) {
    chips.push({
      key: `segment-${key}-${value}`,
      label: formatMetadataLabel(key),
      value: value,
      onRemove: () => removeSegment(`${key}:${value}`),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <HStack gap="space-8" wrap>
      {chips.map((chip) => (
        <Tag
          data-color="neutral"
          key={chip.key}
          variant="outline"
          size="small"
          style={{ cursor: "pointer", paddingRight: "0.25rem" }}
        >
          <span style={{ marginRight: "0.5rem" }}>
            {chip.label}: {chip.value}
          </span>
          <button
            type="button"
            onClick={chip.onRemove}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.125rem",
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "2px",
            }}
            aria-label={`Fjern filter ${chip.label}`}
          >
            <XMarkIcon fontSize="1rem" />
          </button>
        </Tag>
      ))}
    </HStack>
  );
}
