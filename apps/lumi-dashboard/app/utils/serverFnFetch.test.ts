import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchKeepingStatus, ServerFnHttpError } from "~/utils/serverFnFetch";

const SERVER_FN_URL = "/_serverFn/fetchSurveyAuthoringProjectServerFn";

function answer(status: number, headers: Record<string, string>, body = "") {
  return new Response(body, { status, headers });
}

describe("fetchKeepingStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "the dashboard's CSRF refusal",
      answer(403, { "content-type": "text/plain" }, "Forbidden"),
      403,
    ],
    [
      "an error page from a proxy",
      answer(502, { "content-type": "text/html" }, "<h1>Bad Gateway</h1>"),
      502,
    ],
  ])("keeps the status of %s", async (_case, response, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const failure = await fetchKeepingStatus(SERVER_FN_URL).catch(
      (error) => error,
    );

    expect(failure).toBeInstanceOf(ServerFnHttpError);
    expect(failure.status).toBe(status);
  });

  it("keeps the status without waiting for the body of a refusal", async () => {
    const bodyThatNeverEnds = new ReadableStream({ start() {} });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(bodyThatNeverEnds, {
          status: 403,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );
    const stillWaiting = new Promise((resolve) =>
      setTimeout(resolve, 50, "still waiting for the body"),
    );

    await expect(
      Promise.race([fetchKeepingStatus(SERVER_FN_URL), stillWaiting]),
    ).rejects.toMatchObject({ name: "ServerFnHttpError", status: 403 });
  });

  it.each([
    ["a success", answer(200, { "content-type": "application/json" })],
    [
      "an error the server function threw",
      answer(500, {
        "content-type": "application/json",
        "x-tss-serialized": "true",
      }),
    ],
    [
      "a Response the server function threw",
      answer(403, { "content-type": "text/plain", "x-tss-raw": "thrown" }),
    ],
    [
      "JSON that Start reads",
      answer(404, { "content-type": "application/json" }),
    ],
  ])("passes on %s to Start", async (_case, response) => {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetch);
    const init = { method: "GET" };

    await expect(fetchKeepingStatus(SERVER_FN_URL, init)).resolves.toBe(
      response,
    );
    expect(fetch).toHaveBeenCalledWith(SERVER_FN_URL, init);
  });
});
