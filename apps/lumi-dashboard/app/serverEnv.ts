import { z } from "zod";

const serverSchema = z.object({
  // Optional with defaults for local development
  // Lumi backend configuration
  LUMI_API_URL: z.string().url().default("http://localhost:8080"),
  LUMI_API_AUDIENCE: z
    .string()
    .min(1)
    .default("api://dev-gcp.team-esyfo.lumi-api/.default"),

  NAIS_CLUSTER_NAME: z.string().optional(),
  USE_MOCK_DATA: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Validated server-side environment variables.
 * accessinig this on the client will throw an error or return undefined depending on strictness.
 * Best practice: Only import this in server-only files (entry-server, app/server/*).
 */
export const serverEnv = (() => {
  if (typeof window !== "undefined" || typeof process === "undefined") {
    // We are on the client, or process is not polyfilled.
    return {} as z.infer<typeof serverSchema>;
  }

  // Validate process.env
  // process.env values are strings. Empty strings should be treated as undefined for .default() to work.
  const env = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      value === "" ? undefined : value,
    ]),
  );

  const result = serverSchema.safeParse(env);

  if (!result.success) {
    console.error(
      "❌ Invalid server environment variables:",
      result.error.flatten(),
    );
    // In dev we might want to throw, in prod definitely throw.
    throw new Error("Invalid environment variables");
  }

  return result.data;
})();
