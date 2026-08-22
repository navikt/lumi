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
  createReleaseVerificationControlOptionId,
  createReleaseVerificationSurveyId,
  isReleaseVerificationEnabled,
  RELEASE_VERIFICATION_CONTROL_FIELD_ID,
  RELEASE_VERIFICATION_RATING,
  RELEASE_VERIFICATION_SURVEY_ID_PATTERN,
  RELEASE_VERIFICATION_SURVEY_PREFIX,
  type ReleaseVerificationPhase,
  type ReleaseVerificationPreflightEvidence,
  type ReleaseVerificationProbeEvidence,
  type ReleaseVerificationProfile,
  verifyReleaseVerificationReadback,
} from "~/utils/releaseVerification";
import { handleApiResponse } from "../fetchUtils";

const DEV_HOLD_DURATION_MS = 15 * 60 * 1000;
const surveyTypeSchema = z.enum([
  "rating",
  "discovery",
  "topTasks",
  "taskPriority",
  "custom",
]);
const ratingVariantSchema = z.enum(["emoji", "thumbs", "stars", "nps"]);
const phaseSchema = z.enum(["initial", "closing"]);

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

const feedbackReadbackSchema = z.object({
  id: z.string(),
  submittedAt: z.string(),
  app: z.string().nullable(),
  surveyId: z.string(),
  surveyType: z.string().optional(),
  context: z
    .object({ tags: z.record(z.string(), z.string()).optional() })
    .optional(),
  answers: z.array(
    z.object({
      fieldId: z.string(),
      fieldType: z.string(),
      value: z.object({
        type: z.string(),
        rating: z.number().optional(),
        selectedOptionId: z.string().optional(),
      }),
    }),
  ),
});

const readRunSchema = z.object({
  surveyId: z.string().regex(RELEASE_VERIFICATION_SURVEY_ID_PATTERN),
  initialReceiptId: z.string().uuid().optional(),
  closingReceiptId: z.string().uuid().optional(),
});

export type ReleaseVerificationConfig =
  | {
      enabled: false;
      surveyId: null;
      dashboardTeam: null;
      dashboardApp: null;
      authMode: null;
      profile: null;
      environment: null;
      holdDurationMs: null;
      preflight: null;
    }
  | {
      enabled: true;
      surveyId: string;
      dashboardTeam: string;
      dashboardApp: string;
      authMode: "azure-obo" | "local-bypass";
      profile: ReleaseVerificationProfile;
      environment: "dev-gcp" | "local";
      holdDurationMs: number;
      preflight: ReleaseVerificationPreflightEvidence;
    };

export interface ReleaseVerificationRunReadback {
  observedAt: string;
  initial: ReleaseVerificationProbeEvidence | null;
  closing: ReleaseVerificationProbeEvidence | null;
}

interface ReleaseVerificationTarget {
  team: string;
  app: string;
  channel: "azure-obo" | "local-bypass";
  profile: ReleaseVerificationProfile;
  environment: "dev-gcp" | "local";
  holdDurationMs: number;
}

function releaseVerificationEnabled(): boolean {
  return isReleaseVerificationEnabled({
    cluster: serverEnv.NAIS_CLUSTER_NAME,
    mockMode: isMockMode(),
    localAuthBypass: serverEnv.LUMI_LOCAL_AUTH_BYPASS === "true",
  });
}

function getTarget(): ReleaseVerificationTarget {
  if (serverEnv.NAIS_CLUSTER_NAME === "dev-gcp") {
    return {
      team: "team-esyfo",
      app: "lumi-dashboard",
      channel: "azure-obo",
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      holdDurationMs: DEV_HOLD_DURATION_MS,
    };
  }
  return {
    team: "local-dev",
    app: "local-app",
    channel: "local-bypass",
    profile: "local-full-chain",
    environment: "local",
    holdDurationMs: 0,
  };
}

export const fetchReleaseVerificationConfigServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ReleaseVerificationConfig> => {
    const enabled = releaseVerificationEnabled();
    if (!enabled) {
      return {
        enabled: false,
        surveyId: null,
        dashboardTeam: null,
        dashboardApp: null,
        authMode: null,
        profile: null,
        environment: null,
        holdDurationMs: null,
        preflight: null,
      };
    }

    const target = getTarget();
    const surveyId = createReleaseVerificationSurveyId();
    const preflight = await runTeamPreflight(
      context as AuthContext,
      target,
      surveyId,
    );
    return {
      enabled: true,
      surveyId,
      dashboardTeam: target.team,
      dashboardApp: target.app,
      authMode: target.channel,
      profile: target.profile,
      environment: target.environment,
      holdDurationMs: target.holdDurationMs,
      preflight,
    };
  });

export const submitReleaseVerificationServerFn = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(transportPayloadSchema))
  .handler(
    async ({ data, context }): Promise<ReleaseVerificationProbeEvidence> => {
      assertReleaseVerificationEnabled();
      const target = getTarget();
      const phase = assertExpectedSubmission(data, target);
      const authContext = context as AuthContext;
      const preflight = await runTeamPreflight(
        authContext,
        target,
        data.surveyId,
      );
      if (preflight.status !== "passed") {
        throw new Error(
          preflight.message ?? "Teamtilgang kunne ikke bekreftes",
        );
      }
      const response = await fetch(
        buildUrl(authContext.backendUrl, "/api/azure/v1/feedback"),
        {
          method: "POST",
          headers: getHeaders(authContext.oboToken),
          body: JSON.stringify(data),
        },
      );
      await handleApiResponse(response);
      const receipt = submissionReceiptSchema.parse(await response.json());
      return readExactProbe(authContext, target, {
        phase,
        surveyId: data.surveyId,
        receiptId: receipt.id,
        duplicate: receipt.duplicate === true,
      });
    },
  );

export const fetchReleaseVerificationRunServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(readRunSchema))
  .handler(
    async ({ data, context }): Promise<ReleaseVerificationRunReadback> => {
      assertReleaseVerificationEnabled();
      const target = getTarget();
      const authContext = context as AuthContext;
      const [initial, closing] = await Promise.all([
        data.initialReceiptId
          ? readExactProbe(authContext, target, {
              phase: "initial",
              surveyId: data.surveyId,
              receiptId: data.initialReceiptId,
              duplicate: null,
            })
          : null,
        data.closingReceiptId
          ? readExactProbe(authContext, target, {
              phase: "closing",
              surveyId: data.surveyId,
              receiptId: data.closingReceiptId,
              duplicate: null,
            })
          : null,
      ]);
      return { observedAt: new Date().toISOString(), initial, closing };
    },
  );

async function runTeamPreflight(
  { backendUrl, oboToken }: AuthContext,
  target: ReleaseVerificationTarget,
  surveyId: string,
): Promise<ReleaseVerificationPreflightEvidence> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(
      buildUrl(backendUrl, "/api/v1/intern/feedback", {
        team: target.team,
        app: target.app,
        surveyId,
        page: "0",
        size: "1",
      }),
      { headers: getHeaders(oboToken) },
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          status: "failed",
          checkedAt,
          team: target.team,
          app: target.app,
          message: `Mangler lesetilgang til ${target.team}/${target.app}`,
        };
      }
      return {
        status: "unavailable",
        checkedAt,
        team: target.team,
        app: target.app,
        message: "Team-preflight er midlertidig utilgjengelig",
      };
    }
    return {
      status: "passed",
      checkedAt,
      team: target.team,
      app: target.app,
    };
  } catch {
    return {
      status: "unavailable",
      checkedAt,
      team: target.team,
      app: target.app,
      message: "Team-preflight er midlertidig utilgjengelig",
    };
  }
}

async function readExactProbe(
  { backendUrl, oboToken }: AuthContext,
  target: ReleaseVerificationTarget,
  expected: {
    phase: ReleaseVerificationPhase;
    surveyId: string;
    receiptId: string;
    duplicate: boolean | null;
  },
): Promise<ReleaseVerificationProbeEvidence> {
  const retryDelaysMs = [0, 100, 250, 500];
  for (const [attempt, delayMs] of retryDelaysMs.entries()) {
    if (delayMs > 0) await delay(delayMs);
    try {
      const response = await fetch(
        buildUrl(
          backendUrl,
          `/api/v1/intern/feedback/${encodeURIComponent(expected.receiptId)}`,
          { team: target.team },
        ),
        { headers: getHeaders(oboToken) },
      );
      if (response.status === 404) {
        if (attempt < retryDelaysMs.length - 1) continue;
        return verifyReleaseVerificationReadback(null, {
          ...expected,
          app: target.app,
          channel: target.channel,
        });
      }
      if (!response.ok) {
        if (response.status >= 500 && attempt < retryDelaysMs.length - 1) {
          continue;
        }
        return response.status >= 500
          ? unavailableReadback(expected, `readback-http-${response.status}`)
          : failedReadback(expected, `readback-http-${response.status}`);
      }
      const parsed = feedbackReadbackSchema.safeParse(await response.json());
      if (!parsed.success) {
        return failedReadback(expected, "readback-contract");
      }
      return verifyReleaseVerificationReadback(parsed.data, {
        ...expected,
        app: target.app,
        channel: target.channel,
      });
    } catch {
      if (attempt === retryDelaysMs.length - 1) {
        return unavailableReadback(expected, "readback-request");
      }
    }
  }
  return unavailableReadback(expected, "readback-request");
}

function failedReadback(
  expected: {
    phase: ReleaseVerificationPhase;
    receiptId: string;
    duplicate: boolean | null;
  },
  mismatch: string,
): ReleaseVerificationProbeEvidence {
  return {
    phase: expected.phase,
    status: "mismatch",
    receiptId: expected.receiptId,
    duplicate: expected.duplicate,
    storedAt: null,
    mismatches: [mismatch],
  };
}

function unavailableReadback(
  expected: {
    phase: ReleaseVerificationPhase;
    receiptId: string;
    duplicate: boolean | null;
  },
  mismatch: string,
): ReleaseVerificationProbeEvidence {
  return {
    phase: expected.phase,
    status: "unavailable",
    receiptId: expected.receiptId,
    duplicate: expected.duplicate,
    storedAt: null,
    mismatches: [mismatch],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertReleaseVerificationEnabled(): void {
  if (!releaseVerificationEnabled()) {
    throw new Error("Release-verifikasjon er bare tilgjengelig i dev");
  }
}

function assertExpectedSubmission(
  payload: z.infer<typeof transportPayloadSchema>,
  target: ReleaseVerificationTarget,
): ReleaseVerificationPhase {
  const phase = phaseSchema.safeParse(payload.context?.tags?.phase);
  const expectedControlOption = createReleaseVerificationControlOptionId(
    payload.surveyId,
  );
  const ratingDefinition = payload.definition.fields.find(
    ({ fieldId }) => fieldId === "rating",
  );
  const controlDefinition = payload.definition.fields.find(
    ({ fieldId }) => fieldId === RELEASE_VERIFICATION_CONTROL_FIELD_ID,
  );
  const ratingAnswer = payload.answers.find(
    ({ fieldId }) => fieldId === "rating",
  );
  const controlAnswer = payload.answers.find(
    ({ fieldId }) => fieldId === RELEASE_VERIFICATION_CONTROL_FIELD_ID,
  );

  if (
    payload.surveyType !== "rating" ||
    payload.definition.surveyType !== "rating" ||
    payload.definition.fields.length !== 2 ||
    ratingDefinition?.fieldType !== "RATING" ||
    ratingDefinition.ratingVariant !== "emoji" ||
    ratingDefinition.ratingScale !== 5 ||
    controlDefinition?.fieldType !== "SINGLE_CHOICE" ||
    controlDefinition.optionIds.length !== 1 ||
    controlDefinition.optionIds[0] !== expectedControlOption ||
    payload.answers.length !== 2 ||
    ratingAnswer?.fieldType !== "RATING" ||
    ratingAnswer.value.type !== "rating" ||
    ratingAnswer.value.rating !== RELEASE_VERIFICATION_RATING ||
    controlAnswer?.fieldType !== "SINGLE_CHOICE" ||
    controlAnswer.value.type !== "singleChoice" ||
    controlAnswer.value.selectedOptionId !== expectedControlOption ||
    payload.context?.tags?.purpose !== "release-verification" ||
    payload.context?.tags?.channel !== target.channel ||
    !phase.success
  ) {
    throw new Error("Uventet payload i release-verifikasjonen");
  }
  return phase.data;
}
