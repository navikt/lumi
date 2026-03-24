import { describe, expect, it } from "vitest";

import {
  parseRatingParam,
  splitRatingParam,
  stringifyRatingFilters,
} from "~/utils/ratingFilterUtils";

describe("ratingFilterUtils", () => {
  describe("parseRatingParam", () => {
    it("returns an empty object for missing input", () => {
      expect(parseRatingParam(undefined)).toEqual({});
      expect(parseRatingParam("")).toEqual({});
    });

    it("returns an empty object for malformed edge cases", () => {
      expect(parseRatingParam("missing-colon")).toEqual({});
      expect(parseRatingParam(":")).toEqual({});
    });

    it("parses a single rating filter", () => {
      expect(parseRatingParam("satisfaction:5")).toEqual({
        satisfaction: "5",
      });
    });

    it("parses multiple rating filters", () => {
      expect(parseRatingParam("satisfaction:5,recommendation:10")).toEqual({
        satisfaction: "5",
        recommendation: "10",
      });
    });

    it("keeps everything after the first colon as the value", () => {
      expect(parseRatingParam("satisfaction:score:5")).toEqual({
        satisfaction: "score:5",
      });
    });

    it("keeps the last value when the same field appears multiple times", () => {
      expect(parseRatingParam("satisfaction:2,satisfaction:5")).toEqual({
        satisfaction: "5",
      });
    });

    it("ignores malformed filter parts", () => {
      expect(
        parseRatingParam(
          "satisfaction:5,missing-colon,:no-key,recommendation:,nps:10",
        ),
      ).toEqual({
        satisfaction: "5",
        nps: "10",
      });
    });
  });

  describe("stringifyRatingFilters", () => {
    it("returns undefined for empty filters", () => {
      expect(stringifyRatingFilters({})).toBeUndefined();
    });

    it("serializes filters in object entry order", () => {
      expect(
        stringifyRatingFilters({
          satisfaction: "5",
          recommendation: "10",
        }),
      ).toBe("satisfaction:5,recommendation:10");
    });
  });

  describe("splitRatingParam", () => {
    it("returns undefined when there are no valid rating filters", () => {
      expect(splitRatingParam(undefined)).toBeUndefined();
      expect(splitRatingParam("invalid,:missing")).toBeUndefined();
    });

    it("splits valid rating filters into serialized entries", () => {
      expect(splitRatingParam("satisfaction:5,recommendation:10")).toEqual([
        "satisfaction:5",
        "recommendation:10",
      ]);
    });
  });

  describe("round trips", () => {
    it("preserves serialized filters through parse and stringify", () => {
      const serialized = "satisfaction:5,recommendation:10";

      expect(stringifyRatingFilters(parseRatingParam(serialized))).toBe(
        serialized,
      );
    });

    it("round-trips filters through stringify and parse", () => {
      const filters = {
        satisfaction: "5",
        recommendation: "10",
        detail: "score:4",
      };

      const serialized = stringifyRatingFilters(filters);

      expect(serialized).toBe(
        "satisfaction:5,recommendation:10,detail:score:4",
      );
      expect(parseRatingParam(serialized)).toEqual(filters);
    });

    it("keeps split output aligned with stringify output", () => {
      const serialized = stringifyRatingFilters({
        satisfaction: "5",
        recommendation: "10",
      });

      expect(splitRatingParam(serialized)).toEqual([
        "satisfaction:5",
        "recommendation:10",
      ]);
    });
  });
});
