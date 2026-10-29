import { register } from "@prometheus-io/client";
import { notFound, redirect } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "~/server/logger";
import { LumiApiTimeoutError } from "~/server/lumiApiFetch";
import {
  reportServerFnFailure,
  SERVER_FN_5XX_FAILURES_METRIC,
  SERVER_FN_FAILURES_METRIC,
} from "~/server/serverFnFailures";
import { BadGatewayError, HttpStatusError } from "~/server/serverFnStatus";
import { startInstance } from "~/start";
import { ApiErrorException, ErrorType } from "~/types/errors";

const doubles = vi.hoisted(() => ({
  getResponseStatus: vi.fn<() => number>(),
  setResponseStatus: vi.fn(),
  setResponseHeaders: vi.fn(),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return { ...actual, getGlobalStartContext: vi.fn() };
});
vi.mock("@tanstack/react-start/server", () => doubles);
vi.mock("~/server/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

const mockLogger = vi.mocked(logger);
const mockGlobalContext = vi.mocked(getGlobalStartContext);
const STATS = "fetchStatsServerFn";

function callOverHttp() {
  mockGlobalContext.mockReturnValue({ cspNonce: "n", serverFnHttpCall: true });
}

function callDuringSsr() {
  mockGlobalContext.mockReturnValue({ cspNonce: "n", serverFnHttpCall: false });
}

async function failureCounts() {
  const metric = register.getSingleMetric(SERVER_FN_FAILURES_METRIC);
  return metric ? (await metric.get()).values : [];
}

async function failureCount(fn: string, status: string): Promise<number> {
  const values = await failureCounts();
  return (
    values.find(({ labels }) => labels.fn === fn && labels.status === status)
      ?.value ?? 0
  );
}

async function failures5xx(): Promise<number> {
  const metric = register.getSingleMetric(SERVER_FN_5XX_FAILURES_METRIC);
  if (!metric) throw new Error("The 5xx counter is not registered");
  return (await metric.get()).values[0]?.value ?? 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  register.resetMetrics();
  doubles.getResponseStatus.mockReturnValue(200);
});

describe("reportServerFnFailure", () => {
  it("answers 504 and counts an API timeout without logging the request", async () => {
    callOverHttp();
    reportServerFnFailure(new LumiApiTimeoutError(), {
      serverFn: STATS,
      durationMs: 30_001,
    });

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(504);
    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      {
        serverFn: STATS,
        status: 504,
        errorName: "LumiApiTimeoutError",
        apiErrorType: undefined,
        durationMs: 30_001,
        httpCall: true,
      },
      "Server function failed",
    );
    expect(await failureCount(STATS, "504")).toBe(1);
    expect(await failures5xx()).toBe(1);
  });

  it("has the 5xx counter at 0 before the first failure", async () => {
    expect(
      await register.getSingleMetricAsString(SERVER_FN_5XX_FAILURES_METRIC),
    ).toContain(`${SERVER_FN_5XX_FAILURES_METRIC} 0`);
  });

  it("answers 502 and logs an error when Lumi API cannot be reached", async () => {
    callOverHttp();

    reportServerFnFailure(new TypeError("fetch failed"), {
      serverFn: STATS,
      durationMs: 12.4,
    });

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(502);
    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      {
        serverFn: STATS,
        status: 502,
        errorName: "TypeError",
        apiErrorType: undefined,
        durationMs: 12,
        httpCall: true,
      },
      "Server function failed",
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(await failureCount(STATS, "502")).toBe(1);
    expect(await failures5xx()).toBe(1);
  });

  it("answers 502 when Lumi API breaks the contract", async () => {
    callOverHttp();

    reportServerFnFailure(new BadGatewayError("[]"), {
      serverFn: "fetchQuestionTrendServerFn",
      durationMs: 4,
    });

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(502);
    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: 502, errorName: "BadGatewayError" }),
      "Server function failed",
    );
    expect(await failureCount("fetchQuestionTrendServerFn", "502")).toBe(1);
    expect(await failures5xx()).toBe(1);
  });

  it("keeps the status authMiddleware already set and logs a warning", async () => {
    callOverHttp();
    doubles.getResponseStatus.mockReturnValue(401);

    reportServerFnFailure(
      new HttpStatusError(401, "Unauthorized: No token provided"),
      { serverFn: STATS, durationMs: 3 },
    );

    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        status: 401,
        errorName: "HttpStatusError",
        httpCall: true,
      }),
      "Server function failed",
    );
    expect(await failureCount(STATS, "401")).toBe(1);
    expect(await failures5xx()).toBe(0);
  });

  it("logs and counts the error status that is already on the response", async () => {
    callOverHttp();
    doubles.getResponseStatus.mockReturnValue(403);

    reportServerFnFailure(new TypeError("fetch failed"), {
      serverFn: STATS,
      durationMs: 3,
    });

    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 }),
      "Server function failed",
    );
    expect(await failureCount(STATS, "403")).toBe(1);
    expect(await failureCount(STATS, "502")).toBe(0);
    expect(await failures5xx()).toBe(0);
  });

  it("replaces a success status set before the failure", () => {
    callOverHttp();
    doubles.getResponseStatus.mockReturnValue(201);

    reportServerFnFailure(new Error("Theme not found"), {
      serverFn: "updateThemeServerFn",
      durationMs: 3,
    });

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(500);
  });

  it("leaves the page's status alone during SSR, but logs and counts", async () => {
    callDuringSsr();

    reportServerFnFailure(new TypeError("fetch failed"), {
      serverFn: "fetchFilterBootstrapServerFn",
      durationMs: 1,
    });

    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
    expect(doubles.getResponseStatus).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        serverFn: "fetchFilterBootstrapServerFn",
        status: 502,
        httpCall: false,
      }),
      "Server function failed",
    );
    expect(await failureCount("fetchFilterBootstrapServerFn", "502")).toBe(1);
    expect(await failures5xx()).toBe(1);
  });

  it("logs the error type of an answer from Lumi API", async () => {
    callOverHttp();

    reportServerFnFailure(
      new ApiErrorException({
        status: 503,
        type: ErrorType.DATABASE_UNAVAILABLE,
        message: "Databasen svarer ikke akkurat nå",
        timestamp: "2026-10-23T08:00:00Z",
      }),
      { serverFn: STATS, durationMs: 15_000 },
    );

    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(503);
    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        status: 503,
        errorName: "ApiErrorException",
        apiErrorType: "DATABASE_UNAVAILABLE",
      }),
      "Server function failed",
    );
    expect(await failureCount(STATS, "503")).toBe(1);
  });

  it("never logs the error message", () => {
    callOverHttp();
    const message = "Fant ikke svaret fra 12345678901 om Ola Nordmann";

    reportServerFnFailure(new Error(message), {
      serverFn: STATS,
      durationMs: 1,
    });
    reportServerFnFailure(new HttpStatusError(403, message), {
      serverFn: STATS,
      durationMs: 1,
    });

    const logged = JSON.stringify([
      mockLogger.error.mock.calls,
      mockLogger.warn.mock.calls,
    ]);
    expect(logged).not.toContain("12345678901");
    expect(logged).not.toContain("Ola Nordmann");
  });

  it.each([
    ["a redirect", () => redirect({ to: "/" })],
    ["notFound()", () => notFound()],
    ["a thrown Response", () => new Response("Nope", { status: 418 })],
  ])("leaves %s to Start", async (_name, create) => {
    callOverHttp();

    reportServerFnFailure(create(), { serverFn: STATS, durationMs: 1 });

    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(
      (await failureCounts()).reduce((sum, { value }) => sum + value, 0),
    ).toBe(0);
    expect(await failures5xx()).toBe(0);
  });
});

describe("the global function middleware in start.ts", () => {
  async function failureMiddleware() {
    const { functionMiddleware } = await startInstance.getOptions();
    expect(functionMiddleware).toHaveLength(1);
    const server = functionMiddleware?.[0]?.options.server;
    if (!server) throw new Error("The middleware has no server part");
    return server;
  }

  const serverFnMeta = {
    id: "abc123",
    name: STATS,
    filename: "app/server/actions/fetchStats.ts",
  };

  it("passes the result of the server function through", async () => {
    const server = await failureMiddleware();
    const result = { result: "svar" };

    await expect(
      server({ next: async () => result, serverFnMeta } as never),
    ).resolves.toBe(result);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("reports a failure and rethrows the same error", async () => {
    callOverHttp();
    const server = await failureMiddleware();
    const error = new TypeError("fetch failed");

    await expect(
      server({
        next: async () => {
          throw error;
        },
        serverFnMeta,
      } as never),
    ).rejects.toBe(error);
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(502);
    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        serverFn: STATS,
        durationMs: expect.any(Number),
      }),
      "Server function failed",
    );
    expect(await failureCount(STATS, "502")).toBe(1);
  });

  it("rethrows the same error when logging fails", async () => {
    callOverHttp();
    mockLogger.error.mockImplementationOnce(() => {
      throw new Error("The log is full");
    });
    const server = await failureMiddleware();
    const error = new TypeError("fetch failed");

    await expect(
      server({
        next: async () => {
          throw error;
        },
        serverFnMeta,
      } as never),
    ).rejects.toBe(error);
  });
});
