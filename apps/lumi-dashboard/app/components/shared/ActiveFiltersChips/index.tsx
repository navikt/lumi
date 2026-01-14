import { XMarkIcon } from "@navikt/aksel-icons";
import { HStack, Tag } from "@navikt/ds-react";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
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
 * - Pathname: Only set via drill-down → show chip
 * - LowRating: Only on feedback page → show chip on dashboard
 * - Segment: Metadata filters from SegmentBreakdown → global chip
 */
export function ActiveFiltersChips() {
  const { params, setParam } = useSearchParams();
  const { activeFilters, removeSegment } = useSegmentFilter();

  const chips: FilterChip[] = [];

  // Device type filter - NOT shown in FilterBar on dashboard
  if (params.deviceType && params.deviceType !== "alle") {
    chips.push({
      key: "deviceType",
      label: "Enhet",
      value: DEVICE_LABELS[params.deviceType] || params.deviceType,
      onRemove: () => setParam("deviceType", undefined),
    });
  }

  // Pathname filter - only set via drill-down
  if (params.pathname) {
    chips.push({
      key: "pathname",
      label: "Side",
      value: params.pathname,
      onRemove: () => setParam("pathname", undefined),
    });
  }

  // Low rating filter - not shown in dashboard FilterBar
  if (params.lowRating === "true") {
    chips.push({
      key: "lowRating",
      label: "Rating",
      value: "Lav (1-2)",
      onRemove: () => setParam("lowRating", undefined),
    });
  }

  // Task filter (Top Tasks drill-down)
  if (params.task) {
    chips.push({
      key: "task",
      label: "Oppgave",
      value: params.task,
      onRemove: () => setParam("task", undefined),
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
          key={chip.key}
          variant="neutral"
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
