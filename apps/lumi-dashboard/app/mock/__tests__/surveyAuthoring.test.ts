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

  it("deletion returns false for unknown ids and other teams, leaving the project", async () => {
    const store = await import("../surveyAuthoring");
    const created = store.createMockSurveyProject({
      team: "team-a",
      name: "Mock-slett",
      surveyId: "mock-slett",
      document,
    });

    expect(store.deleteMockSurveyProject("team-a", "finnes-ikke")).toBe(false);
    expect(store.deleteMockSurveyProject("team-b", created.id)).toBe(false);
    expect(store.getMockSurveyProject("team-a", created.id)).toBeDefined();
  });

  it("deletes the project together with its revisions", async () => {
    const store = await import("../surveyAuthoring");
    const created = store.createMockSurveyProject({
      team: "team-a",
      name: "Mock-slett",
      surveyId: "mock-slett",
      document,
    });
    const revision = await store.createMockSurveyRevision({
      team: "team-a",
      projectId: created.id,
      expectedDraftVersion: 1,
    });

    expect(store.deleteMockSurveyProject("team-a", created.id)).toBe(true);
    expect(store.getMockSurveyProject("team-a", created.id)).toBeUndefined();
    // API parity: listing revisions for a deleted project is a not-found.
    expect(() => store.listMockSurveyRevisions("team-a", created.id)).toThrow(
      /not found/i,
    );
    expect(
      store.getMockSurveyRevisionDetail("team-a", revision.id),
    ).toBeUndefined();
    // Idempotent from the caller's view: the second delete reports missing.
    expect(store.deleteMockSurveyProject("team-a", created.id)).toBe(false);
  });
});
