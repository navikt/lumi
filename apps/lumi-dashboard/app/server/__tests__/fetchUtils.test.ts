import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "~/server/logger";
import { BadGatewayError } from "~/server/serverFnStatus";
import { ApiErrorException } from "~/types/errors";
import { QuestionTrendResponseSchema } from "~/types/schemas";
import { handleApiResponse, parseApiAnswer } from "../fetchUtils";

vi.mock("~/server/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

const mockLogger = vi.mocked(logger);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleApiResponse", () => {
  it.each([409, 400])(
    "preserves a backend %i error with explicit null optional fields",
    async (status) => {
      const payload = {
        status,
        type: status === 409 ? "CONFLICT" : "BAD_REQUEST",
        message:
          "Draft changed since it was validated. Wait for save and try again.",
        timestamp: "2026-09-07T09:21:12.745781343Z",
        path: "/api/v1/intern/authoring/projects/project-id/revisions",
        details: null,
        helpUrl: null,
      };
      const error = await handleApiResponse(
        Response.json(payload, { status }),
      ).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ApiErrorException);
      expect(error).toMatchObject({ message: payload.message, error: payload });
    },
  );

  it("keeps the type when the database does not answer", async () => {
    const payload = {
      status: 503,
      type: "DATABASE_UNAVAILABLE",
      message: "Databasen svarer ikke akkurat nå",
      timestamp: "2026-10-20T08:00:00Z",
      details: "Dette er som regel midlertidig. Prøv igjen om litt.",
    };
    await expect(
      handleApiResponse(Response.json(payload, { status: 503 })),
    ).rejects.toMatchObject({ error: payload });
  });

  it("accepts absent optional fields and a null path", async () => {
    const payload = {
      status: 409,
      type: "CONFLICT",
      message: "Draft changed since it was loaded",
      timestamp: "2026-09-07T09:21:12Z",
      path: null,
    };
    await expect(
      handleApiResponse(Response.json(payload, { status: 409 })),
    ).rejects.toMatchObject({ message: payload.message, error: payload });
  });

  it("retains the fallback for malformed error responses", async () => {
    await expect(
      handleApiResponse(
        Response.json(
          { message: "Unknown" },
          { status: 409, statusText: "Conflict" },
        ),
      ),
    ).rejects.toThrow("Backend request failed: 409 Conflict");
  });

  it("gives 502 for an error answer without Lumi API's format", async () => {
    for (const response of [
      Response.json({ message: "Unknown" }, { status: 500 }),
      new Response("<html>Bad gateway</html>", { status: 502 }),
    ]) {
      await expect(handleApiResponse(response)).rejects.toBeInstanceOf(
        BadGatewayError,
      );
    }
  });

  it("logs only the status and a known error type, not the body", async () => {
    await handleApiResponse(
      Response.json(
        { type: "CONFLICT", message: "Svaret fra Ola Nordmann, 12345678901" },
        { status: 409, statusText: "Conflict" },
      ),
    ).catch(() => undefined);
    await handleApiResponse(
      Response.json(
        { type: "Ola Nordmann", details: "12345678901" },
        { status: 500 },
      ),
    ).catch(() => undefined);

    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      1,
      { status: 409, errorType: "CONFLICT" },
      "Backend error (unknown format)",
    );
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      2,
      { status: 500, errorType: undefined },
      "Backend error (unknown format)",
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});

describe("parseApiAnswer", () => {
  const answer = {
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
        responseCount: 7,
        distribution: {},
      },
    ],
  };

  it("returns an answer that keeps the contract", () => {
    expect(parseApiAnswer(QuestionTrendResponseSchema, answer)).toMatchObject({
      fieldId: "q1",
      buckets: [{ responseCount: 7 }],
    });
  });

  it("throws BadGatewayError with zod's message for an answer that breaks it", () => {
    const broken = {
      ...answer,
      buckets: [{ ...answer.buckets[0], responseCount: null }],
    };
    let parseError: unknown;
    try {
      QuestionTrendResponseSchema.parse(broken);
    } catch (caught) {
      parseError = caught;
    }
    let error: unknown;
    try {
      parseApiAnswer(QuestionTrendResponseSchema, broken);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadGatewayError);
    expect((error as Error).message).toBe((parseError as Error).message);
    expect((error as Error).message).toContain(
      "unmasked buckets require responseCount",
    );
  });
});
