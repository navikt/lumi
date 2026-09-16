import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  analysisRequest,
  mutateAnalysis,
  readAnalysis,
} from "~/server/analysisProductApi";
import { authMiddleware } from "~/server/middleware/auth";
import { type AuthContext, isMockMode } from "~/server/utils";
import {
  AnalysisCatalogSchema,
  AnalysisCreateSchema,
  AnalysisIdSchema,
  AnalysisLockSchema,
  AnalysisPreviewSchema,
  AnalysisProductSchema,
  AnalysisReleaseSchema,
  AnalysisSaveSchema,
  AnalysisTeamSchema,
} from "~/types/analysisProducts";

export const listAnalysisProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisTeamSchema))
  .handler(async ({ data, context }) =>
    readAnalysis(
      await analysisRequest(context as AuthContext, data.team, ""),
      AnalysisProductSchema.array().refine((products) =>
        products.every((product) => product.team === data.team),
      ),
    ),
  );

export const getAnalysisCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisTeamSchema))
  .handler(async ({ data, context }) => {
    const catalog = await readAnalysis(
      await analysisRequest(context as AuthContext, data.team, "/catalog"),
      AnalysisCatalogSchema,
    );
    if (catalog.team !== data.team)
      throw new Error("Uventet team i kildekatalogen.");
    return catalog;
  });

export const getAnalysisProduct = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisIdSchema))
  .handler(async ({ data, context }) => {
    const product = await readAnalysis(
      await analysisRequest(
        context as AuthContext,
        data.team,
        `/${data.productId}`,
      ),
      AnalysisProductSchema,
    );
    if (product.team !== data.team || product.id !== data.productId)
      throw new Error("Uventet analyseprodukt.");
    return product;
  });

export const getAnalysisPreview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisIdSchema))
  .handler(async ({ data, context }) => {
    const preview = await readAnalysis(
      await analysisRequest(
        context as AuthContext,
        data.team,
        `/${data.productId}/preview`,
      ),
      AnalysisPreviewSchema,
    );
    if (preview.productId !== data.productId)
      throw new Error("Uventet forhåndsvisning.");
    if (
      preview.publicationSpecification &&
      preview.publicationSpecification.team !== data.team
    )
      throw new Error("Uventet team i forhåndsvisningen.");
    if (
      !isMockMode() &&
      preview.status !== "BLOCKED" &&
      !preview.publicationSpecification
    )
      throw new Error(
        "Forhåndsvisningen mangler den autoritative feltoversikten.",
      );
    return preview;
  });

export const getAnalysisReleases = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisIdSchema))
  .handler(async ({ data, context }) =>
    readAnalysis(
      await analysisRequest(
        context as AuthContext,
        data.team,
        `/${data.productId}/releases`,
      ),
      AnalysisReleaseSchema.array().refine((releases) =>
        releases.every((release) => release.productId === data.productId),
      ),
    ),
  );

export const createAnalysisProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisCreateSchema))
  .handler(async ({ data, context }) =>
    mutateAnalysis(
      await analysisRequest(
        context as AuthContext,
        data.team,
        "",
        "POST",
        data.document,
      ),
      AnalysisProductSchema.refine((product) => product.team === data.team),
    ),
  );

export const saveAnalysisDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisSaveSchema))
  .handler(async ({ data, context }) =>
    mutateAnalysis(
      await analysisRequest(
        context as AuthContext,
        data.team,
        `/${data.productId}/draft`,
        "PUT",
        {
          draftId: data.draftId,
          draftRevision: data.draftRevision,
          document: data.document,
        },
      ),
      AnalysisProductSchema.refine(
        (product) =>
          product.team === data.team && product.id === data.productId,
      ),
    ),
  );

export const lockAnalysisRelease = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(AnalysisLockSchema))
  .handler(async ({ data, context }) =>
    mutateAnalysis(
      await analysisRequest(
        context as AuthContext,
        data.team,
        `/${data.productId}/releases`,
        "POST",
        data.confirmation,
      ),
      AnalysisReleaseSchema.refine(
        (release) => release.productId === data.productId,
      ),
    ),
  );
