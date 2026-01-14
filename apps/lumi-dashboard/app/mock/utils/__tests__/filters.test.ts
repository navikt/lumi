import { describe, expect, it } from "vitest";

import { applyFeedbackFilters } from "~/mock/utils/filters";
import type { FeedbackDto } from "~/types/api";

function makeItem(partial: Partial<FeedbackDto>): FeedbackDto {
  return {
    id: partial.id ?? "id",
    submittedAt: partial.submittedAt ?? "2026-01-01T12:00:00Z",
    app: partial.app ?? "app-1",
    surveyId: partial.surveyId ?? "survey-1",
    surveyType: partial.surveyType ?? "rating",
    context: partial.context ?? {
      deviceType: "mobile",
      url: "https://example.test",
      pathname: "/",
    },
    metadata: partial.metadata ?? null,
    answers: partial.answers ?? [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 3 },
      },
    ],
    tags: partial.tags ?? [],
    sensitiveDataRedacted: partial.sensitiveDataRedacted ?? false,
  };
}

describe("applyFeedbackFilters", () => {
  const itemA = makeItem({
    id: "a",
    submittedAt: "2026-01-01T10:00:00Z",
    context: { deviceType: "mobile" },
    metadata: { k: "v" },
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
  });

  const itemB = makeItem({
    id: "b",
    submittedAt: "2026-01-02T10:00:00Z",
    context: { deviceType: "desktop" },
    metadata: { k: "x" },
    answers: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 5 },
      },
    ],
  });

  const itemC = makeItem({
    id: "c",
    submittedAt: "2026-01-01T11:00:00Z",
    context: { deviceType: "mobile" },
    metadata: null,
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
        value: { type: "text", text: "også tekst" },
      },
    ],
  });

  const items = [itemA, itemB, itemC];

  it("filters by date range (toDate inclusive)", () => {
    const filtered = applyFeedbackFilters(items, {
      fromDate: "2026-01-02",
      toDate: "2026-01-02",
    });

    expect(filtered.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by deviceType", () => {
    const filtered = applyFeedbackFilters(items, { deviceType: "desktop" });
    expect(filtered.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by hasText", () => {
    const filtered = applyFeedbackFilters(items, { hasText: "true" });
    expect(filtered.map((i) => i.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by lowRating (<=2)", () => {
    const filtered = applyFeedbackFilters(items, { lowRating: "true" });
    expect(filtered.map((i) => i.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by segment key:value (requires metadata)", () => {
    const filtered = applyFeedbackFilters(items, { segment: "k:v" });
    expect(filtered.map((i) => i.id)).toEqual(["a"]);
  });

  it("combines segment + hasText + lowRating", () => {
    const filtered = applyFeedbackFilters(items, {
      segment: "k:v",
      hasText: "true",
      lowRating: "true",
    });
    expect(filtered.map((i) => i.id)).toEqual(["a"]);
  });
});
