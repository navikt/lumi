import { describe, expect, it } from "vitest";
import {
  bucketDistance,
  bucketStart,
  buildTimeAxis,
  chooseInterval,
  describePartialBuckets,
  earliestDate,
  formatBucketLabel,
  isCalendarDate,
  isoWeek,
  latestDate,
  resolveSeriesWindow,
  type SeriesWindow,
  sumByBucket,
  type TimeInterval,
} from "../timeBuckets";

const TODAY = "2026-10-22"; // A Thursday

function axis(window: SeriesWindow, interval: TimeInterval) {
  return buildTimeAxis(window, interval);
}

describe("isCalendarDate", () => {
  it("accepts real dates in this century", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2000-01-01")).toBe(true);
  });

  it("rejects dates that do not exist, other formats and other centuries", () => {
    for (const value of [
      "2026-02-30",
      "2026-13-01",
      "2026-01-32",
      "2026-10",
      "0000-01-01",
      "0202-01-01",
      "1999-12-31",
      "2100-01-01",
      "",
      undefined,
      null,
    ]) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });
});

describe("resolveSeriesWindow", () => {
  it("ends at the end of the period, or today when that is earlier", () => {
    expect(
      resolveSeriesWindow({
        fromDate: "2026-09-01",
        toDate: "2026-09-30",
        today: TODAY,
      }),
    ).toEqual({
      window: { from: "2026-09-01", to: "2026-09-30" },
      interval: "day",
    });
    expect(
      resolveSeriesWindow({
        fromDate: "2026-09-01",
        toDate: "2026-12-31",
        today: TODAY,
      })?.window,
    ).toEqual({ from: "2026-09-01", to: TODAY });
  });

  it("starts with the bucket of the first answer when the period has no start", () => {
    // 5 November 2025 is a Wednesday. Nobody answered earlier that week.
    expect(
      resolveSeriesWindow({
        toDate: "2026-10-01",
        today: TODAY,
        firstDataDay: "2025-11-05",
      }),
    ).toEqual({
      window: { from: "2025-11-03", to: "2026-10-01" },
      interval: "week",
    });
    expect(
      resolveSeriesWindow({ today: TODAY, firstDataDay: "2026-09-16" })?.window,
    ).toEqual({ from: "2026-09-16", to: TODAY });
  });

  it("starts at the retention start when the period starts earlier", () => {
    const resolved = resolveSeriesWindow({
      fromDate: "2025-06-01",
      toDate: "2025-12-31",
      today: TODAY,
      firstDataDay: "2025-10-27",
      retentionStartDate: "2025-10-25",
    });
    expect(resolved).toEqual({
      window: { from: "2025-10-25", to: "2025-12-31" },
      interval: "day",
    });
    // Answers the deletion has not reached yet are still shown.
    expect(
      resolveSeriesWindow({
        fromDate: "2025-06-01",
        toDate: "2025-12-31",
        today: TODAY,
        firstDataDay: "2025-10-23",
        retentionStartDate: "2025-10-25",
      })?.window.from,
    ).toBe("2025-10-23");
  });

  it("keeps the deleted days of the first answer's week out of an open start", () => {
    // The week of 26 October 2025 begins on the 20th, before the retention
    // start. The week stays partial.
    expect(
      resolveSeriesWindow({
        toDate: "2026-01-31",
        today: TODAY,
        firstDataDay: "2025-10-26",
        retentionStartDate: "2025-10-25",
      }),
    ).toEqual({
      window: { from: "2025-10-25", to: "2026-01-31" },
      interval: "week",
    });
  });

  it("treats an invalid end as today and gives nothing without a start", () => {
    expect(
      resolveSeriesWindow({
        fromDate: "2026-10-01",
        toDate: "2026-10-32",
        today: TODAY,
      })?.window,
    ).toEqual({ from: "2026-10-01", to: TODAY });
    expect(resolveSeriesWindow({ today: TODAY })).toBeUndefined();
    expect(
      resolveSeriesWindow({ fromDate: "0000-01-01", today: TODAY }),
    ).toBeUndefined();
  });

  it("gives nothing for a period that has not begun", () => {
    expect(
      resolveSeriesWindow({
        fromDate: "2035-01-01",
        toDate: "2035-01-30",
        today: TODAY,
      }),
    ).toBeUndefined();
  });
});

describe("chooseInterval", () => {
  it("shows up to 92 days per day and longer windows per week", () => {
    expect(chooseInterval({ from: "2026-07-23", to: TODAY })).toBe("day");
    expect(chooseInterval({ from: "2026-07-22", to: TODAY })).toBe("week");
  });

  it("shows up to two years per week and longer windows per month", () => {
    expect(chooseInterval({ from: "2024-10-22", to: TODAY })).toBe("week");
    expect(chooseInterval({ from: "2024-10-21", to: TODAY })).toBe("month");
  });

  it("shows weeks without a window", () => {
    expect(chooseInterval(undefined)).toBe("week");
  });
});

describe("buildTimeAxis", () => {
  it("covers the window with ISO weeks and marks partial first and last weeks", () => {
    const { buckets } = axis({ from: "2026-10-07", to: TODAY }, "week");

    expect(
      buckets.map(({ tick: _tick, label: _label, ...bucket }) => bucket),
    ).toEqual([
      {
        start: "2026-10-05",
        calendarEnd: "2026-10-11",
        firstDay: "2026-10-07",
        lastDay: "2026-10-11",
        partial: true,
      },
      {
        start: "2026-10-12",
        calendarEnd: "2026-10-18",
        firstDay: "2026-10-12",
        lastDay: "2026-10-18",
        partial: false,
      },
      {
        start: "2026-10-19",
        calendarEnd: "2026-10-25",
        firstDay: "2026-10-19",
        lastDay: "2026-10-22",
        partial: true,
      },
    ]);
  });

  it("uses calendar months", () => {
    const { buckets } = axis({ from: "2024-01-15", to: TODAY }, "month");

    expect(buckets[0]).toMatchObject({
      start: "2024-01-01",
      calendarEnd: "2024-01-31",
      firstDay: "2024-01-15",
      partial: true,
    });
    expect(buckets[1]).toMatchObject({
      start: "2024-02-01",
      calendarEnd: "2024-02-29",
      partial: false,
    });
    expect(buckets.at(-1)).toMatchObject({
      start: "2026-10-01",
      lastDay: TODAY,
      partial: true,
    });
  });

  it("names the buckets on the axis and in tables", () => {
    const week = axis({ from: "2026-10-07", to: TODAY }, "week");
    expect(week.buckets.map((bucket) => bucket.tick)).toEqual([
      "07.10",
      "12.10",
      "19.10",
    ]);
    expect(week.buckets.map((bucket) => bucket.label)).toEqual([
      "Uke 41, 2026 · 07.10–11.10 (5 av 7 dager)",
      "Uke 42, 2026 · 12.10–18.10",
      "Uke 43, 2026 · 19.10–22.10 (4 av 7 dager)",
    ]);

    const month = axis({ from: "2026-09-01", to: TODAY }, "month");
    expect(month.buckets.map((bucket) => bucket.tick)).toEqual([
      "sep 2026",
      "okt 2026",
    ]);
    expect(month.buckets.map((bucket) => bucket.label)).toEqual([
      "September 2026",
      "Oktober 2026 · 01.10–22.10 (22 av 31 dager)",
    ]);
  });

  it("adds the year to the axis when the window spans several years", () => {
    const { withYear, buckets } = axis(
      { from: "2025-12-15", to: "2026-01-20" },
      "week",
    );
    expect(withYear).toBe(true);
    expect(buckets[0]?.tick).toBe("15.12.25");
    expect(axis({ from: TODAY, to: TODAY }, "day").withYear).toBe(false);
  });

  it("keeps the latest buckets when a chosen resolution gives too many", () => {
    const { buckets } = axis({ from: "2000-01-01", to: TODAY }, "day");
    expect(buckets).toHaveLength(1500);
    expect(buckets.at(-1)?.start).toBe(TODAY);
  });
});

describe("sumByBucket", () => {
  it("adds up the days of each week and skips keys that are not dates", () => {
    expect(
      sumByBucket(
        { "2026-10-19": 2, "2026-10-21": 3, "2026-10-26": 1, nonsense: 9 },
        "week",
      ),
    ).toEqual(
      new Map([
        ["2026-10-19", 5],
        ["2026-10-26", 1],
      ]),
    );
  });
});

describe("earliestDate and latestDate", () => {
  it("find the first and last date without sorting", () => {
    const dates = ["2026-10-02", "2026-09-30", "2026-10-21"];
    expect(earliestDate(dates)).toBe("2026-09-30");
    expect(latestDate(dates)).toBe("2026-10-21");
    expect(latestDate([])).toBeUndefined();
  });
});

describe("isoWeek", () => {
  it("gives the week to the year of its Thursday", () => {
    expect(isoWeek("2025-12-29")).toEqual({ week: 1, year: 2026 });
    expect(isoWeek("2026-10-22")).toEqual({ week: 43, year: 2026 });
    expect(isoWeek("2027-01-01")).toEqual({ week: 53, year: 2026 });
    expect(isoWeek("2027-01-04")).toEqual({ week: 1, year: 2027 });
  });

  it("starts weeks on Monday", () => {
    expect(bucketStart("2026-10-25", "week")).toBe("2026-10-19");
    expect(bucketStart("2026-10-19", "week")).toBe("2026-10-19");
  });
});

describe("formatBucketLabel", () => {
  it("names days with the full date and a one-day part of a week by that day", () => {
    const [day] = axis({ from: TODAY, to: TODAY }, "day").buckets;
    expect(day && formatBucketLabel(day, "day")).toBe("22.10.2026");
    const [week] = axis(
      { from: "2026-10-25", to: "2026-10-25" },
      "week",
    ).buckets;
    expect(week && formatBucketLabel(week, "week")).toBe(
      "Uke 43, 2026 · 25.10 (1 av 7 dager)",
    );
  });
});

describe("describePartialBuckets", () => {
  const bars = {
    one: "lysere søyle med stiplet kant",
    many: "lysere søyler med stiplet kant",
  };
  const dots = { one: "hul prikk", many: "hule prikker" };
  const partial = (window: SeriesWindow, interval: TimeInterval) => {
    const { buckets, withYear } = axis(window, interval);
    return {
      buckets: buckets.filter((bucket) => bucket.partial),
      withYear,
    };
  };

  it("names the partial weeks, the days the chart has and how it draws them", () => {
    const { buckets, withYear } = partial(
      { from: "2026-01-01", to: TODAY },
      "week",
    );
    expect(describePartialBuckets(buckets, "week", bars, withYear)).toBe(
      "Bare 4 av 7 dager i uke 1 og 4 av 7 dager i uke 43 er med i grafen. Ukene har lysere søyler med stiplet kant.",
    );
    expect(
      describePartialBuckets(buckets.slice(1), "week", dots, withYear),
    ).toBe("Bare 4 av 7 dager i uke 43 er med i grafen. Uka har hul prikk.");
  });

  it("names the year when the window spans several years", () => {
    const { buckets, withYear } = partial(
      { from: "2025-10-23", to: TODAY },
      "week",
    );
    expect(withYear).toBe(true);
    expect(
      describePartialBuckets(buckets.slice(-1), "week", dots, withYear),
    ).toBe(
      "Bare 4 av 7 dager i uke 43 i 2026 er med i grafen. Uka har hul prikk.",
    );
  });

  it("names the year when a week belongs to the ISO year next to its days", () => {
    const end = partial({ from: "2025-01-01", to: "2025-12-30" }, "week");
    expect(end.withYear).toBe(false);
    expect(
      describePartialBuckets(end.buckets, "week", dots, end.withYear),
    ).toBe(
      "Bare 5 av 7 dager i uke 1 i 2025 og 2 av 7 dager i uke 1 i 2026 er med i grafen. Ukene har hule prikker.",
    );

    const start = partial({ from: "2027-01-02", to: "2027-04-10" }, "week");
    expect(
      describePartialBuckets(
        start.buckets.slice(0, 1),
        "week",
        dots,
        start.withYear,
      ),
    ).toBe(
      "Bare 2 av 7 dager i uke 53 i 2026 er med i grafen. Uka har hul prikk.",
    );
  });

  it("names partial months with the year", () => {
    const { buckets, withYear } = partial(
      { from: "2026-09-01", to: TODAY },
      "month",
    );
    expect(describePartialBuckets(buckets, "month", dots, withYear)).toBe(
      "Bare 22 av 31 dager i oktober 2026 er med i grafen. Måneden har hul prikk.",
    );
  });

  it("says nothing without partial buckets or for days", () => {
    expect(describePartialBuckets([], "week", dots, false)).toBeUndefined();
    expect(
      describePartialBuckets(
        axis({ from: TODAY, to: TODAY }, "day").buckets,
        "day",
        dots,
        false,
      ),
    ).toBeUndefined();
  });
});

describe("bucketDistance", () => {
  it("counts the days, weeks or months between two buckets", () => {
    expect(bucketDistance("2026-09-06", "2026-09-09", "day")).toBe(3);
    expect(bucketDistance("2026-10-21", "2026-11-04", "week")).toBe(2);
    expect(bucketDistance("2025-11-30", "2026-02-01", "month")).toBe(3);
    expect(bucketDistance("2026-10-21", "2026-10-19", "week")).toBe(0);
  });
});
