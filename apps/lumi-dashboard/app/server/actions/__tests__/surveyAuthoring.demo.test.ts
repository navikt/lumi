import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_DEMO_READ_ONLY_MESSAGE } from "~/utils/publicDemo";

const doubles = vi.hoisted(() => ({
  env: {} as { NAIS_CLUSTER_NAME?: string },
  setResponseStatus: vi.fn(),
  context: { backendUrl: "https://backend.example", oboToken: null },
}));

// Exercise the handlers without an HTTP framework runtime: the middleware
// and input validation are skipped, and the handler receives the input as is.
vi.mock("@tanstack/react-start", () => {
  const handler =
    (
      fn: (input: {
        data?: unknown;
        context: typeof doubles.context;
      }) => Promise<unknown>,
    ) =>
    (input: { data?: unknown } = {}) =>
      fn({ ...input, context: doubles.context });
  return {
    createServerFn: () => ({
      middleware: () => ({ handler, inputValidator: () => ({ handler }) }),
    }),
  };
});
vi.mock("@tanstack/react-start/server", () => ({
  setResponseStatus: doubles.setResponseStatus,
}));
vi.mock("~/server/middleware/auth", () => ({ authMiddleware: {} }));
vi.mock("~/serverEnv", () => ({ serverEnv: doubles.env }));
vi.mock("~/server/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/utils")>()),
  isMockMode: () => true,
  mockDelay: async () => undefined,
}));

const team = "team-esyfo";
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

async function load() {
  const actions = await import("../surveyAuthoring");
  const store = await import("~/mock/surveyAuthoring");
  return { actions, store };
}

/** Content that existed before the demo stopped accepting writes. */
async function seedExample(store: Awaited<ReturnType<typeof load>>["store"]) {
  const project = store.createMockSurveyProject({
    team,
    name: "Eksempel",
    surveyId: "eksempel-v1",
    document,
  });
  const revision = await store.createMockSurveyRevision({
    team,
    projectId: project.id,
    expectedDraftVersion: project.draftVersion,
  });
  return { project, revision };
}

beforeEach(() => {
  vi.resetModules();
  doubles.setResponseStatus.mockReset();
  delete doubles.env.NAIS_CLUSTER_NAME;
});

describe("Surveyverksted in the public demo", () => {
  beforeEach(() => {
    doubles.env.NAIS_CLUSTER_NAME = "dev-gcp";
  });

  it("tells the page that nothing can be saved", async () => {
    const { actions } = await load();
    await expect(actions.fetchSurveyAuthoringAccessServerFn()).resolves.toEqual(
      { canSave: false },
    );
  });

  it("refuses to create a draft and leaves the shared store empty", async () => {
    const { actions, store } = await load();

    await expect(
      actions.createSurveyAuthoringProjectServerFn({
        data: { team, name: "Utkast", surveyId: "utkast-v1", document },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledWith(403);
    expect(store.listMockSurveyProjects(team)).toEqual([]);
  });

  it("refuses to save, share or delete existing content", async () => {
    const { actions, store } = await load();
    const { project } = await seedExample(store);

    await expect(
      actions.saveSurveyAuthoringDraftServerFn({
        data: {
          team,
          projectId: project.id,
          expectedVersion: project.draftVersion,
          name: "Overskrevet",
          surveyId: project.surveyId,
          document,
        },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      actions.createSurveyAuthoringRevisionServerFn({
        data: {
          team,
          projectId: project.id,
          expectedDraftVersion: project.draftVersion,
        },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      actions.deleteSurveyAuthoringProjectServerFn({
        data: { team, projectId: project.id },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledTimes(3);
    expect(doubles.setResponseStatus).toHaveBeenNthCalledWith(3, 403);
    expect(store.getMockSurveyProject(team, project.id)).toEqual(project);
    expect(store.listMockSurveyRevisions(team, project.id)).toHaveLength(1);
  });

  it("still shows and previews existing content", async () => {
    const { actions, store } = await load();
    const { project, revision } = await seedExample(store);

    await expect(
      actions.fetchSurveyAuthoringProjectsServerFn({ data: { team } }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: project.id,
        latestRevision: expect.objectContaining({ id: revision.id }),
      }),
    ]);
    await expect(
      actions.fetchSurveyAuthoringProjectServerFn({
        data: { team, projectId: project.id },
      }),
    ).resolves.toEqual(project);
    await expect(
      actions.fetchSurveyAuthoringRevisionsServerFn({
        data: { team, projectId: project.id },
      }),
    ).resolves.toHaveLength(1);
    await expect(
      actions.fetchSurveyAuthoringRevisionServerFn({
        data: { team, revisionId: revision.id },
      }),
    ).resolves.toEqual({ revision, previousRevision: null });
    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
  });
});

describe("Surveyverksted in local mock mode", () => {
  it("keeps every write working without a Nais cluster", async () => {
    const { actions } = await load();

    await expect(actions.fetchSurveyAuthoringAccessServerFn()).resolves.toEqual(
      { canSave: true },
    );

    const created = await actions.createSurveyAuthoringProjectServerFn({
      data: { team, name: "Utkast", surveyId: "utkast-v1", document },
    });
    const saved = await actions.saveSurveyAuthoringDraftServerFn({
      data: {
        team,
        projectId: created.id,
        expectedVersion: created.draftVersion,
        name: "Utkast 2",
        surveyId: created.surveyId,
        document,
      },
    });
    expect(saved.draftVersion).toBe(2);

    const revision = await actions.createSurveyAuthoringRevisionServerFn({
      data: { team, projectId: created.id, expectedDraftVersion: 2 },
    });
    expect(revision.revisionNumber).toBe(1);

    await actions.deleteSurveyAuthoringProjectServerFn({
      data: { team, projectId: created.id },
    });
    await expect(
      actions.fetchSurveyAuthoringProjectsServerFn({ data: { team } }),
    ).resolves.toEqual([]);
    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
  });
});
