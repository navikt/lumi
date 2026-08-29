import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FeedbackSubmissionV2Schema,
  FilterBootstrapResponseSchema,
} from "./schemas.ts";

const v2Submission = {
  schemaVersion: 2,
  surveyId: "survey",
  surveyType: "custom",
  submittedAt: "2026-08-29T12:00:00Z",
  deduplicationKey: "deduplication-key-123",
  definition: {
    surveyType: "custom",
    fields: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        ratingVariant: "nps",
        ratingScale: 11,
      },
      { fieldId: "details", fieldType: "TEXT" },
    ],
  },
  flow: {
    schemaVersion: 1,
    evaluatorVersion: "visible-if-v1",
    fields: [
      { fieldId: "rating" },
      {
        fieldId: "details",
        visibleIf: {
          combinator: "ALL",
          conditions: [
            { source: "ANSWER", key: "rating", operator: "LT", value: 7 },
          ],
        },
      },
    ],
  },
  answers: [
    {
      fieldId: "rating",
      fieldType: "RATING",
      question: { label: "Rating" },
      value: {
        type: "rating",
        rating: 5,
        ratingVariant: "nps",
        ratingScale: 11,
      },
    },
  ],
};

test("submission v2 accepts a complete visibleIf flow contract", () => {
  assert.equal(
    FeedbackSubmissionV2Schema.parse(v2Submission).flow?.evaluatorVersion,
    "visible-if-v1",
  );
});

test("submission v2 rejects flow fields that do not match the definition", () => {
  assert.throws(() =>
    FeedbackSubmissionV2Schema.parse({
      ...v2Submission,
      flow: {
        ...v2Submission.flow,
        fields: [...v2Submission.flow.fields].reverse(),
      },
    }),
  );
});

test("submission v2 rejects flow values outside bounded field and metadata domains", () => {
  const invalidRating = structuredClone(v2Submission);
  invalidRating.flow.fields[1].visibleIf.conditions[0].value = "7";

  const oversizedPredicate = structuredClone(v2Submission);
  oversizedPredicate.flow.fields[1].visibleIf.conditions[0].value = "x".repeat(
    2_049,
  );

  const invalidMetadata = structuredClone(v2Submission);
  invalidMetadata.flow.fields[1].visibleIf.conditions[0] = {
    source: "METADATA",
    key: "deviceType",
    operator: "GT",
    value: 7,
  };

  assert.throws(() => FeedbackSubmissionV2Schema.parse(invalidRating));
  assert.throws(() => FeedbackSubmissionV2Schema.parse(oversizedPredicate));
  assert.throws(() => FeedbackSubmissionV2Schema.parse(invalidMetadata));

  const blankMetadataKey = structuredClone(v2Submission);
  blankMetadataKey.flow.fields[1].visibleIf.conditions[0].source = "METADATA";
  blankMetadataKey.flow.fields[1].visibleIf.conditions[0].key = "   ";
  assert.throws(() => FeedbackSubmissionV2Schema.parse(blankMetadataKey));
});

test("filter bootstrap preserves app-specific survey metadata", () => {
  const archivedAt = "2023-01-01T00:00:00Z";
  const parsed = FilterBootstrapResponseSchema.parse({
    generatedAt: "2026-08-21T12:00:00Z",
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    deviceTypes: ["desktop"],
    apps: ["app-a", "app-b"],
    surveysByApp: {
      "app-a": ["shared-survey"],
      "app-b": ["shared-survey"],
    },
    tags: [],
    surveyMeta: {
      "shared-survey": {
        archivedAt,
        firstSubmissionAt: "2020-01-15T09:00:00Z",
        lastSubmissionAt: "2022-09-20T12:00:00Z",
      },
    },
    surveyMetaByApp: {
      "app-a": {
        "shared-survey": {
          archivedAt,
          firstSubmissionAt: "2020-01-15T09:00:00Z",
          lastSubmissionAt: "2020-01-15T09:00:00Z",
        },
      },
      "app-b": {
        "shared-survey": {
          archivedAt,
          firstSubmissionAt: "2021-06-10T10:00:00Z",
          lastSubmissionAt: "2022-09-20T12:00:00Z",
        },
      },
    },
  });

  assert.deepEqual(parsed.surveyMetaByApp, {
    "app-a": {
      "shared-survey": {
        archivedAt,
        firstSubmissionAt: "2020-01-15T09:00:00Z",
        lastSubmissionAt: "2020-01-15T09:00:00Z",
      },
    },
    "app-b": {
      "shared-survey": {
        archivedAt,
        firstSubmissionAt: "2021-06-10T10:00:00Z",
        lastSubmissionAt: "2022-09-20T12:00:00Z",
      },
    },
  });
});

test("filter bootstrap remains compatible when app-specific metadata is absent", () => {
  const parsed = FilterBootstrapResponseSchema.parse({
    generatedAt: "2026-08-21T12:00:00Z",
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    deviceTypes: ["desktop"],
    apps: [],
    surveysByApp: {},
    tags: [],
  });

  assert.equal(parsed.surveyMetaByApp, undefined);
});
