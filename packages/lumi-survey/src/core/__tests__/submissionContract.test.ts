import { describe, expect, it } from "vitest";
import type {
  FeedbackSubmission,
  FeedbackSubmissionV1,
  FeedbackSubmissionV2,
} from "../../contracts/lumiApi";
import {
  v1RatingPayload,
  v2CompletePayload,
  v2PartialAnswersPayload,
  v2RetryPayload,
} from "./fixtures/submissionPayloads";

describe("submission contract regression", () => {
  describe("v1 payload", () => {
    it("has schemaVersion 1 and required fields", () => {
      const payload: FeedbackSubmissionV1 = v1RatingPayload;
      expect(payload.schemaVersion).toBe(1);
      expect(payload.surveyId).toBeDefined();
      expect(payload.surveyType).toBeDefined();
      expect(payload.submittedAt).toBeDefined();
      expect(payload.answers.length).toBeGreaterThan(0);
    });

    it("does NOT have definition and may omit deduplicationKey at runtime", () => {
      const payload = v1RatingPayload as unknown as Record<string, unknown>;
      expect(payload).not.toHaveProperty("definition");
      expect(payload).not.toHaveProperty("deduplicationKey");
    });

    it("allows optional deduplicationKey in the v1 type contract", () => {
      const withNull: FeedbackSubmissionV1 = {
        ...v1RatingPayload,
        deduplicationKey: null,
      };
      const withString: FeedbackSubmissionV1 = {
        ...v1RatingPayload,
        deduplicationKey: "dedup-key-01234567890123456",
      };

      expect(withNull.deduplicationKey).toBeNull();
      expect(withString.deduplicationKey).toBe("dedup-key-01234567890123456");
    });

    it("is assignable to FeedbackSubmission union", () => {
      // Type-level check: v1 is part of the discriminated union
      const _submission: FeedbackSubmission = v1RatingPayload;
      expect(_submission.schemaVersion).toBe(1);
    });
  });

  describe("v2 payload — complete", () => {
    it("has schemaVersion 2 with definition and deduplicationKey", () => {
      const payload: FeedbackSubmissionV2 = v2CompletePayload;
      expect(payload.schemaVersion).toBe(2);
      expect(payload.deduplicationKey).toBeDefined();
      expect(payload.definition).toBeDefined();
      expect(payload.definition.surveyType).toBe(payload.surveyType);
    });

    it("deduplicationKey matches format constraints", () => {
      expect(v2CompletePayload.deduplicationKey.length).toBeGreaterThanOrEqual(
        16,
      );
      expect(v2CompletePayload.deduplicationKey.length).toBeLessThanOrEqual(
        128,
      );
      expect(v2CompletePayload.deduplicationKey).toMatch(/^[A-Za-z0-9._:-]+$/);
    });

    it("definition.fields covers all survey questions", () => {
      expect(v2CompletePayload.definition.fields).toHaveLength(3);
      expect(v2CompletePayload.definition.fields[0].fieldType).toBe("RATING");
      expect(v2CompletePayload.definition.fields[1].fieldType).toBe("TEXT");
      expect(v2CompletePayload.definition.fields[2].fieldType).toBe(
        "SINGLE_CHOICE",
      );
    });

    it("is assignable to FeedbackSubmission union", () => {
      const _submission: FeedbackSubmission = v2CompletePayload;
      expect(_submission.schemaVersion).toBe(2);
    });
  });

  describe("v2 payload — partial answers with complete definition", () => {
    it("has fewer answers than definition fields", () => {
      const payload = v2PartialAnswersPayload;
      expect(payload.definition.fields.length).toBeGreaterThan(
        payload.answers.length,
      );
    });

    it("definition still describes all possible fields", () => {
      expect(v2PartialAnswersPayload.definition.fields).toHaveLength(3);
    });

    it("answers only contains actually answered fields", () => {
      expect(v2PartialAnswersPayload.answers).toHaveLength(1);
      expect(v2PartialAnswersPayload.answers[0].fieldId).toBe("rating");
    });
  });

  describe("v2 retry — same deduplicationKey", () => {
    it("retry has same deduplicationKey as original", () => {
      expect(v2RetryPayload.deduplicationKey).toBe(
        v2CompletePayload.deduplicationKey,
      );
    });

    it("retry has a different submittedAt", () => {
      expect(v2RetryPayload.submittedAt).not.toBe(
        v2CompletePayload.submittedAt,
      );
    });
  });

  describe("v1/v2 structural differences", () => {
    it("v1 fixture still omits definition and optional deduplicationKey at runtime", () => {
      const v1 = v1RatingPayload as unknown as Record<string, unknown>;
      expect(v1).not.toHaveProperty("definition");
      expect(v1).not.toHaveProperty("deduplicationKey");
    });

    it("v2 has all v1 required fields plus required definition and deduplicationKey", () => {
      const v2 = v2CompletePayload;
      // Shared fields
      expect(v2.surveyId).toBeDefined();
      expect(v2.surveyType).toBeDefined();
      expect(v2.submittedAt).toBeDefined();
      expect(v2.answers).toBeDefined();
      // V2-specific
      expect(v2.definition).toBeDefined();
      expect(v2.deduplicationKey).toBeDefined();
    });

    it("surveyType at top level matches definition.surveyType in v2", () => {
      expect(v2CompletePayload.surveyType).toBe(
        v2CompletePayload.definition.surveyType,
      );
      expect(v2PartialAnswersPayload.surveyType).toBe(
        v2PartialAnswersPayload.definition.surveyType,
      );
    });
  });
});
