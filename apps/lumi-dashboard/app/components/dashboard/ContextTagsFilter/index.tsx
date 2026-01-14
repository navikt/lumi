import { Select, VStack } from "@navikt/ds-react";
import { useContextTags } from "~/hooks/useContextTags";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { formatMetadataLabel, formatMetadataValue } from "~/utils/segmentUtils";

interface ContextTagsFilterProps {
  surveyId: string;
}

/**
 * Compact segmentation controls for context.tags.
 * Renders one single-select per key.
 */
export function ContextTagsFilter({ surveyId }: ContextTagsFilterProps) {
  const { activeFilters, addSegment, removeSegment } = useSegmentFilter();
  const { data } = useContextTags(surveyId);

  const contextTags = data?.contextTags || {};
  const hasTags = Object.keys(contextTags).length > 0;

  if (!surveyId || surveyId === "alle" || !hasTags) {
    return null;
  }

  // Update a single filter value
  const setFilter = (key: string, value: string | undefined) => {
    if (value === undefined || value === "") {
      // Remove filter by finding and removing the segment
      if (activeFilters[key]) {
        removeSegment(`${key}:${activeFilters[key]}`);
      }
    } else {
      // Add new filter (this replaces any existing filter for this key)
      if (activeFilters[key]) {
        removeSegment(`${key}:${activeFilters[key]}`);
      }
      addSegment(key, value);
    }
  };

  return (
    <VStack gap="space-8">
      {Object.entries(contextTags).map(([key, values]) => {
        const label = formatMetadataLabel(key);
        const selectedValue = activeFilters[key];

        return (
          <Select
            key={key}
            label={label}
            size="small"
            value={selectedValue || ""}
            onChange={(e) =>
              setFilter(key, e.target.value === "" ? undefined : e.target.value)
            }
          >
            <option value="">Alle</option>
            {values.map((item) => (
              <option key={item.value} value={item.value}>
                {formatMetadataValue(item.value)} ({item.count})
              </option>
            ))}
          </Select>
        );
      })}
    </VStack>
  );
}
