import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEndpointTransport,
  describeTransportShape,
  isEndpointTransport,
  resolveEndpoint,
} from "../endpointTransport.js";
import { LumiSurveyHttpError } from "../httpError.js";
import type { LumiSurveySubmission } from "../types.js";

const submission = {
  surveyId: "survey-1",
  answers: {},
  startedAt: "2026-10-20T12:00:00Z",
  submittedAt: "2026-10-20T12:01:00Z",
  transportPayload: { schemaVersion: 2, deduplicationKey: "key-1" },
} as unknown as LumiSurveySubmission;

describe("isEndpointTransport", () => {
  it("lets a submit function win over endpoint", () => {
    expect(isEndpointTransport({ endpoint: "/api" })).toBe(true);
    expect(
      isEndpointTransport({
        endpoint: "/api",
        submit: async () => {},
      } as never),
    ).toBe(false);
    expect(isEndpointTransport({ submit: async () => {} })).toBe(false);
    expect(isEndpointTransport(undefined)).toBe(false);
  });
});

describe("describeTransportShape", () => {
  it("accepts both forms", () => {
    expect(describeTransportShape({ endpoint: "/api" })).toBeUndefined();
    expect(describeTransportShape({ submit: async () => {} })).toBeUndefined();
  });

  it.each([
    ["a missing transport", undefined, "transport is missing"],
    ["a string", "/api/lumi/feedback", "got a string"],
    ["a function", async () => {}, "got a function"],
  ])("rejects %s", (_name, transport, problem) => {
    expect(describeTransportShape(transport)).toContain(problem);
  });
});

describe("resolveEndpoint", () => {
  it("accepts a path or a URL on the page's own origin", () => {
    expect(resolveEndpoint("/api/lumi/feedback")).toEqual({
      ok: true,
      url: `${window.location.origin}/api/lumi/feedback`,
    });
    expect(resolveEndpoint(`${window.location.origin}/api/lumi`)).toEqual({
      ok: true,
      url: `${window.location.origin}/api/lumi`,
    });
  });

  it.each([
    ["an empty string", ""],
    ["a missing value", undefined],
    ["a value from a missing environment variable", "undefined/api/lumi"],
    ["a path relative to the page", "api/lumi/feedback"],
    ["a protocol-relative URL", "//evil.example/api"],
    // These pass the form check, and the URL parser turns them into
    // protocol-relative URLs, so only the origin check stops them.
    ["a backslash after the slash", "/\\evil.example/api"],
    ["a tab between the slashes", "/\t/evil.example/api"],
    ["another origin", "https://lumi-api.example/api/v1/feedback"],
    ["a cluster-internal address", "http://lumi-api.team-esyfo/api"],
  ])("rejects %s", (_name, endpoint) => {
    expect(resolveEndpoint(endpoint)).toMatchObject({ ok: false });
  });
});

describe("createEndpointTransport", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the transport payload as JSON to the same origin only", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    const signal = new AbortController().signal;

    await createEndpointTransport("/api/lumi/feedback").submit(submission, {
      signal,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/lumi/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission.transportPayload),
      signal,
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "manual",
    });
  });

  it("throws a LumiSurveyHttpError with Retry-After for an error status", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 503, headers: { "Retry-After": "1" } }),
    );

    const error = await createEndpointTransport("/api")
      .submit(submission)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(LumiSurveyHttpError);
    expect(error).toMatchObject({ status: 503, retryAfterSeconds: 1 });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("status 503"),
    );
  });

  it("treats a redirect as a failure, so a login page never shows the receipt", async () => {
    const redirect = new Response(null, { status: 200 });
    Object.defineProperty(redirect, "type", { value: "opaqueredirect" });
    fetchMock.mockResolvedValue(redirect);

    await expect(
      createEndpointTransport("/api").submit(submission),
    ).rejects.toMatchObject({ status: 0 });
  });

  it("treats a web page answered with 200 as a failure", async () => {
    fetchMock.mockResolvedValue(
      new Response("<!doctype html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );

    await expect(
      createEndpointTransport("/api").submit(submission),
    ).rejects.toMatchObject({ status: 200 });
  });

  it("reads the content type without regard to case", async () => {
    fetchMock.mockResolvedValue(
      new Response("<!doctype html>", {
        status: 200,
        headers: { "Content-Type": "Text/HTML" },
      }),
    );

    await expect(
      createEndpointTransport("/api").submit(submission),
    ).rejects.toMatchObject({ status: 200 });
  });

  it("accepts a JSON answer", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "submission-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createEndpointTransport("/api").submit(submission),
    ).resolves.toBeUndefined();
  });

  it("never logs the payload", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));

    await createEndpointTransport("/api")
      .submit(submission)
      .catch(() => {});

    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain("key-1");
  });
});
