import { describe, expect, it } from "vitest";

import type { FeedbackSubmission } from "~/types/api";
import {
  FeedbackSubmissionSchema,
  FeedbackSubmissionV1Schema,
  FeedbackSubmissionV2Schema,
} from "~/types/schemas";

describe("submission contract", () => {
  it("accepts valid v1 and v2 payloads in the versioned union schema", () => {
    const v1: FeedbackSubmission = {
      schemaVersion: 1,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    const v2: FeedbackSubmission = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
          {
            fieldId: "followup",
            fieldType: "TEXT",
          },
        ],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV1Schema.parse(v1)).not.toThrow();
    expect(() => FeedbackSubmissionV2Schema.parse(v2)).not.toThrow();
    expect(() => FeedbackSubmissionSchema.parse(v1)).not.toThrow();
    expect(() => FeedbackSubmissionSchema.parse(v2)).not.toThrow();
  });

  it("rejects v2 submissions with empty definition fields", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow();
  });

  it("rejects v2 definitions with duplicate fieldIds", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
          {
            fieldId: "rating",
            fieldType: "TEXT",
          },
        ],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /definition\.fields\.fieldId must be unique/,
    );
  });

  it("rejects v2 definitions when rating fields miss rating metadata", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
          },
        ],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow();
  });

  it("rejects v2 choice definitions with empty or duplicate optionIds", () => {
    const emptyOptionsPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "custom",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "custom",
        fields: [
          {
            fieldId: "category",
            fieldType: "SINGLE_CHOICE",
            optionIds: [],
          },
        ],
      },
      answers: [
        {
          fieldId: "category",
          fieldType: "SINGLE_CHOICE",
          question: {
            label: "Category",
            options: [{ id: "bug", label: "Bug" }],
          },
          value: { type: "singleChoice", selectedOptionId: "bug" },
        },
      ],
    };

    const duplicateOptionsPayload = {
      ...emptyOptionsPayload,
      definition: {
        surveyType: "custom",
        fields: [
          {
            fieldId: "category",
            fieldType: "SINGLE_CHOICE",
            optionIds: ["bug", "bug"],
          },
        ],
      },
    };

    expect(() =>
      FeedbackSubmissionV2Schema.parse(emptyOptionsPayload),
    ).toThrow();
    expect(() =>
      FeedbackSubmissionV2Schema.parse(duplicateOptionsPayload),
    ).toThrow(/optionIds must be unique/);
  });

  it("rejects invalid v2 deduplication keys", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "not valid!",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /deduplicationKey/,
    );
  });

  it("rejects v2 submissions when top-level surveyType mismatches definition", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "custom",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /surveyType must match definition\.surveyType/,
    );
  });

  it("rejects v2 answers whose fieldId is missing from definition", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: "unknown",
          fieldType: "TEXT",
          question: { label: "Unknown" },
          value: { type: "text", text: "No definition" },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /answers\.fieldId must exist in definition\.fields/,
    );
  });

  it("rejects v2 answers whose fieldType differs from definition", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: "rating",
          fieldType: "TEXT",
          question: { label: "Rating" },
          value: { type: "text", text: "Wrong type" },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /answers\.fieldType must match definition fieldType/,
    );
  });

  it("rejects v2 definition fieldIds with backend-illegal characters", () => {
    const invalidPayload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "rating.field",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: "rating.field",
          fieldType: "RATING",
          question: { label: "How was it?" },
          value: {
            type: "rating",
            rating: 4,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /fieldId must contain only letters, digits, hyphen, or underscore/,
    );
  });
});
