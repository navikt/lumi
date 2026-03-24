import { describe, expect, it } from "vitest";

import {
  parseChoiceParam,
  splitChoiceParam,
  stringifyChoiceFilters,
} from "~/utils/choiceFilterUtils";

describe("choiceFilterUtils", () => {
  describe("parseChoiceParam", () => {
    it("returns an empty object for missing input", () => {
      expect(parseChoiceParam(undefined)).toEqual({});
      expect(parseChoiceParam("")).toEqual({});
    });

    it("returns an empty object for malformed edge cases", () => {
      expect(parseChoiceParam("missing-colon")).toEqual({});
      expect(parseChoiceParam(":")).toEqual({});
    });

    it("parses a single choice filter", () => {
      expect(parseChoiceParam("task:application")).toEqual({
        task: "application",
      });
    });

    it("parses multiple choice filters", () => {
      expect(parseChoiceParam("task:application,channel:chat")).toEqual({
        task: "application",
        channel: "chat",
      });
    });

    it("keeps everything after the first colon as the value", () => {
      expect(parseChoiceParam("task:application:step-1")).toEqual({
        task: "application:step-1",
      });
    });

    it("keeps the last value when the same field appears multiple times", () => {
      expect(parseChoiceParam("task:application,task:appeal")).toEqual({
        task: "appeal",
      });
    });

    it("ignores malformed filter parts", () => {
      expect(
        parseChoiceParam(
          "task:application,missing-colon,:no-key,channel:,valid:web",
        ),
      ).toEqual({
        task: "application",
        valid: "web",
      });
    });
  });

  describe("stringifyChoiceFilters", () => {
    it("returns undefined for empty filters", () => {
      expect(stringifyChoiceFilters({})).toBeUndefined();
    });

    it("serializes filters in object entry order", () => {
      expect(
        stringifyChoiceFilters({
          task: "application",
          channel: "chat",
        }),
      ).toBe("task:application,channel:chat");
    });
  });

  describe("splitChoiceParam", () => {
    it("returns undefined when there are no valid choice filters", () => {
      expect(splitChoiceParam(undefined)).toBeUndefined();
      expect(splitChoiceParam("invalid,:missing")).toBeUndefined();
    });

    it("splits valid choice filters into serialized entries", () => {
      expect(splitChoiceParam("task:application,channel:chat")).toEqual([
        "task:application",
        "channel:chat",
      ]);
    });
  });

  describe("round trips", () => {
    it("preserves serialized filters through parse and stringify", () => {
      const serialized = "task:application,channel:chat";

      expect(stringifyChoiceFilters(parseChoiceParam(serialized))).toBe(
        serialized,
      );
    });

    it("round-trips filters through stringify and parse", () => {
      const filters = {
        task: "application",
        channel: "chat",
        step: "application:step-1",
      };

      const serialized = stringifyChoiceFilters(filters);

      expect(serialized).toBe(
        "task:application,channel:chat,step:application:step-1",
      );
      expect(parseChoiceParam(serialized)).toEqual(filters);
    });

    it("keeps split output aligned with stringify output", () => {
      const serialized = stringifyChoiceFilters({
        task: "application",
        channel: "chat",
      });

      expect(splitChoiceParam(serialized)).toEqual([
        "task:application",
        "channel:chat",
      ]);
    });
  });
});
