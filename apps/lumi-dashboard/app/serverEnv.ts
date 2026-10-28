import { z } from "zod";
import { type ServerEnv, serverEnvSchema } from "~/serverEnvSchema";

/**
 * Validated server-side environment variables.
 * accessinig this on the client will throw an error or return undefined depending on strictness.
 * Best practice: Only import this in server-only files (entry-server, app/server/*).
 */
export const serverEnv = (() => {
  if (typeof window !== "undefined" || typeof process === "undefined") {
    // We are on the client, or process is not polyfilled.
    return {} as ServerEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "❌ Invalid server environment variables:",
      z.flattenError(result.error),
    );
    // In dev we might want to throw, in prod definitely throw.
    throw new Error("Invalid environment variables");
  }

  return result.data;
})();
