import { describe, expect, it } from "vitest";

import { transformToBackendParams } from "~/server/actions/fetchFeedback";

describe("fetchFeedback helpers", () => {
  it("transforms frontend params to backend params including theme/task", () => {
    const params = transformToBackendParams({
      page: "2",
      size: "25",
      tag: " a, b ",
      segment: "k:v,,x:y",
      lowRating: "true",
      hasText: "false",
      theme: "theme-1",
      task: "Oppfolging",
    });

    expect(params.page).toBe("1");
    expect(params.size).toBe("25");
    expect(params.tag).toEqual(["a", "b"]);
    expect(params.segment).toEqual(["k:v", "x:y"]);
    expect(params.lowRating).toBe("true");
    expect(params.hasText).toBeUndefined();
    expect(params.theme).toBe("theme-1");
    expect(params.task).toBe("Oppfolging");
  });
});
