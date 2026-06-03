import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
} from "~/server/utils";
import { serverEnv } from "~/serverEnv";
import { handleApiResponse } from "../fetchUtils";

export interface NaisAuthDiagnosticsResponse {
  enabled: boolean;
  cluster?: string | null;
  message?: string | null;
  principal: {
    hasNavIdent: boolean;
    hasName: boolean;
    hasEmail: boolean;
    groupCount: number;
    clientId?: string | null;
  };
  userTeamEntraGroups?: {
    ok: boolean;
    durationMs: number;
    teamCount?: number | null;
    teamsWithEntraGroup?: number | null;
    teamsMatchedByTokenGroups?: number | null;
    matchedTeamSlugs: string[];
    missingGroupMatchTeamSlugs: string[];
    message?: string | null;
  } | null;
  meTargets: Array<{
    target: string;
    exchange: {
      ok: boolean;
      durationMs: number;
      message?: string | null;
    };
    me?: {
      ok: boolean;
      durationMs: number;
      typename?: string | null;
      teamCount?: number | null;
      teamSlugs: string[];
      message?: string | null;
    } | null;
  }>;
}

export const fetchNaisAuthDiagnosticsServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<NaisAuthDiagnosticsResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode() || serverEnv.NAIS_CLUSTER_NAME !== "dev-gcp") {
      return {
        enabled: false,
        cluster: serverEnv.NAIS_CLUSTER_NAME,
        message: "NAIS auth diagnostics are only enabled in dev-gcp",
        principal: {
          hasNavIdent: false,
          hasName: false,
          hasEmail: false,
          groupCount: 0,
          clientId: null,
        },
        meTargets: [],
      };
    }

    const url = buildUrl(backendUrl, "/api/v1/intern/diagnostics/nais-auth");
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<NaisAuthDiagnosticsResponse>;
  });
