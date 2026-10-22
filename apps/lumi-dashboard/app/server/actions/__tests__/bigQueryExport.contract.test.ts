import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBigQueryExport,
  runBigQueryExport,
  saveBigQueryExport,
  stopBigQueryExport,
  verifyBigQueryExport,
} from "../bigQueryExport";

const doubles = vi.hoisted(() => ({
  request: vi.fn(),
  context: { backendUrl: "https://backend.example", oboToken: "delegated" },
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: () => ({
        handler:
          (
            handler: (input: {
              data: unknown;
              context: typeof doubles.context;
            }) => Promise<unknown>,
          ) =>
          (input: { data: unknown }) =>
            handler({ ...input, context: doubles.context }),
      }),
    }),
  }),
}));
vi.mock("~/server/middleware/auth", () => ({ authMiddleware: {} }));
vi.mock("~/server/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/utils")>()),
  isMockMode: () => false,
}));
vi.mock("~/server/bigQueryExportApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/bigQueryExportApi")>()),
  bigQueryExportRequest: doubles.request,
}));

const status = {
  team: "team-test",
  available: true,
  availability: "AVAILABLE",
  location: "europe-north1",
  serviceAccount: "lumi-api@nais-dev.iam.gserviceaccount.com",
  suggestedProjectId: "team-test-dev-1234",
  freeTextAvailable: false,
  destination: null,
};

beforeEach(() => doubles.request.mockReset());

describe("BigQuery export server action contracts", () => {
  it("reads the status for the requested team and rejects another team", async () => {
    doubles.request.mockResolvedValueOnce(Response.json(status));
    await expect(
      getBigQueryExport({ data: { team: "team-test" } }),
    ).resolves.toMatchObject({ availability: "AVAILABLE" });
    expect(doubles.request).toHaveBeenCalledWith(
      doubles.context,
      "team-test",
      "",
    );

    doubles.request.mockResolvedValueOnce(
      Response.json({ ...status, team: "another-team" }),
    );
    await expect(
      getBigQueryExport({ data: { team: "team-test" } }),
    ).rejects.toThrow("Uventet svar");
  });

  it("treats a status without freeTextAvailable as closed for free text", async () => {
    const withoutFreeText = Object.fromEntries(
      Object.entries(status).filter(([key]) => key !== "freeTextAvailable"),
    );
    doubles.request.mockResolvedValueOnce(Response.json(withoutFreeText));
    await expect(
      getBigQueryExport({ data: { team: "team-test" } }),
    ).resolves.toMatchObject({ freeTextAvailable: false });

    doubles.request.mockResolvedValueOnce(
      Response.json({ ...status, freeTextAvailable: true }),
    );
    await expect(
      getBigQueryExport({ data: { team: "team-test" } }),
    ).resolves.toMatchObject({ freeTextAvailable: true });
  });

  it("reads the dataset checks and Lumi-side problems the API reports", async () => {
    const problems = [
      { code: "DATASET_NOT_DEDICATED", detail: "rapport" },
      { code: "DATASET_TIME_TRAVEL_TOO_LONG", detail: "168" },
      { code: "TEAM_PROJECT_UNKNOWN" },
      { code: "EXPORT_JOB_DENIED" },
      { code: "FREE_TEXT_NOT_REMOVED" },
    ];
    doubles.request.mockResolvedValueOnce(
      Response.json({ ok: false, problems }),
    );
    await expect(
      verifyBigQueryExport({
        data: {
          team: "team-test",
          projectId: "team-test-dev-1234",
          datasetId: "lumi",
        },
      }),
    ).resolves.toEqual({ ok: true, value: { ok: false, problems } });
  });

  it("sends only the destination fields when saving", async () => {
    doubles.request.mockResolvedValueOnce(Response.json(status));
    await saveBigQueryExport({
      data: {
        team: "team-test",
        projectId: "team-test-dev-1234",
        datasetId: "lumi",
        includeFreeText: true,
      },
    });
    expect(doubles.request).toHaveBeenCalledWith(
      doubles.context,
      "team-test",
      "",
      "PUT",
      {
        projectId: "team-test-dev-1234",
        datasetId: "lumi",
        includeFreeText: true,
      },
    );
  });

  it("returns the problems that stopped a save", async () => {
    doubles.request.mockResolvedValueOnce(
      Response.json(
        {
          ok: false,
          problems: [{ code: "DATASET_TEAM_LABEL_MISMATCH", detail: "flex" }],
        },
        { status: 422 },
      ),
    );
    await expect(
      saveBigQueryExport({
        data: {
          team: "team-test",
          projectId: "team-test-dev-1234",
          datasetId: "lumi",
          includeFreeText: false,
        },
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "problems",
      problems: [{ code: "DATASET_TEAM_LABEL_MISMATCH", detail: "flex" }],
    });
  });

  it("maps API answers to reasons the page can explain", async () => {
    const cases: Array<[number, string]> = [
      [400, "invalid-input"],
      [404, "not-configured"],
      [409, "unavailable"],
      [403, "unavailable"],
      [429, "limit"],
    ];
    for (const [code, reason] of cases) {
      doubles.request.mockResolvedValueOnce(
        Response.json({}, { status: code }),
      );
      await expect(
        runBigQueryExport({ data: { team: "team-test" } }),
      ).resolves.toEqual({ ok: false, reason });
    }
    doubles.request.mockResolvedValueOnce(Response.json({}, { status: 500 }));
    await expect(
      runBigQueryExport({ data: { team: "team-test" } }),
    ).rejects.toThrow("Kunne ikke bekrefte");
  });

  it("calls verify, run and stop with the right method and path", async () => {
    doubles.request.mockResolvedValueOnce(
      Response.json({ ok: true, problems: [] }),
    );
    await verifyBigQueryExport({
      data: {
        team: "team-test",
        projectId: "team-test-dev-1234",
        datasetId: "lumi",
      },
    });
    doubles.request.mockResolvedValueOnce(
      Response.json(status, { status: 202 }),
    );
    await runBigQueryExport({ data: { team: "team-test" } });
    // An older API leaves out stopping, which then means the stop is done.
    doubles.request.mockResolvedValueOnce(
      Response.json({ tablesRemoved: true }),
    );
    await expect(
      stopBigQueryExport({ data: { team: "team-test" } }),
    ).resolves.toEqual({
      ok: true,
      value: { tablesRemoved: true, stopping: false },
    });
    doubles.request.mockResolvedValueOnce(
      Response.json({ tablesRemoved: false, stopping: true }),
    );
    await expect(
      stopBigQueryExport({ data: { team: "team-test" } }),
    ).resolves.toEqual({
      ok: true,
      value: { tablesRemoved: false, stopping: true },
    });

    expect(doubles.request.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      ["/verify", "POST"],
      ["/run", "POST"],
      ["", "DELETE"],
      ["", "DELETE"],
    ]);
  });
});
