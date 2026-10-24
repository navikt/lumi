import { describe, expect, it } from "vitest";
import {
  bucketStart,
  chooseInterval,
  describePartialBuckets,
  formatBucketLabel,
  formatBucketTick,
  isoWeek,
  periodBuckets,
  spansSeveralYears,
} from "../timeBuckets";

const TODAY = "2026-10-22"; // A Thursday

describe("chooseInterval", () => {
  it("shows up to 92 days per day and longer periods per week", () => {
    expect(chooseInterval("2026-07-23", "2026-10-22", TODAY)).toBe("day");
    expect(chooseInterval("2026-07-22", "2026-10-22", TODAY)).toBe("week");
  });

  it("shows up to two years per week and longer periods per month", () => {
    expect(chooseInterval("2024-10-22", "2026-10-22", TODAY)).toBe("week");
    expect(chooseInterval("2024-10-21", "2026-10-22", TODAY)).toBe("month");
  });

  it("does not count days after today", () => {
    expect(chooseInterval("2026-07-23", "2026-12-31", TODAY)).toBe("day");
    expect(chooseInterval("2026-11-01", "2026-12-31", TODAY)).toBe("day");
  });

  it("falls back to days without a valid start", () => {
    expect(chooseInterval(undefined, TODAY, TODAY)).toBe("day");
    expect(chooseInterval("2026-02-30", TODAY, TODAY)).toBe("day");
  });

  it("does not throw for dates that do not exist", () => {
    for (const date of ["2026-13-01", "2026-01-32", "2026-10-32"]) {
      expect(() => chooseInterval(date, TODAY, TODAY)).not.toThrow();
      expect(() => chooseInterval("2026-01-01", date, TODAY)).not.toThrow();
      expect(() => periodBuckets(date, TODAY, "day", TODAY)).not.toThrow();
      expect(() =>
        periodBuckets("2026-01-01", date, "week", TODAY),
      ).not.toThrow();
    }
  });

  it("counts a period without an end, or with an invalid end, up to today", () => {
    expect(chooseInterval("2026-01-01", undefined, TODAY)).toBe("week");
    expect(chooseInterval("2026-01-01", "2026-10-32", TODAY)).toBe("week");
  });
});

describe("periodBuckets", () => {
  it("covers the period with ISO weeks and marks partial first and last weeks", () => {
    const buckets = periodBuckets("2026-10-07", "2026-10-25", "week", TODAY);

    expect(buckets).toEqual([
      {
        start: "2026-10-05",
        end: "2026-10-11",
        from: "2026-10-07",
        to: "2026-10-11",
        partial: true,
      },
      {
        start: "2026-10-12",
        end: "2026-10-18",
        from: "2026-10-12",
        to: "2026-10-18",
        partial: false,
      },
      {
        start: "2026-10-19",
        end: "2026-10-25",
        from: "2026-10-19",
        to: "2026-10-22",
        partial: true,
      },
    ]);
  });

  it("ends at the end of the period when that is before today", () => {
    const buckets = periodBuckets("2026-09-01", "2026-09-30", "day", TODAY);

    expect(buckets).toHaveLength(30);
    expect(buckets.at(-1)?.start).toBe("2026-09-30");
    expect(buckets.every((bucket) => !bucket.partial)).toBe(true);
  });

  it("uses calendar months", () => {
    const buckets = periodBuckets("2024-01-15", "2026-10-31", "month", TODAY);

    expect(buckets[0]).toMatchObject({
      start: "2024-01-01",
      end: "2024-01-31",
      from: "2024-01-15",
      partial: true,
    });
    expect(buckets[1]).toMatchObject({
      start: "2024-02-01",
      end: "2024-02-29",
      partial: false,
    });
    expect(buckets.at(-1)).toMatchObject({
      start: "2026-10-01",
      to: "2026-10-22",
      partial: true,
    });
  });

  it("ends a period without an end today", () => {
    const buckets = periodBuckets("2026-10-20", undefined, "day", TODAY);
    expect(buckets.map((bucket) => bucket.start)).toEqual([
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
  });

  it("returns no buckets without a valid start", () => {
    expect(periodBuckets(undefined, TODAY, "day", TODAY)).toEqual([]);
    expect(periodBuckets("2026-11-01", "2026-11-30", "day", TODAY)).toEqual([]);
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
  const [firstWeek, fullWeek, lastWeek] = periodBuckets(
    "2026-10-07",
    "2026-10-25",
    "week",
    TODAY,
  );

  it("names days with the full date", () => {
    const [day] = periodBuckets(TODAY, TODAY, "day", TODAY);
    expect(day && formatBucketLabel(day, "day")).toBe("22.10.2026");
  });

  it("names weeks with number, year and days, and counts the days of a partial week", () => {
    expect(fullWeek && formatBucketLabel(fullWeek, "week")).toBe(
      "Uke 42, 2026 · 12.10–18.10",
    );
    expect(firstWeek && formatBucketLabel(firstWeek, "week")).toBe(
      "Uke 41, 2026 · 07.10–11.10 (5 av 7 dager)",
    );
    expect(lastWeek && formatBucketLabel(lastWeek, "week")).toBe(
      "Uke 43, 2026 · 19.10–22.10 (4 av 7 dager)",
    );
  });

  it("names a one-day part of a week by that day", () => {
    const [week] = periodBuckets(
      "2026-10-25",
      "2026-10-25",
      "week",
      "2026-10-30",
    );
    expect(week && formatBucketLabel(week, "week")).toBe(
      "Uke 43, 2026 · 25.10 (1 av 7 dager)",
    );
  });

  it("names months, and shows the days of a partial month", () => {
    const [september, october] = periodBuckets(
      "2026-09-01",
      "2026-10-31",
      "month",
      TODAY,
    );
    expect(september && formatBucketLabel(september, "month")).toBe(
      "September 2026",
    );
    expect(october && formatBucketLabel(october, "month")).toBe(
      "Oktober 2026 · 01.10–22.10 (22 av 31 dager)",
    );
  });
});

describe("describePartialBuckets", () => {
  it("names the partial weeks and how the chart shows them", () => {
    expect(
      describePartialBuckets(
        ["2025-12-29", "2026-10-19"],
        "week",
        "lysere søyle",
      ),
    ).toBe(
      "Uke 1 og uke 43 er bare delvis med i perioden og har lysere søyle.",
    );
  });

  it("names the year when the partial weeks are in different years", () => {
    expect(
      describePartialBuckets(
        ["2025-10-20", "2026-10-19"],
        "week",
        "lysere søyle",
      ),
    ).toBe(
      "Uke 43 i 2025 og uke 43 i 2026 er bare delvis med i perioden og har lysere søyle.",
    );
    expect(
      describePartialBuckets(["2024-12-30", "2025-12-29"], "week", "hul prikk"),
    ).toBe(
      "Uke 1 i 2025 og uke 1 i 2026 er bare delvis med i perioden og har hul prikk.",
    );
  });

  it("names partial months with the year", () => {
    expect(describePartialBuckets(["2026-10-01"], "month", "hul prikk")).toBe(
      "Oktober 2026 er bare delvis med i perioden og har hul prikk.",
    );
  });

  it("says nothing without partial buckets or for days", () => {
    expect(describePartialBuckets([], "week", "hul prikk")).toBeUndefined();
    expect(
      describePartialBuckets(["2026-10-22"], "day", "hul prikk"),
    ).toBeUndefined();
  });
});

describe("formatBucketTick", () => {
  it("names days and weeks by their first day in the period", () => {
    const [week] = periodBuckets("2026-10-07", "2026-10-25", "week", TODAY);
    expect(week && formatBucketTick(week, "week", false)).toBe("07.10");
    const [day] = periodBuckets(TODAY, TODAY, "day", TODAY);
    expect(day && formatBucketTick(day, "day", false)).toBe("22.10");
  });

  it("adds the year when the period spans several years", () => {
    const buckets = periodBuckets("2025-12-15", "2026-01-20", "week", TODAY);
    expect(spansSeveralYears(buckets)).toBe(true);
    expect(buckets[0] && formatBucketTick(buckets[0], "week", true)).toBe(
      "15.12.25",
    );
    expect(spansSeveralYears(periodBuckets(TODAY, TODAY, "day", TODAY))).toBe(
      false,
    );
  });

  it("names months with a short month and year", () => {
    const [month] = periodBuckets("2026-10-01", "2026-10-31", "month", TODAY);
    expect(month && formatBucketTick(month, "month", false)).toBe("okt 2026");
  });
});
