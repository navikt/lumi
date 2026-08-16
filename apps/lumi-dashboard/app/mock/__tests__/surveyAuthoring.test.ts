import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { beforeEach, describe, expect, it, vi } from "vitest";

const document: SurveyDocumentV1 = {
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

describe("mock survey authoring store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("persists a draft and reopens it for the same team", async () => {
    const store = await import("../surveyAuthoring");
    const created = store.createMockSurveyProject({
      team: "team-a",
      name: "Utkast",
      surveyId: "survey-1",
      document,
    });

    expect(store.listMockSurveyProjects("team-a")).toHaveLength(1);
    expect(store.getMockSurveyProject("team-a", created.id)).toEqual(created);
    expect(store.getMockSurveyProject("team-b", created.id)).toBeUndefined();
  });

  it("increments the version and rejects a stale autosave", async () => {
    const store = await import("../surveyAuthoring");
    const created = store.createMockSurveyProject({
      team: "team-a",
      name: "Utkast",
      surveyId: "survey-1",
      document,
    });

    const saved = store.saveMockSurveyProject({
      team: "team-a",
      projectId: created.id,
      expectedVersion: 1,
      name: "Finjustert",
      surveyId: "survey-1",
      document,
    });

    expect(saved.draftVersion).toBe(2);
    expect(saved.name).toBe("Finjustert");
    expect(() =>
      store.saveMockSurveyProject({
        team: "team-a",
        projectId: created.id,
        expectedVersion: 1,
        name: "Stale",
        surveyId: "survey-1",
        document,
      }),
    ).toThrow("Draft changed since it was loaded");
  });
});
