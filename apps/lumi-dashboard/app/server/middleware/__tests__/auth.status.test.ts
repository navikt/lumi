import { getGlobalStartContext } from "@tanstack/react-start";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "~/server/logger";
import { authMiddleware, clearOboTokenCacheForTesting } from "../auth";

const doubles = vi.hoisted(() => ({
  getToken: vi.fn<(request: Request) => string | null>(),
  validateAzureToken: vi.fn(),
  requestAzureOboToken: vi.fn(),
  setResponseStatus: vi.fn(),
}));

vi.mock("@navikt/oasis", () => ({
  getToken: doubles.getToken,
  validateAzureToken: doubles.validateAzureToken,
  requestAzureOboToken: doubles.requestAzureOboToken,
}));
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return { ...actual, getGlobalStartContext: vi.fn() };
});
vi.mock("@tanstack/react-start/server", () => ({
  setResponseStatus: doubles.setResponseStatus,
}));
vi.mock("~/server/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/utils", () => ({ isMockMode: () => false }));
vi.mock("~/serverEnv", () => ({
  serverEnv: { NAIS_CLUSTER_NAME: "dev-gcp" },
}));

const mockGlobalContext = vi.mocked(getGlobalStartContext);
const mockLogger = vi.mocked(logger);

/** Start's own classification, which start.ts puts in the global context. */
function callOverHttp() {
  mockGlobalContext.mockReturnValue({ cspNonce: "n", serverFnHttpCall: true });
}

function callDuringSsr() {
  mockGlobalContext.mockReturnValue({ cspNonce: "n", serverFnHttpCall: false });
}

async function failureFrom(
  request = new Request("https://lumi.example/"),
): Promise<unknown> {
  const server = authMiddleware.options.server;
  if (!server) throw new Error("authMiddleware has no server part");
  const next = vi.fn();
  const error = await Promise.resolve(
    server({ next, request, context: {} } as never),
  ).then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(next).not.toHaveBeenCalled();
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearOboTokenCacheForTesting();
  doubles.getToken.mockReturnValue("azure-token");
  doubles.validateAzureToken.mockResolvedValue({ ok: true });
  doubles.requestAzureOboToken.mockResolvedValue({
    ok: false,
    error: new Error("invalid_grant"),
  });
});

describe("authMiddleware failures", () => {
  it("answers 401 to a server function called without a token", async () => {
    callOverHttp();
    doubles.getToken.mockReturnValue(null);

    const error = await failureFrom();

    expect(error).toMatchObject({
      status: 401,
      message: "Unauthorized: No token provided",
    });
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(401);
  });

  it("leaves the page's status alone when SSR calls it without a token", async () => {
    callDuringSsr();
    doubles.getToken.mockReturnValue(null);

    const error = await failureFrom();

    expect(error).toMatchObject({
      status: 401,
      message: "Unauthorized: No token provided",
    });
    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
  });

  it("answers 401 for a token that is not valid", async () => {
    callOverHttp();
    doubles.validateAzureToken.mockResolvedValue({ ok: false });

    expect(await failureFrom()).toMatchObject({
      status: 401,
      message: "Unauthorized: Invalid token",
    });
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(401);
  });

  it("answers 502 when the token exchange fails, also during SSR", async () => {
    callOverHttp();
    expect(await failureFrom()).toMatchObject({
      status: 502,
      message: "Token exchange failed",
    });
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(502);

    doubles.setResponseStatus.mockClear();
    callDuringSsr();
    expect(await failureFrom()).toMatchObject({
      status: 502,
      message: "Token exchange failed",
    });
    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
  });

  it("logs a failed token exchange as a warning, since the failure is logged as an error", async () => {
    callOverHttp();

    await failureFrom();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: expect.any(String) }),
      "OBO token exchange failed",
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("answers 403 to a write from another origin", async () => {
    callOverHttp();
    const error = await failureFrom(
      new Request("https://lumi.example/_serverFn/abc123", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );

    expect(error).toMatchObject({
      status: 403,
      message: "Forbidden: Cross-origin request",
    });
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(403);
  });

  it("throws a plain error, not an answer from Lumi API about team access", async () => {
    callOverHttp();
    doubles.getToken.mockReturnValue(null);

    const error = await failureFrom();

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("error");
    expect(error).toMatchObject({ name: "HttpStatusError" });
  });
});
