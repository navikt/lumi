import { getGlobalStartContext } from "@tanstack/react-start";
import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from "@tanstack/router-core/ssr/client";
import { fromCrossJSON, toCrossJSONAsync } from "seroval";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleApiResponse, parseApiAnswer } from "~/server/fetchUtils";
import {
  apiStatusError,
  BadGatewayError,
  HttpStatusError,
  isServerFnHttpCall,
  serverFnFailureStatus,
  setServerFnHttpStatus,
} from "~/server/serverFnStatus";
import { startInstance } from "~/start";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  ArchiveSurveySchema,
  QuestionTrendResponseSchema,
} from "~/types/schemas";
import { apiErrorSerializationAdapter } from "~/utils/apiErrorSerialization";

const doubles = vi.hoisted(() => ({
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

const mockGlobalContext = vi.mocked(getGlobalStartContext);

function apiError(status: number, type = ErrorType.INTERNAL_SERVER_ERROR) {
  return new ApiErrorException({
    status,
    type,
    message: "Melding fra API-et",
    timestamp: "2026-10-23T08:00:00Z",
  });
}

/** What Start throws when the schema in .validator() rejects the input. */
async function invalidInputError(input: unknown): Promise<Error> {
  const result = await ArchiveSurveySchema["~standard"].validate(input);
  if (!("issues" in result) || !result.issues) {
    throw new Error("The input was valid");
  }
  return new Error(JSON.stringify(result.issues, undefined, 2));
}

/** An unmasked bucket without responseCount breaks the contract. */
const brokenQuestionTrend = {
  fieldId: "q1",
  fieldType: "RATING",
  label: "Hvor fornøyd er du?",
  interval: "week",
  privacyThreshold: 5,
  options: [],
  buckets: [
    {
      startDate: "2026-10-05",
      masked: false,
      responseCount: null,
      distribution: {},
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("serverFnFailureStatus", () => {
  it("uses the status of an answer from Lumi API", () => {
    expect(serverFnFailureStatus(apiError(403))).toBe(403);
    expect(
      serverFnFailureStatus(apiError(503, ErrorType.DATABASE_UNAVAILABLE)),
    ).toBe(503);
  });

  it("gives 500 when Lumi API reports a status that is not an error", () => {
    expect(serverFnFailureStatus(apiError(200))).toBe(500);
  });

  it("uses the status an error carries itself", () => {
    expect(serverFnFailureStatus(new HttpStatusError(401, "Nope"))).toBe(401);
    expect(serverFnFailureStatus(new BadGatewayError("Nope"))).toBe(502);
    expect(
      serverFnFailureStatus(Object.assign(new Error("x"), { status: 409 })),
    ).toBe(409);
  });

  it("ignores a status outside 400-599", () => {
    expect(
      serverFnFailureStatus(Object.assign(new Error("x"), { status: 302 })),
    ).toBe(500);
    expect(
      serverFnFailureStatus(Object.assign(new Error("x"), { status: "404" })),
    ).toBe(500);
  });

  it("gives 400 when the schema in .validator() rejects the input", async () => {
    const error = await invalidInputError({});

    expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
    expect(serverFnFailureStatus(error)).toBe(400);
  });

  it("gives 502, not 400, when an answer from Lumi API breaks the contract", () => {
    let error: unknown;
    try {
      parseApiAnswer(QuestionTrendResponseSchema, brokenQuestionTrend);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadGatewayError);
    expect(serverFnFailureStatus(error)).toBe(502);
  });

  it("never takes a subclass of Error for invalid input", async () => {
    const { message } = await invalidInputError({});
    class ZodError extends Error {}

    expect(serverFnFailureStatus(new ZodError(message))).toBe(500);
  });

  it("gives 502 when Lumi API cannot be reached", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    expect(
      serverFnFailureStatus(new TypeError("fetch failed", { cause: refused })),
    ).toBe(502);
    expect(serverFnFailureStatus(new TypeError("terminated"))).toBe(502);
  });

  it("gives 502 when Lumi API answers with an error it does not describe", async () => {
    const error = await handleApiResponse(
      new Response("<html>Bad gateway</html>", {
        status: 503,
        statusText: "Service Unavailable",
      }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadGatewayError);
    expect(error).toMatchObject({
      message: "Backend request failed: 503 Service Unavailable",
    });
    expect(serverFnFailureStatus(error)).toBe(502);
  });

  it("gives 500 for everything else", () => {
    expect(
      serverFnFailureStatus(
        new TypeError("Cannot read properties of undefined"),
      ),
    ).toBe(500);
    expect(serverFnFailureStatus(new Error("Theme not found"))).toBe(500);
    expect(serverFnFailureStatus(new Error("[1, 2]"))).toBe(500);
    expect(serverFnFailureStatus(new Error("[not json"))).toBe(500);
    expect(serverFnFailureStatus("a string")).toBe(500);
    expect(serverFnFailureStatus(undefined)).toBe(500);
  });
});

describe("apiStatusError", () => {
  it("keeps a 4xx from Lumi API, which is about the viewer", () => {
    const error = apiStatusError(403, "Analyseproduktet kunne ikke hentes.");

    expect(error).not.toBeInstanceOf(BadGatewayError);
    expect(error).toMatchObject({
      status: 403,
      message: "Analyseproduktet kunne ikke hentes.",
    });
  });

  it("turns a 5xx from Lumi API into 502", () => {
    for (const status of [500, 503]) {
      const error = apiStatusError(status, "BigQuery-eksporten kunne ikke");

      expect(error).toBeInstanceOf(BadGatewayError);
      expect(error.status).toBe(502);
    }
  });
});

describe("isServerFnHttpCall", () => {
  it("reads the flag that start.ts puts in the global context", () => {
    mockGlobalContext.mockReturnValueOnce({
      cspNonce: "n",
      serverFnHttpCall: true,
    });
    expect(isServerFnHttpCall()).toBe(true);

    mockGlobalContext.mockReturnValueOnce({
      cspNonce: "n",
      serverFnHttpCall: false,
    });
    expect(isServerFnHttpCall()).toBe(false);
  });

  it("is false outside a request", () => {
    mockGlobalContext.mockImplementationOnce(() => {
      throw new Error("No Start context found");
    });
    expect(isServerFnHttpCall()).toBe(false);

    mockGlobalContext.mockReturnValueOnce(undefined);
    expect(isServerFnHttpCall()).toBe(false);
  });
});

describe("setServerFnHttpStatus", () => {
  it("sets the status of a server function called over HTTP", () => {
    mockGlobalContext.mockReturnValue({
      cspNonce: "n",
      serverFnHttpCall: true,
    });

    expect(setServerFnHttpStatus(401)).toBe(true);
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(401);
  });

  it("leaves the status of a page alone during SSR", () => {
    mockGlobalContext.mockReturnValue({
      cspNonce: "n",
      serverFnHttpCall: false,
    });

    expect(setServerFnHttpStatus(401)).toBe(false);
    expect(doubles.setResponseStatus).not.toHaveBeenCalled();
  });
});

describe("the flag in start.ts", () => {
  async function contextAfterSecurityHeaders(
    handlerType: "serverFn" | "router",
  ): Promise<unknown> {
    const { requestMiddleware } = await startInstance.getOptions();
    const server = requestMiddleware?.[0]?.options.server;
    if (!server) throw new Error("No request middleware");
    let passedOn: unknown;
    await server({
      next: async (nextOptions: { context?: unknown } = {}) => {
        passedOn = nextOptions.context;
        return {};
      },
      handlerType,
      context: {},
      request: new Request("https://lumi.example/"),
      pathname: "/",
    } as never);
    return passedOn;
  }

  it("is Start's own handlerType", async () => {
    expect(await contextAfterSecurityHeaders("serverFn")).toMatchObject({
      serverFnHttpCall: true,
    });
    expect(await contextAfterSecurityHeaders("router")).toMatchObject({
      serverFnHttpCall: false,
    });
  });
});

describe("HttpStatusError", () => {
  it("reaches the browser as a plain Error with the same message", async () => {
    const plugins = [
      makeSerovalPlugin(apiErrorSerializationAdapter),
      ...defaultSerovalPlugins,
    ];

    for (const original of [
      new HttpStatusError(401, "Unauthorized: No token provided"),
      new BadGatewayError("Uventet svar fra analyseprodukt-API-et."),
    ]) {
      const restored = fromCrossJSON<unknown>(
        await toCrossJSONAsync({ error: original }, { plugins }),
        { plugins },
      ) as { error: unknown };

      expect(restored.error).toBeInstanceOf(Error);
      expect(restored.error).not.toBeInstanceOf(HttpStatusError);
      expect(restored.error).not.toBeInstanceOf(ApiErrorException);
      expect(restored.error).toMatchObject({ message: original.message });
      expect(restored.error).not.toHaveProperty("status");
    }
  });
});
