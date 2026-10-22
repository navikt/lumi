import { describe, expect, it } from "vitest";
import { timelineChartData } from "../TimelineChart";

const TODAY = "2026-10-22"; // A Thursday

describe("timelineChartData", () => {
  it("adds up the days of each ISO week and keeps empty weeks", () => {
    const { interval, points } = timelineChartData(
      {
        "2026-06-03": 2,
        "2026-06-07": 3,
        "2026-10-20": 4,
        "2026-10-22": 1,
      },
      "2026-06-03",
      "2026-10-31",
      TODAY,
    );

    expect(interval).toBe("week");
    expect(points[0]).toMatchObject({
      key: "2026-06-01",
      count: 5,
      partial: true,
      from: "2026-06-03",
      to: "2026-06-07",
      label: "Uke 23, 2026 · 03.06–07.06 (5 av 7 dager)",
    });
    expect(points[1]).toMatchObject({ key: "2026-06-08", count: 0 });
    expect(points.at(-1)).toMatchObject({
      key: "2026-10-19",
      count: 5,
      partial: true,
      to: TODAY,
    });
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(10);
  });

  it("shows every day of a short period, also the days without answers", () => {
    const { interval, points } = timelineChartData(
      { "2026-10-20": 2 },
      "2026-10-16",
      "2026-10-22",
      TODAY,
    );

    expect(interval).toBe("day");
    expect(points.map((point) => [point.key, point.count])).toEqual([
      ["2026-10-16", 0],
      ["2026-10-17", 0],
      ["2026-10-18", 0],
      ["2026-10-19", 0],
      ["2026-10-20", 2],
      ["2026-10-21", 0],
      ["2026-10-22", 0],
    ]);
    expect(points.every((point) => !point.partial)).toBe(true);
  });

  it("does not show days after today", () => {
    const { points } = timelineChartData({}, "2026-10-20", "2026-10-31", TODAY);

    expect(points.at(-1)?.key).toBe(TODAY);
  });

  it("shows the days the API returned when there is no period", () => {
    const { interval, points } = timelineChartData({
      "2026-10-20": 2,
      "2026-10-18": 1,
    });

    expect(interval).toBe("day");
    expect(points.map((point) => point.key)).toEqual([
      "2026-10-18",
      "2026-10-20",
    ]);
  });
});
