// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LUMI_API_LONG_TIMEOUT_MS,
  LUMI_API_TIMEOUT_MS,
  LumiApiTimeoutError,
  lumiApiFetch,
} from "~/server/lumiApiFetch";
import { serverFnFailureStatus } from "~/server/serverFnStatus";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lumi API deadlines", () => {
  it("preserves the request, error status, headers and body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "not allowed" }, { status: 403 }),
      );
    vi.stubGlobal("fetch", fetch);
    const timeout = vi.spyOn(AbortSignal, "timeout");

    const response = await lumiApiFetch("https://backend.example/feedback", {
      method: "POST",
      headers: { Authorization: "Bearer delegated" },
      body: '{"team":"team-test"}',
    });

    expect(timeout).toHaveBeenCalledExactlyOnceWith(LUMI_API_TIMEOUT_MS);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://backend.example/feedback",
      {
        method: "POST",
        headers: { Authorization: "Bearer delegated" },
        body: '{"team":"team-test"}',
        signal: expect.any(AbortSignal),
      },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ message: "not allowed" });
  });

  it("aborts a request that never returns headers and reports 504", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetch = vi.fn((_input: unknown, init: RequestInit) => {
      requestSignal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () =>
          reject(requestSignal?.reason),
        );
      });
    });
    vi.stubGlobal("fetch", fetch);

    const error = await lumiApiFetch(
      "https://backend.example/?query=private",
      { headers: { Authorization: "Bearer secret" } },
      20,
    ).catch((error: unknown) => error);

    expect(requestSignal?.aborted).toBe(true);
    expect(error).toBeInstanceOf(LumiApiTimeoutError);
    expect(serverFnFailureStatus(error)).toBe(504);
    expect(String(error)).not.toMatch(/private|secret|backend\.example/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("also aborts when headers arrive but the body stops arriving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"partial":'));
                signal.addEventListener("abort", () =>
                  controller.error(signal.reason),
                );
              },
            }),
          ),
        );
      }),
    );

    await expect(
      lumiApiFetch("https://backend.example/stats", {}, 20),
    ).rejects.toBeInstanceOf(LumiApiTimeoutError);
  });

  it("allows a longer deadline for a download and keeps its bytes and headers", async () => {
    const bytes = new Uint8Array([0, 255, 42, 128]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(bytes, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": 'attachment; filename="lumi.xlsx"',
            "X-Lumi-Export-Total": "123",
          },
        }),
      ),
    );
    const timeout = vi.spyOn(AbortSignal, "timeout");

    const response = await lumiApiFetch(
      "https://backend.example/export",
      {},
      LUMI_API_LONG_TIMEOUT_MS,
    );

    expect(timeout).toHaveBeenCalledExactlyOnceWith(LUMI_API_LONG_TIMEOUT_MS);
    expect(response.headers.get("X-Lumi-Export-Total")).toBe("123");
    expect(response.headers.get("Content-Disposition")).toContain("lumi.xlsx");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("preserves a successful response without a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const response = await lumiApiFetch("https://backend.example/feedback", {
      method: "DELETE",
    });
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it("preserves caller cancellation instead of calling it an API timeout", async () => {
    const caller = new AbortController();
    const reason = new Error("request cancelled");
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init: RequestInit) => {
        requestSignal = init.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () =>
            reject(requestSignal?.reason),
          );
        });
      }),
    );

    const response = lumiApiFetch("https://backend.example/stats", {
      signal: caller.signal,
    });
    caller.abort(reason);

    await expect(response).rejects.toBe(reason);
    expect(requestSignal?.aborted).toBe(true);
  });

  it("preserves network failures", async () => {
    const error = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(lumiApiFetch("https://backend.example")).rejects.toBe(error);
  });

  it("warns that a timed-out write may already have been saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        });
      }),
    );

    await expect(
      lumiApiFetch("https://backend.example/markers", { method: "POST" }, 20),
    ).rejects.toMatchObject({
      name: "LumiApiTimeoutError",
      status: 504,
      message: expect.stringContaining("Endringen kan ha blitt lagret"),
    });
  });
});
