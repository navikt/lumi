import { describe, expect, it, vi } from "vitest";
import { ApiErrorException } from "~/types/errors";
import { handleApiResponse } from "../fetchUtils";

vi.mock("~/server/logger", () => ({ logger: { error: vi.fn() } }));

describe("handleApiResponse", () => {
  it.each([
    409, 400,
  ])("preserves a backend %i error with explicit null optional fields", async (status) => {
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
});
