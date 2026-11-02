// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readinessResponse } from "~/server/readiness";
import validateServerEnv from "~/server/validateServerEnv";
import { serverEnvSchema } from "~/serverEnvSchema";

const publicEnv = vi.hoisted(() => ({
  VITE_MOCK_DATA: undefined as "true" | "false" | undefined,
}));
vi.mock("~/publicEnv", () => ({ publicEnv }));

beforeEach(() => {
  publicEnv.VITE_MOCK_DATA = undefined;
  vi.stubEnv("NAIS_CLUSTER_NAME", "prod-gcp");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("USE_MOCK_DATA", "false");
  vi.stubEnv("LUMI_API_URL", "http://lumi-api");
  vi.stubEnv(
    "LUMI_API_AUDIENCE",
    "api://prod-gcp.team-esyfo.lumi-api/.default",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dashboard configuration and readiness", () => {
  it("is ready with valid configuration without calling Lumi API", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("API is down"));
    vi.stubGlobal("fetch", fetch);
    const response = readinessResponse();
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("OK");
    expect(fetch).not.toHaveBeenCalled();
    expect(() => validateServerEnv({} as never)).not.toThrow();
  });

  it.each(["LUMI_API_URL", "LUMI_API_AUDIENCE"])(
    "refuses readiness when %s is missing or empty on Nais",
    async (key) => {
      for (const value of [undefined, ""]) {
        vi.stubEnv(key, value);
        expect(() => validateServerEnv({} as never)).toThrow(key);
        const response = readinessResponse();
        expect(response.status).toBe(503);
        await expect(response.text()).resolves.toBe(
          "Invalid server configuration",
        );
      }
    },
  );

  it("refuses malformed configuration without exposing values", async () => {
    vi.stubEnv("LUMI_API_URL", "private.invalid-url");
    const response = readinessResponse();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });

  it("keeps local defaults, including local real-data mode", () => {
    const env = serverEnvSchema.parse({
      NODE_ENV: "development",
      USE_MOCK_DATA: "false",
      LUMI_API_URL: "",
    });
    expect(env.LUMI_API_URL).toBe("http://localhost:8080");
    expect(env.LUMI_API_AUDIENCE).toBe(
      "api://dev-gcp.team-esyfo.lumi-api/.default",
    );
  });

  it("keeps the Nais mock demo ready without API configuration", () => {
    vi.stubEnv("USE_MOCK_DATA", "true");
    vi.stubEnv("LUMI_API_URL", undefined);
    vi.stubEnv("LUMI_API_AUDIENCE", undefined);
    expect(readinessResponse().status).toBe(200);
    expect(() => validateServerEnv({} as never)).not.toThrow();
  });

  it("accepts the demo manifest's placeholder values", () => {
    const env = serverEnvSchema.parse({
      NAIS_CLUSTER_NAME: "dev-gcp",
      USE_MOCK_DATA: "true",
      NODE_ENV: "production",
      LUMI_API_URL: "http://localhost",
      LUMI_API_AUDIENCE: "demo-audience",
    });
    expect(env.LUMI_API_AUDIENCE).toBe("demo-audience");
  });

  it("respects the build-time mock flag before the runtime flag", () => {
    vi.stubEnv("LUMI_API_URL", undefined);
    vi.stubEnv("LUMI_API_AUDIENCE", undefined);
    publicEnv.VITE_MOCK_DATA = "true";
    expect(readinessResponse().status).toBe(200);

    publicEnv.VITE_MOCK_DATA = "false";
    vi.stubEnv("USE_MOCK_DATA", "true");
    expect(readinessResponse().status).toBe(503);
  });

  it("fails when the server environment is loaded with missing Nais configuration", async () => {
    vi.stubEnv("LUMI_API_AUDIENCE", undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    await expect(import("~/serverEnv")).rejects.toThrow(
      "Invalid environment variables",
    );
  });
});
