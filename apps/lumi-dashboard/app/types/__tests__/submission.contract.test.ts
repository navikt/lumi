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

  it("rejects v2 definition fieldId exceeding 200 characters", () => {
    const longFieldId = "a".repeat(201);
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
            fieldId: longFieldId,
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /fieldId must not exceed 200 characters/,
    );
  });

  it("accepts v2 definition fieldId of exactly 200 characters", () => {
    const maxFieldId = "a".repeat(200);
    const payload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: maxFieldId,
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: maxFieldId,
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

    expect(() => FeedbackSubmissionV2Schema.parse(payload)).not.toThrow();
  });

  it("accepts Unicode fieldId (e.g. Norwegian letters and digits)", () => {
    // Backend uses Character.isLetterOrDigit() which allows Unicode letters/digits
    const payload = {
      schemaVersion: 2,
      surveyId: "survey-1",
      surveyType: "rating",
      submittedAt: "2026-01-21T12:00:00.000Z",
      deduplicationKey: "retryable-submit:survey-1",
      definition: {
        surveyType: "rating",
        fields: [
          {
            fieldId: "følelse_1",
            fieldType: "RATING",
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        ],
      },
      answers: [
        {
          fieldId: "følelse_1",
          fieldType: "RATING",
          question: { label: "Hvordan følte du deg?" },
          value: {
            type: "rating",
            rating: 3,
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(payload)).not.toThrow();
  });

  it("rejects v2 definition fieldIds with non-decimal Unicode numeric chars (² and Ⅻ)", () => {
    // \p{N} matches ALL Unicode number categories (including superscript digits and
    // Roman numerals), but backend Kotlin isLetterOrDigit() only accepts \p{L} and \p{Nd}.
    // Superscript TWO (U+00B2) and ROMAN NUMERAL TWELVE (U+216C) are \p{No} / \p{Nl},
    // not decimal digits, so they must be rejected.
    const illegalFieldIds = ["field²", "fieldⅫ"];

    for (const illegalId of illegalFieldIds) {
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
              fieldId: illegalId,
              fieldType: "RATING",
              ratingVariant: "emoji",
              ratingScale: 5,
            },
          ],
        },
        answers: [],
      };

      expect(
        () => FeedbackSubmissionV2Schema.parse(invalidPayload),
        `expected non-decimal fieldId "${illegalId}" to be rejected`,
      ).toThrow(/fieldId must contain only letters, digits, hyphen, or underscore/);
    }
  });

  it("rejects v2 definition optionIds that are blank or whitespace-only", () => {
    // Backend uses optionId.isBlank() to reject whitespace-only strings.
    // Space (charCode 32) is not a control char and not a JSONPath special char —
    // so without an explicit blank-check it would previously slip through .min(1).
    const blankOptionIds = [" ", "   "];

    for (const blankId of blankOptionIds) {
      const invalidPayload = {
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
              optionIds: [blankId],
            },
          ],
        },
        answers: [],
      };

      expect(
        () => FeedbackSubmissionV2Schema.parse(invalidPayload),
        `expected blank optionId "${JSON.stringify(blankId)}" to be rejected`,
      ).toThrow(/optionId must not be blank/);
    }
  });

  it("rejects v2 definition optionId exceeding 200 characters", () => {
    const longOptionId = "a".repeat(201);
    const invalidPayload = {
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
            optionIds: [longOptionId],
          },
        ],
      },
      answers: [],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(invalidPayload)).toThrow(
      /optionId must not exceed 200 characters/,
    );
  });

  it("accepts v2 definition optionId of exactly 200 characters", () => {
    const maxOptionId = "a".repeat(200);
    const payload = {
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
            optionIds: [maxOptionId],
          },
        ],
      },
      answers: [
        {
          fieldId: "category",
          fieldType: "SINGLE_CHOICE",
          question: {
            label: "Category",
            options: [{ id: maxOptionId, label: "Option" }],
          },
          value: { type: "singleChoice", selectedOptionId: maxOptionId },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(payload)).not.toThrow();
  });

  it("rejects v2 definition optionIds containing JSONPath special characters", () => {
    // Backend JSON_PATH_SPECIAL_CHARS = {'"', '\\', '$', '@', '?', '(', ')', ','}
    // '(' is tested via "opt(1", ')' is tested in isolation to ensure both are covered independently.
    const illegalOptionIds = [
      'opt"1',
      "opt\\1",
      "opt$1",
      "opt@1",
      "opt?1",
      "opt(1",
      ")",
      "opt,1",
    ];

    for (const illegalId of illegalOptionIds) {
      const invalidPayload = {
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
              optionIds: [illegalId],
            },
          ],
        },
        answers: [],
      };

      expect(
        () => FeedbackSubmissionV2Schema.parse(invalidPayload),
        `expected "${illegalId}" to be rejected`,
      ).toThrow(/optionId contains illegal characters/);
    }
  });

  it("rejects v2 definition optionIds containing control characters", () => {
    // Backend: it.code < 32 is forbidden (includes \n, \r, \t, \0)
    const controlCharOptionIds = ["opt\n1", "opt\r1", "opt\t1", "opt\x001"];

    for (const illegalId of controlCharOptionIds) {
      const invalidPayload = {
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
              optionIds: [illegalId],
            },
          ],
        },
        answers: [],
      };

      expect(
        () => FeedbackSubmissionV2Schema.parse(invalidPayload),
        `expected control char optionId to be rejected`,
      ).toThrow(/optionId contains illegal characters/);
    }
  });

  it("accepts v2 definition optionIds that are valid per backend rules", () => {
    // Backend allows: alphanumeric, hyphens, spaces, international chars etc.
    const validOptionIds = ["opt-1", "Svært ofte", "option_A", "123", "a b c"];
    const payload = {
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
            optionIds: validOptionIds,
          },
        ],
      },
      answers: [
        {
          fieldId: "category",
          fieldType: "SINGLE_CHOICE",
          question: {
            label: "Category",
            options: validOptionIds.map((id) => ({ id, label: id })),
          },
          value: { type: "singleChoice", selectedOptionId: "opt-1" },
        },
      ],
    };

    expect(() => FeedbackSubmissionV2Schema.parse(payload)).not.toThrow();
  });
});
