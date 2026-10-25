import { describe, expect, it } from "vitest";
import type { SearchParams } from "~/hooks/useSearchParams";
import { hasActiveDashboardFilters } from "../useActiveFilters";

describe("hasActiveDashboardFilters", () => {
  it("counts a fixed period and «Fra første svar», not the automatic period", () => {
    const filters = (params: Partial<SearchParams>) =>
      hasActiveDashboardFilters(params as SearchParams);

    expect(filters({ dateMode: "auto" })).toBe(false);
    expect(filters({ dateMode: "fixed" })).toBe(true);
    expect(filters({ dateMode: "relative", periodPreset: "sinceFirst" })).toBe(
      true,
    );
  });
});
