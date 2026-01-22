import { describe, expect, it } from "vitest";

import { BlockerResponseSchema } from "~/types/schemas";

describe("fetchBlocker contract", () => {
  it("validates real-world Blocker response shape", () => {
    const payload = {
      totalBlockers: 42,
      wordFrequency: [
        {
          word: "skjema",
          stem: "skjem",
          count: 18,
          variants: [
            { word: "skjema", count: 12 },
            { word: "skjemaet", count: 6 },
          ],
          sourceResponses: [
            {
              text: "Fant ikke skjemaet jeg trengte",
              submittedAt: "2026-01-21T10:00:00Z",
            },
          ],
        },
      ],
      themes: [
        {
          theme: "Skjema",
          themeId: "theme-skjema",
          count: 20,
          examples: ["Fant ikke skjema", "Utydelig skjema"],
          color: "var(--ax-status-warning)",
        },
      ],
      recentBlockers: [
        {
          blocker: "Teknisk feil i skjema",
          task: "Lage oppfølgingsplan",
          submittedAt: "2026-01-21T12:00:00Z",
        },
      ],
    };

    expect(() => BlockerResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects theme missing required fields", () => {
    const invalidPayload = {
      totalBlockers: 1,
      wordFrequency: [],
      themes: [
        {
          theme: "Incomplete",
          // missing themeId, count, examples
        },
      ],
      recentBlockers: [],
    };

    expect(() => BlockerResponseSchema.parse(invalidPayload)).toThrow();
  });
});
