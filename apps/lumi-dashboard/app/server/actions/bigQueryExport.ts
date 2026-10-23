import { createServerFn } from "@tanstack/react-start";
import {
  bigQueryExportRequest,
  mutateBigQueryExport,
  readBigQueryExport,
} from "~/server/bigQueryExportApi";
import { authMiddleware } from "~/server/middleware/auth";
import { refuseWriteInPublicDemo } from "~/server/publicDemo";
import type { AuthContext } from "~/server/utils";
import {
  BigQueryExportSaveSchema,
  BigQueryExportStatusSchema,
  BigQueryExportStopSchema,
  BigQueryExportTargetSchema,
  BigQueryExportTeamSchema,
  BigQueryExportVerificationSchema,
} from "~/types/bigQueryExport";

const statusFor = (team: string) =>
  BigQueryExportStatusSchema.refine((status) => status.team === team, {
    message: "Uventet team i BigQuery-eksporten.",
  });

export const getBigQueryExport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(BigQueryExportTeamSchema)
  .handler(async ({ data, context }) =>
    readBigQueryExport(
      await bigQueryExportRequest(context as AuthContext, data.team, ""),
      statusFor(data.team),
    ),
  );

export const verifyBigQueryExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(BigQueryExportTargetSchema)
  .handler(async ({ data, context }) => {
    refuseWriteInPublicDemo();
    return mutateBigQueryExport(
      await bigQueryExportRequest(
        context as AuthContext,
        data.team,
        "/verify",
        "POST",
        { projectId: data.projectId, datasetId: data.datasetId },
      ),
      BigQueryExportVerificationSchema,
    );
  });

export const saveBigQueryExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(BigQueryExportSaveSchema)
  .handler(async ({ data, context }) => {
    refuseWriteInPublicDemo();
    return mutateBigQueryExport(
      await bigQueryExportRequest(
        context as AuthContext,
        data.team,
        "",
        "PUT",
        {
          projectId: data.projectId,
          datasetId: data.datasetId,
          includeFreeText: data.includeFreeText,
        },
      ),
      statusFor(data.team),
    );
  });

export const runBigQueryExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(BigQueryExportTeamSchema)
  .handler(async ({ data, context }) => {
    refuseWriteInPublicDemo();
    return mutateBigQueryExport(
      await bigQueryExportRequest(
        context as AuthContext,
        data.team,
        "/run",
        "POST",
      ),
      statusFor(data.team),
    );
  });

export const stopBigQueryExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(BigQueryExportTeamSchema)
  .handler(async ({ data, context }) => {
    refuseWriteInPublicDemo();
    return mutateBigQueryExport(
      await bigQueryExportRequest(
        context as AuthContext,
        data.team,
        "",
        "DELETE",
      ),
      BigQueryExportStopSchema,
    );
  });
