import { describe, expect, it } from "vitest";
import type { RatingMarker } from "~/types/api";
import {
  buildMarkerLabelMeta,
  groupMarkersByDate,
  ratingTrendBuckets,
} from "../RatingTrendChart";

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

  it("groups markers by the week they belong to", () => {
    const grouped = groupMarkersByDate(
      [
        marker({ id: "wednesday", markerDate: "2026-10-21" }),
        marker({ id: "sunday", markerDate: "2026-10-25" }),
        marker({ id: "next-monday", markerDate: "2026-10-26" }),
      ],
      "week",
    );

    expect(Object.keys(grouped)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(grouped["2026-10-19"]?.map((entry) => entry.id)).toEqual([
      "wednesday",
      "sunday",
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

  it("stacks the labels of markers in the same week when the chart shows weeks", () => {
    const meta = buildMarkerLabelMeta(
      [
        marker({ id: "monday", markerDate: "2026-10-19", label: "Mandag" }),
        marker({ id: "friday", markerDate: "2026-10-23", label: "Fredag" }),
        marker({ id: "later", markerDate: "2026-11-16", label: "Senere" }),
      ],
      "week",
    );

    expect(meta.get("monday")).toEqual({ offsetY: 10, text: "Mandag" });
    expect(meta.get("friday")).toEqual({ offsetY: 30, text: "Fredag" });
    expect(meta.get("later")).toEqual({ offsetY: 10, text: "Senere" });
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

describe("ratingTrendBuckets", () => {
  it("keeps the week of today partial when a marker is later in the period", () => {
    const buckets = ratingTrendBuckets({
      fromDate: "2026-07-01",
      toDate: "2026-12-31",
      interval: "week",
      today: "2026-10-22",
      markerDates: ["2026-11-10"],
    });

    const thisWeek = buckets.find((bucket) => bucket.start === "2026-10-19");
    expect(thisWeek).toMatchObject({ to: "2026-10-22", partial: true });
    expect(buckets.at(-1)).toMatchObject({
      start: "2026-11-09",
      partial: false,
    });
  });

  it("keeps answers dated after the browser's today", () => {
    const buckets = ratingTrendBuckets({
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      interval: "day",
      today: "2026-10-22",
      latestAnswered: "2026-10-23",
      markerDates: [],
    });

    expect(buckets.at(-1)?.start).toBe("2026-10-23");
  });
});
