import { describe, expect, it } from "vitest";
import {
  formatRelativeSubmissionTime,
  isReceivingAfterArchive,
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

  it("hides the selected archived survey when showArchived is off", () => {
    const result = partitionSurveyOptions({
      availableSurveys,
      surveyMeta,
      showArchived: false,
    });

    expect(result.archived).toEqual([]);
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

describe("formatRelativeSubmissionTime", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("labels same-day submissions as today", () => {
    expect(formatRelativeSubmissionTime("2026-08-11T08:00:00Z", now)).toBe(
      "i dag",
    );
  });

  it("labels one day ago as yesterday", () => {
    expect(formatRelativeSubmissionTime("2026-08-10T08:00:00Z", now)).toBe(
      "i går",
    );
  });

  it("uses days below one month", () => {
    expect(formatRelativeSubmissionTime("2026-08-01T08:00:00Z", now)).toBe(
      "for 10 dager siden",
    );
  });

  it("uses months below one year", () => {
    expect(formatRelativeSubmissionTime("2026-05-11T08:00:00Z", now)).toBe(
      "for 3 md. siden",
    );
  });

  it("uses years beyond one year", () => {
    expect(formatRelativeSubmissionTime("2024-05-11T08:00:00Z", now)).toBe(
      "for 2 år siden",
    );
  });
});

describe("isReceivingAfterArchive", () => {
  it("is true only when a submission arrived after archiving", () => {
    expect(
      isReceivingAfterArchive({
        archivedAt: "2026-08-01T10:00:00Z",
        lastSubmissionAt: "2026-08-05T10:00:00Z",
      }),
    ).toBe(true);
    expect(
      isReceivingAfterArchive({
        archivedAt: "2026-08-01T10:00:00Z",
        lastSubmissionAt: "2026-07-20T10:00:00Z",
      }),
    ).toBe(false);
  });

  it("compares timestamps across offset formats", () => {
    // Backend emits archivedAt as OffsetDateTime (+02:00) and
    // lastSubmissionAt as UTC Instant — string comparison would be wrong.
    expect(
      isReceivingAfterArchive({
        archivedAt: "2026-08-01T12:00:00+02:00",
        lastSubmissionAt: "2026-08-01T10:30:00Z",
      }),
    ).toBe(true);
  });

  it("is false for active surveys and missing data", () => {
    expect(
      isReceivingAfterArchive({
        archivedAt: null,
        lastSubmissionAt: "2026-08-05T10:00:00Z",
      }),
    ).toBe(false);
    expect(
      isReceivingAfterArchive({
        archivedAt: "2026-08-01T10:00:00Z",
        lastSubmissionAt: null,
      }),
    ).toBe(false);
    expect(isReceivingAfterArchive(undefined)).toBe(false);
  });
});
