import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMockContextTags, mockFeedbackItems } from "~/mock/mockData";
import type { FeedbackDto } from "~/types/api";

function makeFeedback(partial: Partial<FeedbackDto>): FeedbackDto {
  return {
    id: partial.id ?? "id",
    submittedAt: partial.submittedAt ?? "2026-01-01T12:00:00Z",
    app: partial.app ?? "app-1",
    surveyId: partial.surveyId ?? "survey-test-ctx",
    surveyType: partial.surveyType ?? "rating",
    context: partial.context ?? {
      deviceType: "mobile",
      url: "https://example.test/foo",
      pathname: "/foo",
    },
    metadata: partial.metadata ?? { harAktivSykmelding: "Ja" },
    answers: partial.answers ?? [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 2 },
      },
      {
        fieldId: "text",
        fieldType: "TEXT",
        question: { label: "Hvorfor?" },
        value: { type: "text", text: "har tekst" },
      },
    ],
    tags: partial.tags ?? [],
    sensitiveDataRedacted: partial.sensitiveDataRedacted ?? false,
  };
}

describe("getMockContextTags", () => {
  let original: FeedbackDto[];

  beforeEach(() => {
    original = [...mockFeedbackItems];
    mockFeedbackItems.length = 0;
  });

  afterEach(() => {
    mockFeedbackItems.length = 0;
    mockFeedbackItems.push(...original);
  });

  it("applies date/device/hasText/lowRating/segment consistently", () => {
    const surveyId = "survey-test-ctx";

    mockFeedbackItems.push(
      makeFeedback({
        id: "a",
        surveyId,
        submittedAt: "2026-01-01T10:00:00Z",
        context: { deviceType: "mobile" },
        metadata: { harAktivSykmelding: "Ja" },
        answers: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            question: { label: "Hvordan?" },
            value: { type: "rating", rating: 2 },
          },
          {
            fieldId: "text",
            fieldType: "TEXT",
            question: { label: "Hvorfor?" },
            value: { type: "text", text: "har tekst" },
          },
        ],
      }),
      makeFeedback({
        id: "b",
        surveyId,
        submittedAt: "2026-01-01T11:00:00Z",
        context: { deviceType: "desktop" },
        metadata: { harAktivSykmelding: "Ja" },
        answers: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            question: { label: "Hvordan?" },
            value: { type: "rating", rating: 1 },
          },
          {
            fieldId: "text",
            fieldType: "TEXT",
            question: { label: "Hvorfor?" },
            value: { type: "text", text: "" },
          },
        ],
      }),
      makeFeedback({
        id: "c",
        surveyId,
        submittedAt: "2026-01-02T11:00:00Z",
        context: { deviceType: "mobile" },
        metadata: { harAktivSykmelding: "Nei" },
        answers: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            question: { label: "Hvordan?" },
            value: { type: "rating", rating: 2 },
          },
          {
            fieldId: "text",
            fieldType: "TEXT",
            question: { label: "Hvorfor?" },
            value: { type: "text", text: "utenfor" },
          },
        ],
      }),
    );

    const tags = getMockContextTags(
      surveyId,
      undefined,
      15,
      undefined,
      "harAktivSykmelding:Ja",
      "2026-01-01",
      "2026-01-01",
      "mobile",
      true,
      true,
    );

    expect(tags.harAktivSykmelding).toEqual([{ value: "Ja", count: 1 }]);
  });
});
