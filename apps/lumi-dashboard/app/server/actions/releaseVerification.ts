import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
} from "~/server/utils";
import { serverEnv } from "~/serverEnv";
import {
  createReleaseVerificationSurveyId,
  isReleaseVerificationEnabled,
  RELEASE_VERIFICATION_SURVEY_PREFIX,
} from "~/utils/releaseVerification";
import { handleApiResponse } from "../fetchUtils";

const surveyTypeSchema = z.enum([
  "rating",
  "discovery",
  "topTasks",
  "taskPriority",
  "custom",
]);

const ratingVariantSchema = z.enum(["emoji", "thumbs", "stars", "nps"]);

const transportPayloadSchema = z.object({
  schemaVersion: z.literal(2),
  surveyId: z.string().startsWith(RELEASE_VERIFICATION_SURVEY_PREFIX),
  surveyType: surveyTypeSchema,
  submittedAt: z.string().min(1),
  startedAt: z.string().min(1).optional(),
  timeToCompleteMs: z.number().nonnegative().optional(),
  deduplicationKey: z.string().min(1),
  definition: z.object({
    surveyType: surveyTypeSchema,
    fields: z
      .array(
        z.discriminatedUnion("fieldType", [
          z.object({
            fieldId: z.string().min(1),
            fieldType: z.literal("RATING"),
            ratingVariant: ratingVariantSchema,
            ratingScale: z.number().int().positive(),
          }),
          z.object({
            fieldId: z.string().min(1),
            fieldType: z.literal("TEXT"),
          }),
          z.object({
            fieldId: z.string().min(1),
            fieldType: z.literal("SINGLE_CHOICE"),
            optionIds: z.array(z.string()),
          }),
          z.object({
            fieldId: z.string().min(1),
            fieldType: z.literal("MULTI_CHOICE"),
            optionIds: z.array(z.string()),
            maxSelections: z.number().int().positive().optional(),
          }),
        ]),
      )
      .min(1),
  }),
  context: z
    .object({
      url: z.string().optional(),
      pathname: z.string().optional(),
      viewport: z.object({ width: z.number(), height: z.number() }).optional(),
      screenResolution: z
        .object({ width: z.number(), height: z.number() })
        .optional(),
      deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
      userAgent: z.string().optional(),
      tags: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
      debug: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  answers: z.array(
    z.object({
      fieldId: z.string().min(1),
      fieldType: z.enum(["RATING", "TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"]),
      question: z.object({
        label: z.string(),
        description: z.string().optional(),
        options: z
          .array(z.object({ id: z.string(), label: z.string() }))
          .optional(),
      }),
      value: z.object({
        type: z.enum(["rating", "text", "singleChoice", "multiChoice"]),
        rating: z.number().optional(),
        ratingVariant: ratingVariantSchema.optional(),
        ratingScale: z.number().optional(),
        text: z.string().optional(),
        selectedOptionId: z.string().optional(),
        selectedOptionIds: z.array(z.string()).optional(),
      }),
    }),
  ),
});

const submissionReceiptSchema = z.object({
  id: z.string().min(1),
  duplicate: z.boolean().optional(),
});

export interface ReleaseVerificationConfig {
  enabled: boolean;
  surveyId: string | null;
  dashboardTeam: string | null;
  dashboardApp: string | null;
  authMode: "azure-obo" | "local-bypass" | null;
}

export interface ReleaseVerificationReceipt {
  id: string;
  duplicate: boolean;
}

function releaseVerificationEnabled(): boolean {
  return isReleaseVerificationEnabled({
    cluster: serverEnv.NAIS_CLUSTER_NAME,
    mockMode: isMockMode(),
    localAuthBypass: serverEnv.LUMI_LOCAL_AUTH_BYPASS === "true",
  });
}

export const fetchReleaseVerificationConfigServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async (): Promise<ReleaseVerificationConfig> => {
    const enabled = releaseVerificationEnabled();
    return {
      enabled,
      surveyId: enabled ? createReleaseVerificationSurveyId() : null,
      dashboardTeam: enabled
        ? serverEnv.NAIS_CLUSTER_NAME
          ? "team-esyfo"
          : "local-dev"
        : null,
      dashboardApp: enabled
        ? serverEnv.NAIS_CLUSTER_NAME
          ? "lumi-dashboard"
          : "local-app"
        : null,
      authMode: enabled
        ? serverEnv.NAIS_CLUSTER_NAME
          ? "azure-obo"
          : "local-bypass"
        : null,
    };
  });

export const submitReleaseVerificationServerFn = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(transportPayloadSchema))
  .handler(async ({ data, context }): Promise<ReleaseVerificationReceipt> => {
    if (!releaseVerificationEnabled()) {
      throw new Error("Release-verifikasjon er bare tilgjengelig i dev");
    }

    const { backendUrl, oboToken } = context as AuthContext;
    const response = await fetch(
      buildUrl(backendUrl, "/api/azure/v1/feedback"),
      {
        method: "POST",
        headers: getHeaders(oboToken),
        body: JSON.stringify(data),
      },
    );
    await handleApiResponse(response);
    const receipt = submissionReceiptSchema.parse(await response.json());
    return { id: receipt.id, duplicate: receipt.duplicate === true };
  });
