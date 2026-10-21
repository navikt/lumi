import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiErrorException } from "~/types/errors";
import {
  analysisRequest,
  mutateAnalysis,
  readAnalysis,
} from "../analysisProductApi";

vi.mock("~/publicEnv", () => ({ publicEnv: { VITE_MOCK_DATA: "false" } }));
vi.mock("~/serverEnv", () => ({ serverEnv: {} }));

afterEach(() => vi.unstubAllGlobals());

describe("analysis API transport", () => {
  it("uses the existing delegated token and explicit team query", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const body = {
      draftId: "draft",
      draftRevision: 3,
      document: { name: "Test" },
    };
    await analysisRequest(
      {
        backendUrl: "https://backend.example",
        oboToken: "test-delegated-token",
      },
      "team-test",
      "/product/draft",
      "PUT",
      body,
    );
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://backend.example/api/v1/intern/analysis-products/product/draft?team=team-test",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-delegated-token",
        },
        body: JSON.stringify(body),
      },
    );
  });

  it.each([
    [400, "invalid-input"],
    [413, "too-large"],
    [409, "conflict"],
    [422, "blocked"],
    [429, "limit"],
    [403, "unavailable"],
    [404, "unavailable"],
  ])("classifies definitive HTTP %i without exposing backend content", async (status, reason) => {
    expect(
      await mutateAnalysis(
        Response.json(
          { error: "private backend detail" },
          { status: Number(status) },
        ),
        z.object({}),
      ),
    ).toEqual({ ok: false, reason });
  });

  it("distinguishes a closed draft from an optimistic concurrency conflict", async () => {
    expect(
      await mutateAnalysis(
        Response.json(
          { error: "ANALYSIS_PRODUCT_NOT_EDITABLE" },
          { status: 409 },
        ),
        z.object({}),
      ),
    ).toEqual({ ok: false, reason: "not-editable" });
  });

  it("handles a conflict without a JSON body", async () => {
    expect(
      await mutateAnalysis(
        new Response("gateway", { status: 409 }),
        z.object({}),
      ),
    ).toEqual({ ok: false, reason: "conflict" });
  });

  it("treats server errors and malformed successes as unconfirmed writes", async () => {
    await expect(
      mutateAnalysis(
        new Response("private backend detail", { status: 500 }),
        z.object({}),
      ),
    ).rejects.toThrow("Kunne ikke bekrefte om endringen ble lagret.");
    await expect(
      mutateAnalysis(
        Response.json({ unexpected: true }),
        z.object({ id: z.string() }),
      ),
    ).rejects.toThrow("Uventet svar fra analyseprodukt-API-et.");
  });

  it("keeps a database that does not answer as an API error", async () => {
    const payload = {
      status: 503,
      type: "DATABASE_UNAVAILABLE",
      message: "Databasen svarer ikke akkurat nå",
      timestamp: "2026-10-20T08:00:00Z",
    };

    const error = await readAnalysis(
      Response.json(payload, { status: 503 }),
      z.object({}),
    ).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiErrorException);
    expect(error).toMatchObject({ error: payload });
  });

  it("gives other failed reads the general message", async () => {
    await expect(
      readAnalysis(new Response("boom", { status: 500 }), z.object({})),
    ).rejects.toThrow(
      "Analyseproduktet kunne ikke hentes. Kontroller team og prøv igjen.",
    );
  });

  it("validates responses and strips fields not used by the dashboard", async () => {
    expect(
      await readAnalysis(
        Response.json({ id: "test", actor: "private" }),
        z.object({ id: z.string() }),
      ),
    ).toEqual({ id: "test" });
    await expect(
      readAnalysis(
        new Response("private backend detail", { status: 403 }),
        z.object({}),
      ),
    ).rejects.toThrow("Kontroller team");
  });
});
