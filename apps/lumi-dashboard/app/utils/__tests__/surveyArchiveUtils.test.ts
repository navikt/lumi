import { describe, expect, it } from "vitest";
import {
  isSurveyArchived,
  partitionSurveyOptions,
} from "../surveyArchiveUtils";

const surveyMeta = {
  "survey-archived": { archivedAt: "2026-08-01T10:00:00Z" },
  "survey-restored": { archivedAt: null },
};

describe("isSurveyArchived", () => {
  it("is true only for surveys with a non-null archivedAt", () => {
    expect(isSurveyArchived("survey-archived", surveyMeta)).toBe(true);
    expect(isSurveyArchived("survey-restored", surveyMeta)).toBe(false);
    expect(isSurveyArchived("survey-unknown", surveyMeta)).toBe(false);
  });

  it("treats missing surveyMeta as active", () => {
    expect(isSurveyArchived("survey-archived", undefined)).toBe(false);
  });
});

describe("partitionSurveyOptions", () => {
  const availableSurveys = ["survey-a", "survey-archived", "survey-restored"];

  it("hides archived surveys by default", () => {
    const result = partitionSurveyOptions({
      availableSurveys,
      surveyMeta,
      showArchived: false,
    });

    expect(result.active).toEqual(["survey-a", "survey-restored"]);
    expect(result.archived).toEqual([]);
  });

  it("lists archived surveys separately when showArchived is on", () => {
    const result = partitionSurveyOptions({
      availableSurveys,
      surveyMeta,
      showArchived: true,
    });

    expect(result.active).toEqual(["survey-a", "survey-restored"]);
    expect(result.archived).toEqual(["survey-archived"]);
  });

  it("keeps the selected archived survey visible even when showArchived is off", () => {
    const result = partitionSurveyOptions({
      availableSurveys,
      surveyMeta,
      showArchived: false,
      selectedSurveyId: "survey-archived",
    });

    expect(result.archived).toEqual(["survey-archived"]);
  });

  it("reports hasArchived so the toggle only renders when relevant", () => {
    expect(
      partitionSurveyOptions({
        availableSurveys,
        surveyMeta,
        showArchived: false,
      }).hasArchived,
    ).toBe(true);
    expect(
      partitionSurveyOptions({
        availableSurveys: ["survey-a", "survey-restored"],
        surveyMeta,
        showArchived: false,
      }).hasArchived,
    ).toBe(false);
  });

  it("treats all surveys as active when surveyMeta is missing", () => {
    const result = partitionSurveyOptions({
      availableSurveys,
      surveyMeta: undefined,
      showArchived: false,
    });

    expect(result.active).toEqual(availableSurveys);
    expect(result.archived).toEqual([]);
    expect(result.hasArchived).toBe(false);
  });
});
