import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FeedbackStatsSchema,
  FeedbackSubmissionV2Schema,
  FilterBootstrapResponseSchema,
  QuestionTrendResponseSchema,
} from "./schemas.ts";

test("question trend preserves rating semantics and distribution through runtime validation", () => {
  const payload = {
    fieldId: "rating",
    fieldType: "RATING",
    label: "Anbefale?",
    interval: "day",
    ratingVariant: "nps",
    ratingScale: 11,
    privacyThreshold: 1,
    options: [],
    buckets: [
      {
        startDate: "2026-09-01",
        masked: false,
        responseCount: 2,
        average: 5,
        distribution: {},
        ratingDistribution: { 0: 1, 10: 1 },
      },
    ],
  };
  assert.deepEqual(QuestionTrendResponseSchema.parse(payload), payload);
  assert.equal(
    QuestionTrendResponseSchema.safeParse({
      ...payload,
      buckets: [
        {
          ...payload.buckets[0],
          masked: true,
          responseCount: null,
          average: null,
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    QuestionTrendResponseSchema.parse({
      ...payload,
      ratingVariant: null,
      ratingScale: null,
    }).ratingVariant,
    null,
  );
});

test("dashboard runtime validation retains retention and field metadata", () => {
  const schema = FeedbackStatsSchema.pick({
    retentionStartDate: true,
    fieldStats: true,
  });
  const payload = {
    retentionStartDate: "2025-09-09",
    fieldStats: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        label: "Vurdering",
        stats: {
          type: "rating",
          average: 1,
          distribution: { 1: 1 },
          ratingVariant: "emoji",
          ratingScale: 5,
        },
      },
      {
        fieldId: "text",
        fieldType: "TEXT",
        label: "Kommentar",
        stats: {
          type: "text",
          responseCount: 2000,
          responseRate: 1,
          analysisSampleSize: 1000,
          topKeywords: [],
          recentResponses: [],
        },
      },
    ],
  };
  assert.deepEqual(schema.parse(payload), payload);
  payload.fieldStats[1].stats.analysisSampleSize = null;
  assert.equal(
    schema.parse(payload).fieldStats[1].stats.analysisSampleSize,
    null,
  );
});

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
