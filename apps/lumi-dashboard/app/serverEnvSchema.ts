import { z } from "zod";

import { publicEnv } from "~/publicEnv";

export const serverEnvSchema = z.preprocess(
  (input) =>
    Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        value === "" ? undefined : value,
      ]),
    ),
  z
    .object({
      LUMI_API_URL: z.url().optional(),
      LUMI_API_AUDIENCE: z.string().min(1).optional(),
      NAIS_CLUSTER_NAME: z.string().optional(),
      USE_MOCK_DATA: z.string().optional(),
      LUMI_E2E_FIXTURES: z.enum(["true", "false"]).optional(),
      LUMI_LOCAL_AUTH_BYPASS: z.enum(["true", "false"]).optional(),
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    })
    .superRefine((env, ctx) => {
      // Match isMockMode's explicit flags, including the build-time demo flag.
      const mock =
        publicEnv.VITE_MOCK_DATA === "true" ||
        (publicEnv.VITE_MOCK_DATA !== "false" && env.USE_MOCK_DATA === "true");
      if (!env.NAIS_CLUSTER_NAME || mock) return;

      for (const key of ["LUMI_API_URL", "LUMI_API_AUDIENCE"] as const) {
        if (env[key] === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required when running on Nais with real data",
          });
        }
      }
    })
    .transform((env) => ({
      ...env,
      LUMI_API_URL: env.LUMI_API_URL ?? "http://localhost:8080",
      LUMI_API_AUDIENCE:
        env.LUMI_API_AUDIENCE ?? "api://dev-gcp.team-esyfo.lumi-api/.default",
    })),
);

export type ServerEnv = z.output<typeof serverEnvSchema>;
