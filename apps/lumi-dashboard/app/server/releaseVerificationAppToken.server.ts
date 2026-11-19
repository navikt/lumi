import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import { requestAzureClientCredentialsToken } from "@navikt/oasis";
import { BadGatewayError } from "~/server/serverFnStatus";
import { serverEnv } from "~/serverEnv";
import {
  createReleaseVerificationControlOptionId,
  RELEASE_VERIFICATION_CONTROL_FIELD_ID,
  RELEASE_VERIFICATION_RATING,
} from "~/utils/releaseVerification";

export async function requestProbeAppToken(
  expectedCaller: string,
): Promise<string> {
  const result = await requestAzureClientCredentialsToken(
    serverEnv.LUMI_API_AUDIENCE,
  ).catch(() => null);
  if (!result?.ok) {
    throw new BadGatewayError("Kunne ikke hente app-token fra Entra ID.");
  }

  // Only inspect the three fields reported by the probe. Lumi API validates the token with Texas.
  let claims: Record<string, unknown>;
  try {
    const segments = result.token.split(".");
    if (segments.length !== 3) throw new Error();
    claims = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || Array.isArray(claims))
      throw new Error();
  } catch {
    throw new BadGatewayError("Kunne ikke lese feltene i app-tokenet.");
  }
  const mismatches: string[] = [];
  if (claims.azp_name !== expectedCaller) {
    mismatches.push(
      claims.azp_name == null
        ? "azp_name mangler"
        : "azp_name avviker fra dashboardets navn",
    );
  }
  if (claims.idtyp !== "app") {
    mismatches.push(
      claims.idtyp == null
        ? "idtyp mangler"
        : "idtyp har en annen verdi enn app",
    );
  }
  if (
    !Array.isArray(claims.roles) ||
    !claims.roles.includes("access_as_application")
  ) {
    mismatches.push("roles mangler access_as_application");
  }
  if (mismatches.length) throw new BadGatewayError(mismatches.join(". "));
  return result.token;
}

export function createAppProbeSubmission(
  surveyId: string,
): LumiSurveyTransportPayload {
  const optionId = createReleaseVerificationControlOptionId(surveyId);
  const rating = { fieldId: "rating", fieldType: "RATING" } as const;
  const control = {
    fieldId: RELEASE_VERIFICATION_CONTROL_FIELD_ID,
    fieldType: "SINGLE_CHOICE",
  } as const;
  return {
    schemaVersion: 2,
    surveyType: "rating",
    surveyId,
    submittedAt: new Date().toISOString(),
    deduplicationKey: `${surveyId}-app-token`,
    context: {
      tags: {
        purpose: "release-verification",
        phase: "app-token",
        channel: "azure-client-credentials",
      },
    },
    definition: {
      surveyType: "rating",
      fields: [
        { ...rating, ratingVariant: "emoji", ratingScale: 5 },
        { ...control, optionIds: [optionId] },
      ],
    },
    answers: [
      {
        ...rating,
        question: { label: "Vurdering" },
        value: {
          type: "rating",
          rating: RELEASE_VERIFICATION_RATING,
          ratingVariant: "emoji",
          ratingScale: 5,
        },
      },
      {
        ...control,
        question: {
          label: "Kontrollkode",
          options: [{ id: optionId, label: optionId }],
        },
        value: { type: "singleChoice", selectedOptionId: optionId },
      },
    ],
  };
}
