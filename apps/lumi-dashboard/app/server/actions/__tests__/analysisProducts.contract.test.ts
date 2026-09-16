import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAnalysisDocument } from "~/types/analysisProducts";
import {
  createAnalysisProduct,
  getAnalysisCatalog,
  getAnalysisPreview,
  listAnalysisProducts,
  lockAnalysisRelease,
  saveAnalysisDraft,
} from "../analysisProducts";

const doubles = vi.hoisted(() => ({
  request: vi.fn(),
  context: { backendUrl: "https://backend.example", oboToken: "delegated" },
}));

// Exercise handler wiring without an HTTP framework runtime. Validation and
// authorization middleware have separate tests; backend responses are real DTOs.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      inputValidator: () => ({
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
vi.mock("~/server/analysisProductApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/analysisProductApi")>()),
  analysisRequest: doubles.request,
}));

const id = "10000000-0000-4000-8000-000000000001";
const draftId = "10000000-0000-4000-8000-000000000002";
const document = {
  ...emptyAnalysisDocument(),
  name: "Analyse",
  purpose: "Test",
  dataOwner: "Eier",
  technicalOwner: "Team",
  reviewDate: "2026-12-01",
  useCases: ["METABASE" as const],
};
const product = {
  id,
  team: "team-test",
  lifecycleState: "DRAFT",
  lastReleaseNumber: 0,
  activeReleaseNumber: null,
  desiredReleaseNumber: null,
  updatedAt: "2026-09-09T00:00:00Z",
  draft: { id: draftId, revision: 3, documentHash: "a".repeat(64), document },
};

beforeEach(() => doubles.request.mockReset());

describe("analysis server action contracts", () => {
  it("rejects another team's product in list and write responses", async () => {
    doubles.request.mockResolvedValueOnce(
      Response.json([{ ...product, team: "another-team" }]),
    );
    await expect(
      listAnalysisProducts({ data: { team: "team-test" } }),
    ).rejects.toThrow("Uventet svar");
    doubles.request.mockResolvedValueOnce(
      Response.json({ ...product, team: "another-team" }),
    );
    await expect(
      createAnalysisProduct({ data: { team: "team-test", document } }),
    ).rejects.toThrow("Uventet svar");
  });

  it("requires the authoritative selection for a ready production preview", async () => {
    const preview = {
      schemaVersion: 2,
      dataOrigin: "SYNTHETIC",
      productId: id,
      draftId,
      draftRevision: 3,
      documentHash: "a".repeat(64),
      catalogRevision: "selection",
      publicationSpecificationDigest: "b".repeat(64),
      status: "READY",
      resources: [],
      issues: [],
      excludedDataCategories: [],
    };
    doubles.request.mockResolvedValueOnce(Response.json(preview));
    await expect(
      getAnalysisPreview({ data: { team: "team-test", productId: id } }),
    ).rejects.toThrow("autoritative feltoversikten");
    doubles.request.mockResolvedValueOnce(
      Response.json({
        ...preview,
        status: "BLOCKED",
        publicationSpecificationDigest: null,
      }),
    );
    await expect(
      getAnalysisPreview({ data: { team: "team-test", productId: id } }),
    ).resolves.toMatchObject({ status: "BLOCKED" });
  });
  it("creates from the document only, with team supplied separately", async () => {
    doubles.request.mockResolvedValue(Response.json(product, { status: 201 }));
    expect(
      await createAnalysisProduct({ data: { team: "team-test", document } }),
    ).toEqual({ ok: true, value: product });
    expect(doubles.request).toHaveBeenCalledExactlyOnceWith(
      doubles.context,
      "team-test",
      "",
      "POST",
      document,
    );
  });

  it("saves using the backend revision precondition and PUT endpoint", async () => {
    doubles.request.mockResolvedValue(Response.json(product));
    await saveAnalysisDraft({
      data: {
        team: "team-test",
        productId: id,
        draftId,
        draftRevision: 3,
        document,
      },
    });
    expect(doubles.request).toHaveBeenCalledExactlyOnceWith(
      doubles.context,
      "team-test",
      `/${id}/draft`,
      "PUT",
      { draftId, draftRevision: 3, document },
    );
  });

  it("locks only the exact preview confirmation, never a client-built specification", async () => {
    const confirmation = {
      draftId,
      draftRevision: 3,
      documentHash: "a".repeat(64),
      catalogRevision: "selection-scope",
      publicationSpecificationDigest: "b".repeat(64),
    };
    doubles.request.mockResolvedValue(
      Response.json({
        id: draftId,
        productId: id,
        releaseNumber: 1,
        sourceDocument: document,
        publishedAt: "2026-09-09T00:00:00Z",
        publicationSpecification: { serverOnly: true },
      }),
    );
    const result = await lockAnalysisRelease({
      data: { team: "team-test", productId: id, confirmation },
    });
    expect(result.ok).toBe(true);
    expect(doubles.request).toHaveBeenCalledExactlyOnceWith(
      doubles.context,
      "team-test",
      `/${id}/releases`,
      "POST",
      confirmation,
    );
    expect(result).not.toHaveProperty("value.publicationSpecification");
  });

  it("rejects a catalog for a different team", async () => {
    doubles.request.mockResolvedValue(
      Response.json({
        schemaVersion: 1,
        team: "another-team",
        catalogRevision: "revision",
        sources: [],
        dimensions: [],
      }),
    );
    await expect(
      getAnalysisCatalog({ data: { team: "team-test" } }),
    ).rejects.toThrow("Uventet team");
  });

  it("rejects a preview for another product", async () => {
    doubles.request.mockResolvedValue(
      Response.json({
        schemaVersion: 2,
        dataOrigin: "SYNTHETIC",
        productId: draftId,
        draftId,
        draftRevision: 3,
        documentHash: "a".repeat(64),
        catalogRevision: "selection",
        publicationSpecificationDigest: "b".repeat(64),
        status: "READY",
        resources: [],
        issues: [],
        excludedDataCategories: [],
      }),
    );
    await expect(
      getAnalysisPreview({ data: { team: "team-test", productId: id } }),
    ).rejects.toThrow("Uventet forhåndsvisning");
  });
});
