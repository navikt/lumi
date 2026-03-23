import { XMarkIcon } from "@navikt/aksel-icons";
import { HStack, Tag } from "@navikt/ds-react";
import { useChoiceFilter } from "~/hooks/useChoiceFilter";
import { useRatingFilter } from "~/hooks/useRatingFilter";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useStats } from "~/hooks/useStats";
import { getFilterLabels } from "~/utils/filterLabels";
import { formatMetadataLabel } from "~/utils/segmentUtils";
import styles from "./ActiveFiltersChips.module.css";

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

export function ActiveFiltersChips() {
  const { params, setParams } = useSearchParams();
  const { activeFilters: activeSegments, removeSegment } = useSegmentFilter();
  const { removeChoice } = useChoiceFilter();
  const { removeRating } = useRatingFilter();
  const statsQuery = useStats();
  const { choiceFilters, ratingFilters } = getFilterLabels({
    params,
    stats: statsQuery.data,
  });

  const chips: FilterChip[] = [];

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

  for (const filter of ratingFilters) {
    chips.push({
      key: filter.key,
      label: filter.label,
      value: filter.value,
      onRemove: () => removeRating(filter.fieldId),
    });
  }

  for (const filter of choiceFilters) {
    chips.push({
      key: filter.key,
      label: filter.label,
      value: filter.value,
      onRemove: () => removeChoice(filter.fieldId),
    });
  }

  for (const [key, value] of Object.entries(activeSegments)) {
    chips.push({
      key: `segment-${key}-${value}`,
      label: formatMetadataLabel(key),
      value,
      onRemove: () => removeSegment(`${key}:${value}`),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <HStack gap="space-8" wrap className={styles.root}>
      {chips.map((chip) => (
        <Tag
          data-color="neutral"
          key={chip.key}
          variant="outline"
          size="small"
          className={styles.chip}
        >
          <span className={styles.label}>
            {chip.label}: {chip.value}
          </span>
          <button
            type="button"
            onClick={chip.onRemove}
            className={styles.removeButton}
            aria-label={`Fjern filter ${chip.label}: ${chip.value}`}
          >
            <XMarkIcon fontSize="1rem" className={styles.removeIcon} />
          </button>
        </Tag>
      ))}
    </HStack>
  );
}
