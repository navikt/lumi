import { describe, expect, it } from "vitest";
import {
  CreateSurveyAuthoringProjectSchema,
  SaveSurveyAuthoringDraftSchema,
} from "../surveyAuthoring";

describe("survey authoring input contracts", () => {
  const document = {
    authoringSchemaVersion: 1,
    pages: [
      {
        id: "page-1",
        questions: [
          { id: "rating", type: "rating", prompt: "Hvordan gikk det?" },
        ],
      },
    ],
  };

  it("accepts a V1 authoring document", () => {
    expect(
      CreateSurveyAuthoringProjectSchema.parse({
        team: "team-a",
        name: "Utkast",
        surveyId: "survey-1",
        document,
      }).document,
    ).toEqual(document);
  });

  it("rejects unsupported authoring versions and invalid locks", () => {
    expect(() =>
      CreateSurveyAuthoringProjectSchema.parse({
        team: "team-a",
        name: "Utkast",
        surveyId: "survey-1",
        document: { authoringSchemaVersion: 2 },
      }),
    ).toThrow();

    expect(() =>
      SaveSurveyAuthoringDraftSchema.parse({
        team: "team-a",
        projectId: crypto.randomUUID(),
        expectedVersion: 0,
        name: "Utkast",
        surveyId: "survey-1",
        document,
      }),
    ).toThrow();
  });
});
