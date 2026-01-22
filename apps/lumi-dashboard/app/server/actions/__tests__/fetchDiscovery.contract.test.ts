import { describe, expect, it } from "vitest";

import { DiscoveryResponseSchema } from "~/types/schemas";

describe("fetchDiscovery contract", () => {
  it("validates real-world Discovery response shape", () => {
    const payload = {
      totalSubmissions: 85,
      wordFrequency: [
        {
          word: "sykepenger",
          stem: "sykepeng",
          count: 25,
          variants: [
            { word: "sykepenger", count: 20 },
            { word: "sykepengar", count: 5 },
          ],
          sourceResponses: [
            {
              text: "Jeg kom for å søke sykepenger",
              submittedAt: "2026-01-21T10:00:00Z",
            },
          ],
        },
        {
          word: "arbeidsgiver",
          stem: "arbeidsgiv",
          count: 15,
        },
      ],
      themes: [
        {
          theme: "Økonomi",
          count: 30,
          successRate: 0.75,
          examples: ["Søke om sykepenger", "Finne informasjon om utbetalinger"],
        },
        {
          theme: "Dokumenter",
          count: 20,
          successRate: 0.65,
          examples: ["Laste opp dokumentasjon", "Finne skjema"],
        },
      ],
      recentResponses: [
        {
          task: "Søke om sykepenger",
          success: "yes",
          submittedAt: "2026-01-21T14:30:00Z",
        },
        {
          task: "Finne informasjon om foreldrepenger",
          success: "partial",
          blocker: "Informasjonen var vanskelig å forstå",
          submittedAt: "2026-01-21T13:15:00Z",
        },
        {
          task: "Sjekke status på søknad",
          success: "no",
          blocker: "Kunne ikke logge inn",
          submittedAt: "2026-01-21T12:00:00Z",
        },
      ],
    };

    expect(() => DiscoveryResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects invalid success value in recentResponses", () => {
    const invalidPayload = {
      totalSubmissions: 10,
      wordFrequency: [],
      themes: [],
      recentResponses: [
        {
          task: "Test",
          success: "maybe", // invalid - must be "yes", "partial", or "no"
          submittedAt: "2026-01-21T10:00:00Z",
        },
      ],
    };

    expect(() => DiscoveryResponseSchema.parse(invalidPayload)).toThrow();
  });

  it("validates minimal response with empty arrays", () => {
    const minimalPayload = {
      totalSubmissions: 0,
      wordFrequency: [],
      themes: [],
      recentResponses: [],
    };

    expect(() => DiscoveryResponseSchema.parse(minimalPayload)).not.toThrow();
  });

  it("validates theme structure with all required fields", () => {
    const payload = {
      totalSubmissions: 5,
      wordFrequency: [],
      themes: [
        {
          theme: "Navigation",
          count: 5,
          successRate: 0.6,
          examples: ["Example 1", "Example 2"],
        },
      ],
      recentResponses: [],
    };

    expect(() => DiscoveryResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects theme missing required fields", () => {
    const invalidPayload = {
      totalSubmissions: 5,
      wordFrequency: [],
      themes: [
        {
          theme: "Incomplete Theme",
          // missing count, successRate, examples
        },
      ],
      recentResponses: [],
    };

    expect(() => DiscoveryResponseSchema.parse(invalidPayload)).toThrow();
  });
});
