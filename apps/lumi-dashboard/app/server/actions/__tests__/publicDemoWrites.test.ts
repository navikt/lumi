import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAnalysisDocument } from "~/types/analysisProducts";
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
    // Writes come from the browser, as server function calls over HTTP.
    getGlobalStartContext: () => ({ serverFnHttpCall: true }),
    createServerOnlyFn: <T>(fn: T) => fn,
    createServerFn: () => ({
      middleware: () => ({ handler, validator: () => ({ handler }) }),
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
const analysisDocument = {
  ...emptyAnalysisDocument(),
  name: "Analyse",
  purpose: "Test",
  dataOwner: "Eier",
  technicalOwner: "Team",
  reviewDate: "2026-12-01",
  useCases: ["METABASE" as const],
};

async function loadModules() {
  const [markers, tags, archive, remove, themes, analysis, mockData, mock] =
    await Promise.all([
      import("../markers"),
      import("../tags"),
      import("../archiveSurvey"),
      import("../delete"),
      import("../themes"),
      import("../analysisProducts"),
      import("~/mock/mockData"),
      import("~/mock/themes"),
    ]);
  return {
    markers,
    tags,
    archive,
    remove,
    themes,
    analysis,
    mockData,
    mockThemes: mock.mockThemes,
  };
}

// The mock data is large, so the modules load once. Each test compares the
// stores before and after its own calls instead of relying on a fresh copy.
let m: Awaited<ReturnType<typeof loadModules>>;

beforeAll(async () => {
  m = await loadModules();
}, 30_000);

beforeEach(() => {
  doubles.setResponseStatus.mockClear();
  delete doubles.env.NAIS_CLUSTER_NAME;
});

function firstFeedback() {
  const feedback = m.mockData.mockFeedbackItems[0];
  if (!feedback) throw new Error("The mock data has no feedback");
  return feedback;
}

function answersFor(surveyId: string) {
  return m.mockData.mockFeedbackItems.filter(
    (item) => item.surveyId === surveyId,
  );
}

function isVisible(surveyId: string): boolean {
  return (
    m.mockData.filterMockArchiveVisibility(answersFor(surveyId), false).length >
    0
  );
}

describe("writes in the public demo", () => {
  beforeEach(() => {
    doubles.env.NAIS_CLUSTER_NAME = "dev-gcp";
  });

  it("refuses to create, change or delete markers", async () => {
    const { surveyId } = firstFeedback();
    const before = await m.markers.fetchMarkersServerFn({
      data: { surveyId, team },
    });

    await expect(
      m.markers.createMarkerServerFn({
        data: { surveyId, team, markerDate: "2026-10-01", label: "Lansering" },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.markers.updateMarkerServerFn({
        data: { id: "marker", surveyId, team, label: "Endret" },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.markers.deleteMarkerServerFn({
        data: { id: "marker", surveyId, team },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledTimes(3);
    expect(doubles.setResponseStatus).toHaveBeenCalledWith(403);
    await expect(
      m.markers.fetchMarkersServerFn({ data: { surveyId, team } }),
    ).resolves.toEqual(before);
  });

  it("refuses to add or remove tags on answers", async () => {
    const { id } = firstFeedback();

    await expect(
      m.tags.addTagServerFn({ data: { id, tag: "Fritekst", team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.tags.removeTagServerFn({ data: { id, tag: "Fritekst", team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledTimes(2);
    expect(doubles.setResponseStatus).toHaveBeenCalledWith(403);
  });

  it("refuses to archive or restore a survey", async () => {
    const { surveyId } = firstFeedback();
    const visible = isVisible(surveyId);

    await expect(
      m.archive.archiveSurveyServerFn({ data: { surveyId, team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.archive.unarchiveSurveyServerFn({ data: { surveyId, team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledTimes(2);
    expect(isVisible(surveyId)).toBe(visible);
  });

  it("refuses to delete an answer from the shared data", async () => {
    const feedback = firstFeedback();
    const count = m.mockData.mockFeedbackItems.length;

    await expect(
      m.remove.deleteFeedbackServerFn({ data: { id: feedback.id, team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(403);
    expect(m.mockData.mockFeedbackItems).toHaveLength(count);
    expect(m.mockData.mockFeedbackItems).toContain(feedback);
  });

  it("refuses to delete every answer to a survey", async () => {
    const { surveyId } = firstFeedback();
    const answers = answersFor(surveyId).length;

    await expect(
      m.remove.deleteSurveyServerFn({ data: { surveyId, team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(403);
    expect(answersFor(surveyId)).toHaveLength(answers);
  });

  it("refuses to create, change or delete themes", async () => {
    const before = structuredClone(m.mockThemes);
    const existing = m.mockThemes[0];
    if (!existing) throw new Error("The mock data has no themes");

    await expect(
      m.themes.createThemeServerFn({
        data: {
          name: "Fritekst",
          keywords: ["fritekst"],
          analysisContext: "GENERAL_FEEDBACK",
          team,
        },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.themes.updateThemeServerFn({
        data: {
          themeId: existing.id,
          name: "Endret",
          analysisContext: "GENERAL_FEEDBACK",
          team,
        },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.themes.deleteThemeServerFn({ data: { themeId: existing.id, team } }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledTimes(3);
    expect(m.mockThemes).toEqual(before);
  });

  it("refuses to create, save or lock analysis products", async () => {
    const productId = "10000000-0000-4000-8000-000000000001";
    const before = await m.analysis.listAnalysisProducts({ data: { team } });

    await expect(
      m.analysis.createAnalysisProduct({
        data: { team, document: analysisDocument },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.analysis.saveAnalysisDraft({
        data: {
          team,
          productId,
          draftId: "10000000-0000-4000-8000-000000000002",
          draftRevision: 1,
          document: analysisDocument,
        },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    await expect(
      m.analysis.lockAnalysisRelease({
        data: {
          team,
          productId,
          confirmation: {
            documentHash: "a".repeat(64),
            draftId: "10000000-0000-4000-8000-000000000002",
            draftRevision: 1,
            catalogRevision: "demo-catalog",
            publicationSpecificationDigest: "b".repeat(64),
          },
        },
      }),
    ).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    expect(doubles.setResponseStatus).toHaveBeenCalledTimes(3);
    await expect(
      m.analysis.listAnalysisProducts({ data: { team } }),
    ).resolves.toEqual(before);
  });
});

describe("writes in local mock mode", () => {
  it("keeps markers, tags, archiving, deletion, themes and analysis products writable", async () => {
    const feedback = firstFeedback();
    const { surveyId } = feedback;

    const marker = await m.markers.createMarkerServerFn({
      data: { surveyId, team, markerDate: "2026-10-01", label: "Lansering" },
    });
    await expect(
      m.markers.fetchMarkersServerFn({ data: { surveyId, team } }),
    ).resolves.toContainEqual(marker);

    await expect(
      m.tags.addTagServerFn({ data: { id: feedback.id, tag: "Bug", team } }),
    ).resolves.toEqual({ success: true });

    await m.archive.archiveSurveyServerFn({ data: { surveyId, team } });
    expect(isVisible(surveyId)).toBe(false);
    await m.archive.unarchiveSurveyServerFn({ data: { surveyId, team } });
    expect(isVisible(surveyId)).toBe(true);

    await expect(
      m.remove.deleteFeedbackServerFn({ data: { id: feedback.id, team } }),
    ).resolves.toEqual({ success: true });
    expect(m.mockData.mockFeedbackItems).not.toContain(feedback);

    const doomed = m.mockData.mockFeedbackItems.at(-1)?.surveyId;
    if (!doomed) throw new Error("The mock data has no feedback");
    const answers = answersFor(doomed).length;
    await expect(
      m.remove.deleteSurveyServerFn({ data: { surveyId: doomed, team } }),
    ).resolves.toEqual({ deletedCount: answers, surveyId: doomed });
    expect(answersFor(doomed)).toEqual([]);

    await expect(
      m.themes.createThemeServerFn({
        data: {
          name: "Lokalt tema",
          keywords: ["lokalt"],
          analysisContext: "GENERAL_FEEDBACK",
          team,
        },
      }),
    ).resolves.toEqual(expect.objectContaining({ name: "Lokalt tema" }));

    await expect(
      m.analysis.createAnalysisProduct({
        data: { team, document: analysisDocument },
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: true }));

    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
  });
});
