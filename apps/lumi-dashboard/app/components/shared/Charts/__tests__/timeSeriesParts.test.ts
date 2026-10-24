import { describe, expect, it } from "vitest";
import { bucketFeedbackSearch } from "../timeSeriesParts";

describe("bucketFeedbackSearch", () => {
  it("opens the bucket with the filters the charts count with", () => {
    const search = bucketFeedbackSearch(
      {
        team: "flex",
        app: "ditt-sykefravaer",
        surveyId: "survey-1",
        deviceType: "mobile",
        segment: "rolle:leder",
        task: "soke",
        dateMode: "relative",
        periodPreset: "last30",
        page: "4",
        phrase: "hindring:fant ikke",
        theme: "innlogging",
        hasText: "true",
        lowRating: "true",
        query: "skjema",
        tag: "beta",
      },
      { firstDay: "2026-10-19", lastDay: "2026-10-22" },
    );

    expect(search).toMatchObject({
      team: "flex",
      app: "ditt-sykefravaer",
      surveyId: "survey-1",
      deviceType: "mobile",
      segment: "rolle:leder",
      task: "soke",
      dateMode: "fixed",
      fromDate: "2026-10-19",
      toDate: "2026-10-22",
      page: "1",
    });
    // Only Tilbakemeldinger applies these, and the charts count without them.
    for (const key of [
      "phrase",
      "theme",
      "hasText",
      "lowRating",
      "query",
      "tag",
      "periodPreset",
    ]) {
      expect(search).toHaveProperty(key, undefined);
    }
  });
});
