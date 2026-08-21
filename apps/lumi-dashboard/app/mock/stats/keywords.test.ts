import { describe, expect, it } from "vitest";

import { calculateFieldStats } from "~/mock/stats";
import type { FeedbackDto } from "~/types/api";

describe("generic text statistics", () => {
  it("returns the same maximum of ten keywords as the API", () => {
    const feedback: FeedbackDto = {
      id: "keyword-limit",
      submittedAt: "2026-08-21T08:00:00Z",
      app: "test-app",
      surveyId: "test-survey",
      sensitiveDataRedacted: false,
      answers: [
        {
          fieldId: "comment",
          fieldType: "TEXT",
          question: { label: "Hva synes du?" },
          value: {
            type: "text",
            text: "alpha beta gamma delta epsilon zeta theta kappa lambda omega",
          },
        },
      ],
    };

    const field = calculateFieldStats([feedback])[0];
    expect(field?.stats.type).toBe("text");
    if (field?.stats.type !== "text") throw new Error("Expected text stats");
    expect(field.stats.topKeywords).toHaveLength(10);
  });
});
