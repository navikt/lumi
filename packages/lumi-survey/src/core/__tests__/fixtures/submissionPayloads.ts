/**
 * Test fixtures for v1 and v2 submission payloads.
 * Used for contract regression tests ensuring widget payloads
 * conform to the lumi-types contract.
 */
import type {
  FeedbackSubmissionV1,
  FeedbackSubmissionV2,
} from "../../../contracts/lumiApi";

// ============================================
// V1 Payload Fixture
// ============================================

export const v1RatingPayload: FeedbackSubmissionV1 = {
  schemaVersion: 1,
  surveyId: "test-rating-survey",
  surveyType: "rating",
  submittedAt: "2024-06-01T10:02:00.000Z",
  startedAt: "2024-06-01T10:00:00.000Z",
  timeToCompleteMs: 120000,
  context: {
    url: "https://www.nav.no/dagpenger",
    pathname: "/dagpenger",
    deviceType: "desktop",
    viewport: { width: 1920, height: 1080 },
    screenResolution: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0",
    tags: { abTest: "variant-a" },
  },
  answers: [
    {
      fieldId: "rating",
      fieldType: "RATING",
      question: { label: "Hvor fornøyd er du?" },
      value: {
        type: "rating",
        rating: 4,
        ratingVariant: "stars",
        ratingScale: 5,
      },
    },
    {
      fieldId: "comment",
      fieldType: "TEXT",
      question: { label: "Har du en kommentar?" },
      value: { type: "text", text: "Bra tjeneste!" },
    },
  ],
};

// ============================================
// V2 Payload Fixture — complete answers
// ============================================

export const v2CompletePayload: FeedbackSubmissionV2 = {
  schemaVersion: 2,
  surveyId: "test-rating-survey",
  surveyType: "rating",
  submittedAt: "2024-06-01T10:02:00.000Z",
  startedAt: "2024-06-01T10:00:00.000Z",
  timeToCompleteMs: 120000,
  deduplicationKey: "dedup-key-01234567890123456",
  definition: {
    surveyType: "rating",
    fields: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        ratingVariant: "stars",
        ratingScale: 5,
      },
      { fieldId: "comment", fieldType: "TEXT" },
      {
        fieldId: "category",
        fieldType: "SINGLE_CHOICE",
        optionIds: ["bug", "feature"],
      },
    ],
  },
  context: {
    url: "https://www.nav.no/dagpenger",
    pathname: "/dagpenger",
    deviceType: "desktop",
    viewport: { width: 1920, height: 1080 },
    screenResolution: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0",
    tags: { abTest: "variant-a" },
  },
  answers: [
    {
      fieldId: "rating",
      fieldType: "RATING",
      question: { label: "Hvor fornøyd er du?" },
      value: {
        type: "rating",
        rating: 4,
        ratingVariant: "stars",
        ratingScale: 5,
      },
    },
    {
      fieldId: "comment",
      fieldType: "TEXT",
      question: { label: "Har du en kommentar?" },
      value: { type: "text", text: "Bra tjeneste!" },
    },
    {
      fieldId: "category",
      fieldType: "SINGLE_CHOICE",
      question: {
        label: "Kategori?",
        options: [
          { id: "bug", label: "Bug" },
          { id: "feature", label: "Feature" },
        ],
      },
      value: { type: "singleChoice", selectedOptionId: "feature" },
    },
  ],
};

// ============================================
// V2 Payload Fixture — partial answers, complete definition
// ============================================

export const v2PartialAnswersPayload: FeedbackSubmissionV2 = {
  schemaVersion: 2,
  surveyId: "test-rating-survey",
  surveyType: "rating",
  submittedAt: "2024-06-01T10:02:00.000Z",
  startedAt: "2024-06-01T10:00:00.000Z",
  timeToCompleteMs: 120000,
  deduplicationKey: "dedup-partial-0123456789012345",
  definition: {
    surveyType: "rating",
    fields: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        ratingVariant: "stars",
        ratingScale: 5,
      },
      { fieldId: "comment", fieldType: "TEXT" },
      {
        fieldId: "category",
        fieldType: "SINGLE_CHOICE",
        optionIds: ["bug", "feature"],
      },
    ],
  },
  context: null,
  answers: [
    {
      fieldId: "rating",
      fieldType: "RATING",
      question: { label: "Hvor fornøyd er du?" },
      value: {
        type: "rating",
        rating: 3,
        ratingVariant: "stars",
        ratingScale: 5,
      },
    },
    // comment and category not answered — only rating submitted
  ],
};

// ============================================
// V2 Retry Fixture — same deduplicationKey
// ============================================

export const v2RetryPayload: FeedbackSubmissionV2 = {
  ...v2CompletePayload,
  // Retry uses the same deduplicationKey but a later submittedAt
  submittedAt: "2024-06-01T10:03:00.000Z",
};
