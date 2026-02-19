import { describe, expect, it } from "vitest";
import type { RatingMarker } from "~/types/api";
import { buildMarkerLabelMeta, groupMarkersByDate } from "../RatingTrendChart";

function marker(partial: Partial<RatingMarker> & { id: string }): RatingMarker {
  return {
    id: partial.id,
    team: partial.team ?? "team-test",
    surveyId: partial.surveyId ?? "survey-1",
    markerDate: partial.markerDate ?? "2026-01-01",
    label: partial.label ?? partial.id,
    description: partial.description,
    color: partial.color,
    createdBy: partial.createdBy,
    createdAt:
      partial.createdAt ?? `${partial.markerDate ?? "2026-01-01"}T10:00:00Z`,
    updatedAt:
      partial.updatedAt ?? `${partial.markerDate ?? "2026-01-01"}T10:00:00Z`,
  };
}

describe("RatingTrendChart marker helpers", () => {
  it("groups markers by date and sorts each date by createdAt", () => {
    const grouped = groupMarkersByDate([
      marker({
        id: "late",
        markerDate: "2026-01-10",
        createdAt: "2026-01-10T12:00:00Z",
      }),
      marker({
        id: "early",
        markerDate: "2026-01-10",
        createdAt: "2026-01-10T08:00:00Z",
      }),
      marker({
        id: "other-date",
        markerDate: "2026-01-11",
        createdAt: "2026-01-11T09:00:00Z",
      }),
    ]);

    expect(grouped["2026-01-10"]?.map((entry) => entry.id)).toEqual([
      "early",
      "late",
    ]);
    expect(grouped["2026-01-11"]?.map((entry) => entry.id)).toEqual([
      "other-date",
    ]);
  });

  it("stacks marker labels and summarizes overflow with ...+N", () => {
    const meta = buildMarkerLabelMeta([
      marker({ id: "m1", markerDate: "2026-01-01", label: "A" }),
      marker({ id: "m2", markerDate: "2026-01-02", label: "B" }),
      marker({ id: "m3", markerDate: "2026-01-03", label: "C" }),
      marker({ id: "m4", markerDate: "2026-01-03", label: "D" }),
      marker({ id: "m5", markerDate: "2026-01-04", label: "E" }),
    ]);

    expect(meta.size).toBe(3);
    expect(meta.get("m1")).toEqual({ offsetY: 10, text: "A" });
    expect(meta.get("m2")).toEqual({ offsetY: 30, text: "B" });
    expect(meta.get("m3")).toEqual({ offsetY: 50, text: "...+2" });
    expect(meta.get("m4")).toBeUndefined();
    expect(meta.get("m5")).toBeUndefined();
  });

  it("resets stacking offset for separate clusters", () => {
    const meta = buildMarkerLabelMeta([
      marker({ id: "c1", markerDate: "2026-01-01", label: "Cluster 1" }),
      marker({ id: "c2", markerDate: "2026-01-10", label: "Cluster 2" }),
    ]);

    expect(meta.get("c1")).toEqual({ offsetY: 10, text: "Cluster 1" });
    expect(meta.get("c2")).toEqual({ offsetY: 10, text: "Cluster 2" });
  });
});
