import { describe, expect, it } from "vitest";
import { buildTimeAxis } from "~/utils/timeBuckets";
import { countSeries } from "../TimelineChart";

const TODAY = "2026-10-22"; // A Thursday

describe("countSeries", () => {
  it("adds up the days of each ISO week and keeps empty weeks", () => {
    const series = countSeries(
      buildTimeAxis({ from: "2026-06-03", to: TODAY }, "week"),
      {
        "2026-06-03": 2,
        "2026-06-07": 3,
        "2026-10-20": 4,
        "2026-10-22": 1,
      },
    );

    expect(series.interval).toBe("week");
    expect(series.points[0]).toMatchObject({
      start: "2026-06-01",
      count: 5,
      partial: true,
      firstDay: "2026-06-03",
      lastDay: "2026-06-07",
      label: "Uke 23, 2026 · 03.06–07.06 (5 av 7 dager)",
    });
    expect(series.points[1]).toMatchObject({ start: "2026-06-08", count: 0 });
    expect(series.points.at(-1)).toMatchObject({
      start: "2026-10-19",
      count: 5,
      partial: true,
      lastDay: TODAY,
    });
    expect(series.total).toBe(10);
  });

  it("shows every day of a short window, also the days without answers", () => {
    const series = countSeries(
      buildTimeAxis({ from: "2026-10-16", to: TODAY }, "day"),
      { "2026-10-20": 2 },
    );

    expect(series.points.map((point) => [point.start, point.count])).toEqual([
      ["2026-10-16", 0],
      ["2026-10-17", 0],
      ["2026-10-18", 0],
      ["2026-10-19", 0],
      ["2026-10-20", 2],
      ["2026-10-21", 0],
      ["2026-10-22", 0],
    ]);
    expect(series.points.every((point) => !point.partial)).toBe(true);
  });

  it("adds up the days of each month", () => {
    const series = countSeries(
      buildTimeAxis({ from: "2024-01-15", to: TODAY }, "month"),
      { "2024-02-10": 1, "2024-02-29": 2, "2026-10-01": 4 },
    );

    expect(series.interval).toBe("month");
    expect(
      series.points.find((point) => point.start === "2024-02-01")?.count,
    ).toBe(3);
    expect(series.points[0]).toMatchObject({
      start: "2024-01-01",
      partial: true,
    });
    expect(series.points.at(-1)).toMatchObject({
      start: "2026-10-01",
      count: 4,
    });
  });

  it("counts only the days on the axis", () => {
    const series = countSeries(
      buildTimeAxis({ from: "2026-10-20", to: TODAY }, "day"),
      { "2026-10-19": 7, "2026-10-21": 1, "2026-10-23": 5 },
    );

    expect(series.total).toBe(1);
  });

  it("keeps SVG attribute names such as from and to out of its points", () => {
    const [point] = countSeries(
      buildTimeAxis({ from: TODAY, to: TODAY }, "day"),
      {},
    ).points;

    expect(point).not.toHaveProperty("from");
    expect(point).not.toHaveProperty("to");
    expect(point).not.toHaveProperty("end");
  });
});
