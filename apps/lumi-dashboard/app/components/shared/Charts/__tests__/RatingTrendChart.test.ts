import { describe, expect, it } from "vitest";
import type { QuestionTrendResponse, RatingMarker } from "~/types/api";
import { buildTimeAxis } from "~/utils/timeBuckets";
import {
  buildMarkerLabelMeta,
  groupMarkersByBucket,
  ratingSeries,
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

function trend(
  buckets: Array<{ startDate: string; average: number }>,
): QuestionTrendResponse {
  return {
    fieldId: "rating",
    fieldType: "RATING",
    label: "Vurdering",
    interval: "week",
    privacyThreshold: 5,
    ratingVariant: "emoji",
    ratingScale: 5,
    options: [],
    buckets: buckets.map((bucket) => ({
      ...bucket,
      masked: false,
      responseCount: 5,
      distribution: {},
    })),
  } as unknown as QuestionTrendResponse;
}

describe("groupMarkersByBucket", () => {
  it("groups markers by date and sorts each date by createdAt", () => {
    const grouped = groupMarkersByBucket(
      [
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
        marker({ id: "other-date", markerDate: "2026-01-11" }),
      ],
      "day",
    );

    expect(grouped.get("2026-01-10")?.map((entry) => entry.id)).toEqual([
      "early",
      "late",
    ]);
    expect(grouped.get("2026-01-11")?.map((entry) => entry.id)).toEqual([
      "other-date",
    ]);
  });

  it("puts the markers of a week in date order, also when they were made the other way round", () => {
    const grouped = groupMarkersByBucket(
      [
        marker({
          id: "wednesday",
          markerDate: "2026-10-21",
          createdAt: "2026-10-20T10:00:00Z",
        }),
        marker({
          id: "monday",
          markerDate: "2026-10-19",
          createdAt: "2026-10-22T10:00:00Z",
        }),
        marker({ id: "next-monday", markerDate: "2026-10-26" }),
      ],
      "week",
    );

    expect([...grouped.keys()]).toEqual(["2026-10-19", "2026-10-26"]);
    expect(grouped.get("2026-10-19")?.map((entry) => entry.id)).toEqual([
      "monday",
      "wednesday",
    ]);
  });
});

describe("buildMarkerLabelMeta", () => {
  it("stacks the labels of markers that are close and keeps rows three days apart", () => {
    const meta = buildMarkerLabelMeta([
      marker({ id: "a", markerDate: "2026-01-01", label: "A" }),
      marker({ id: "b", markerDate: "2026-01-03", label: "B" }),
      marker({ id: "c", markerDate: "2026-01-04", label: "C" }),
      marker({ id: "d", markerDate: "2026-01-04", label: "D" }),
    ]);

    expect(meta.get("a")).toEqual({ offsetY: 10, text: "A" });
    expect(meta.get("b")).toEqual({ offsetY: 30, text: "B" });
    expect(meta.get("c")).toEqual({ offsetY: 10, text: "C" });
    expect(meta.get("d")).toEqual({ offsetY: 50, text: "D" });
  });

  it("sums up the labels that do not fit with ...+N", () => {
    const meta = buildMarkerLabelMeta([
      marker({ id: "m1", markerDate: "2026-01-01", label: "A" }),
      marker({ id: "m2", markerDate: "2026-01-02", label: "B" }),
      marker({ id: "m3", markerDate: "2026-01-03", label: "C" }),
      marker({ id: "m4", markerDate: "2026-01-03", label: "D" }),
      marker({ id: "m5", markerDate: "2026-01-04", label: "E" }),
    ]);

    expect(meta.get("m1")).toEqual({ offsetY: 10, text: "A" });
    expect(meta.get("m2")).toEqual({ offsetY: 30, text: "B" });
    // C has the top row and stands for itself and D.
    expect(meta.get("m3")).toEqual({ offsetY: 50, text: "...+2" });
    expect(meta.get("m4")).toBeUndefined();
    expect(meta.get("m5")).toEqual({ offsetY: 10, text: "E" });
  });

  it("never puts two labels in one row less than three buckets apart", () => {
    const dates = Array.from({ length: 40 }, (_, index) => {
      const day = 1 + ((index * 7) % 28);
      return `2026-03-${String(day).padStart(2, "0")}`;
    });
    const markers = dates.map((markerDate, index) =>
      marker({ id: `m${index}`, markerDate, label: `M${index}` }),
    );
    const meta = buildMarkerLabelMeta(markers);
    const byRow = new Map<number, string[]>();
    for (const item of markers) {
      const offset = meta.get(item.id)?.offsetY;
      if (offset === undefined) continue;
      byRow.set(offset, [...(byRow.get(offset) ?? []), item.markerDate]);
    }

    for (const rowDates of byRow.values()) {
      const sorted = [...rowDates].sort();
      for (let index = 1; index < sorted.length; index += 1) {
        const gap =
          (Date.parse(sorted[index] ?? "") -
            Date.parse(sorted[index - 1] ?? "")) /
          864e5;
        expect(gap).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the labels of markers that come every week", () => {
    const markers = [
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ].map((markerDate, index) =>
      marker({
        id: `week-${index + 1}`,
        markerDate,
        label: `Utgivelse ${index + 1}`,
      }),
    );

    const meta = buildMarkerLabelMeta(markers, "week");

    for (const item of markers) {
      expect(meta.get(item.id)?.text).toBe(item.label);
    }
  });
});

describe("ratingSeries", () => {
  const axis = buildTimeAxis({ from: "2026-07-01", to: "2026-10-22" }, "week");

  it("puts the averages and the markers in the buckets of their dates", () => {
    const series = ratingSeries(
      axis,
      trend([{ startDate: "2026-10-12", average: 3.5 }]),
      [marker({ id: "release", markerDate: "2026-10-14" })],
    );

    const week = series.points.find((point) => point.start === "2026-10-12");
    expect(week).toMatchObject({ average: 3.5, count: 5, partial: false });
    expect(week?.markers.map((item) => item.id)).toEqual(["release"]);
    expect(series.points.at(-1)).toMatchObject({
      start: "2026-10-19",
      lastDay: "2026-10-22",
      partial: true,
      average: null,
    });
  });

  it("ends the axis today and keeps markers before and after it apart", () => {
    const series = ratingSeries(axis, trend([]), [
      marker({ id: "earlier", markerDate: "2026-06-20" }),
      marker({ id: "now", markerDate: "2026-10-20" }),
      marker({ id: "later", markerDate: "2026-11-10" }),
    ]);

    expect(series.points.at(-1)?.start).toBe("2026-10-19");
    expect(
      series.points.flatMap((point) => point.markers.map((m) => m.id)),
    ).toEqual(["now"]);
    expect(series.earlierMarkers.map((item) => item.id)).toEqual(["earlier"]);
    expect(series.laterMarkers.map((item) => item.id)).toEqual(["later"]);
  });

  it("names markers after today when the period has not begun", () => {
    const series = ratingSeries(
      undefined,
      undefined,
      [
        marker({ id: "earlier", markerDate: "2026-10-01" }),
        marker({ id: "later", markerDate: "2026-11-10" }),
      ],
      "2026-10-22",
    );

    expect(series.points).toEqual([]);
    expect(series.laterMarkers.map((item) => item.id)).toEqual(["later"]);
    expect(series.earlierMarkers).toEqual([]);
  });

  it("is empty without an axis", () => {
    expect(ratingSeries(undefined, undefined, [])).toMatchObject({
      points: [],
      earlierMarkers: [],
      laterMarkers: [],
    });
  });
});
