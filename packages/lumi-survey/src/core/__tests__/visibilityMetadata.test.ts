import { describe, expect, it } from "vitest";
import { getVisibilityMetadata } from "../visibilityMetadata.js";

describe("getVisibilityMetadata", () => {
  it("flattens tags, prefers defined context fields, and excludes debug data", () => {
    expect(
      getVisibilityMetadata({
        deviceType: "desktop",
        pathname: "/survey",
        tags: {
          role: "caseworker",
          deviceType: "mobile",
          url: "tag-only-url",
        },
        debug: { sessionId: "not-for-conditions" },
      }),
    ).toEqual({
      role: "caseworker",
      deviceType: "desktop",
      pathname: "/survey",
      url: "tag-only-url",
    });
  });
});
