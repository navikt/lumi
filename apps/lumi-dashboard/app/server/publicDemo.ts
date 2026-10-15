import { setResponseStatus } from "@tanstack/react-start/server";

import { isMockMode } from "~/server/utils";
import { serverEnv } from "~/serverEnv";
import { PUBLIC_DEMO_READ_ONLY_MESSAGE } from "~/utils/publicDemo";

export interface PublicDemoInput {
  isMockMode: boolean;
  naisClusterName?: string;
}

/**
 * The public demo is the mock build running on Nais: it has no login, and
 * every visitor shares the same in-memory stores. Nais sets
 * NAIS_CLUSTER_NAME in every pod, while local mock mode never has it, so
 * local development keeps a writable mock.
 */
export function resolveIsPublicDemo({
  isMockMode,
  naisClusterName,
}: PublicDemoInput): boolean {
  return isMockMode && Boolean(naisClusterName);
}

export function isPublicDemo(): boolean {
  return resolveIsPublicDemo({
    isMockMode: isMockMode(),
    naisClusterName: serverEnv.NAIS_CLUSTER_NAME,
  });
}

/**
 * Refuses a write in the public demo before it reaches a shared mock store,
 * where every other visitor would see it. Reads stay open so the demo data
 * can still be shown.
 */
export function refuseWriteInPublicDemo(): void {
  if (!isPublicDemo()) return;
  setResponseStatus(403);
  throw new Error(PUBLIC_DEMO_READ_ONLY_MESSAGE);
}
