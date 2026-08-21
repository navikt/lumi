import assert from "node:assert/strict";
import { test } from "node:test";

import { FilterBootstrapResponseSchema } from "./schemas.ts";

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
