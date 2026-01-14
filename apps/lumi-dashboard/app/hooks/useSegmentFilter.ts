import { useSearchParams } from "~/hooks/useSearchParams";
import {
  parseSegmentParam,
  stringifySegmentFilters,
} from "~/utils/segmentUtils";

/**
 * Hook for managing segment filters in URL params.
 * Provides methods to add, remove, and clear segment filters.
 *
 * @example
 * ```tsx
 * const { activeSegments, addSegment, removeSegment } = useSegmentFilter();
 *
 * // Add filter when clicking a segment bar
 * addSegment("harAktivSykmelding", "Ja");
 *
 * // Remove filter when clicking X
 * removeSegment("harAktivSykmelding:Ja");
 * ```
 */
export function useSegmentFilter() {
  const { params, setParams } = useSearchParams();

  // Parse current segment filters from URL
  const activeFilters = parseSegmentParam(params.segment);
  const activeSegments = params.segment?.split(",").filter(Boolean) || [];

  /**
   * Add a segment filter (key:value pair).
   * If the filter already exists, it won't be duplicated.
   */
  const addSegment = (key: string, value: string) => {
    const current = { ...activeFilters };
    if (current[key] === value) return; // Already active

    current[key] = value;
    setParams({ segment: stringifySegmentFilters(current) });
  };

  /**
   * Remove a segment filter.
   * @param segment - Full segment string "key:value"
   */
  const removeSegment = (segment: string) => {
    const newSegments = activeSegments.filter((s) => s !== segment);
    setParams({
      segment: newSegments.length > 0 ? newSegments.join(",") : undefined,
    });
  };

  /**
   * Clear all segment filters.
   */
  const clearSegments = () => {
    setParams({ segment: undefined });
  };

  /**
   * Check if a specific segment is active.
   */
  const isActive = (key: string, value?: string): boolean => {
    if (value === undefined) {
      return key in activeFilters;
    }
    return activeFilters[key] === value;
  };

  return {
    /** Currently active filters as key-value pairs */
    activeFilters,
    /** Currently active filters as "key:value" strings */
    activeSegments,
    /** Whether any filters are active */
    hasFilters: activeSegments.length > 0,
    /** Add a segment filter */
    addSegment,
    /** Remove a segment filter */
    removeSegment,
    /** Clear all filters */
    clearSegments,
    /** Check if a filter is active */
    isActive,
  };
}
