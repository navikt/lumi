export interface LocalAuthPolicyInput {
  isMockMode: boolean;
  naisClusterName?: string;
  localAuthBypass?: "true" | "false";
}

export interface LocalAuthPolicy {
  bypassEnabled: boolean;
  oboToken: string | null;
}

/**
 * Local real-data mode is deliberately fail-closed. Mock mode needs no backend
 * token, while calls to a local lumi-api require an explicit opt-in and receive
 * the non-secret bearer token accepted by the API's local auth realm.
 */
export function resolveLocalAuthPolicy({
  isMockMode,
  naisClusterName,
  localAuthBypass,
}: LocalAuthPolicyInput): LocalAuthPolicy {
  if (isMockMode) {
    return { bypassEnabled: true, oboToken: null };
  }

  const bypassEnabled = !naisClusterName && localAuthBypass === "true";

  return {
    bypassEnabled,
    oboToken: bypassEnabled ? "local-dev" : null,
  };
}
