import { describe, expect, it } from "vitest";

import {
  BROWSER_APM_APP,
  BROWSER_APM_NAMESPACE,
  BROWSER_SESSION_SAMPLING_RATE,
  createBrowserApmOptions,
  isBrowserObservabilityHost,
  normalizeBrowserPath,
  normalizeBrowserUrl,
  sanitizeBrowserTelemetry,
  UNKNOWN_PAGE_ID,
} from "~/observability/browser";

const SENTINEL = "SURVEY_SENTINEL_NEVER_EXPORT";

function sanitize(
  type: string,
  payload: Record<string, unknown>,
  meta: Record<string, unknown> = {},
) {
  return sanitizeBrowserTelemetry({ type, payload, meta } as never) as Record<
    string,
    unknown
  > | null;
}

describe("browser observability contract", () => {
  it.each([
    ["/", "/"],
    ["/feedback?search=secret#result", "/feedback"],
    ["/export/", "/export"],
    ["/survey-preview", "/survey-preview"],
    ["/release-verification", "/release-verification"],
    ["/surveyverksted", "/surveyverksted"],
    ["/surveyverksted/project-123", "/surveyverksted/{projectId}"],
    [
      "/surveyverksted/revisions/revision-456?answer=secret",
      "/surveyverksted/revisions/{revisionId}",
    ],
    ["/api/feedback", UNKNOWN_PAGE_ID],
    ["/not-a-lumi-route", UNKNOWN_PAGE_ID],
  ])("normalizes %s to the finite route id %s", (input, expected) => {
    expect(normalizeBrowserPath(input)).toBe(expected);
  });

  it("removes credentials, query values, fragments and dynamic ids from URLs", () => {
    expect(
      normalizeBrowserUrl(
        "https://user:password@lumi-dashboard.ansatt.nav.no/surveyverksted/project-123?answer=secret#field",
      ),
    ).toBe("https://lumi-dashboard.ansatt.nav.no/surveyverksted/{projectId}");
  });

  it("enables only the two authenticated Lumi dashboard hosts", () => {
    expect(isBrowserObservabilityHost("lumi-dashboard.ansatt.dev.nav.no")).toBe(
      true,
    );
    expect(isBrowserObservabilityHost("LUMI-DASHBOARD.ANSATT.NAV.NO")).toBe(
      true,
    );
    expect(
      isBrowserObservabilityHost("lumi-dashboard-demo.ekstern.dev.nav.no"),
    ).toBe(false);
    expect(isBrowserObservabilityHost("localhost")).toBe(false);
    expect(
      isBrowserObservabilityHost("lumi-dashboard.ansatt.nav.no.evil.test"),
    ).toBe(false);
  });

  it("uses the agreed identity, sampling and privacy settings", () => {
    const options = createBrowserApmOptions();

    expect(options.app).toBe(BROWSER_APM_APP);
    expect(options.namespace).toBe(BROWSER_APM_NAMESPACE);
    expect(options.dangerouslyDisablePiiScrubbing).toBe(false);
    expect(options.faro?.sessionTracking?.samplingRate).toBe(
      BROWSER_SESSION_SAMPLING_RATE,
    );
    expect(options.tracing).toBe(false);
    expect(options.sessionReplay).toEqual({ enabled: false });
    expect(options.screenshotOnError).toBe(false);
    const instrumentationNames =
      options.faro?.instrumentations?.map(({ name }) => name) ?? [];
    expect(
      instrumentationNames.filter((name) => name.includes("console")),
    ).toEqual([]);
  });

  it("drops logs, traces and custom events", () => {
    expect(sanitize("log", { message: SENTINEL })).toBeNull();
    expect(sanitize("trace", { name: SENTINEL })).toBeNull();
    expect(
      sanitize("event", { name: "lumi.custom", answer: SENTINEL }),
    ).toBeNull();
    expect(
      sanitize("measurement", {
        type: "lumi-survey-score",
        values: { score: 5 },
      }),
    ).toBeNull();
  });

  it("keeps route changes but strips arbitrary attributes and sensitive URLs", () => {
    const result = sanitize("event", {
      name: "route_change",
      timestamp: "2026-08-30T10:00:00.000Z",
      attributes: {
        fromUrl: `/feedback?search=${SENTINEL}`,
        toRoute: "/surveyverksted/project-123",
        toUrl: `https://lumi-dashboard.ansatt.nav.no/surveyverksted/project-123?answer=${SENTINEL}`,
        answer: SENTINEL,
      },
    });

    expect(result).toMatchObject({
      payload: {
        name: "route_change",
        attributes: {
          fromUrl: "/feedback",
          toRoute: "/surveyverksted/{projectId}",
          toUrl: "/surveyverksted/{projectId}",
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
    expect(JSON.stringify(result)).not.toContain("project-123");
  });

  it("genericizes exception data and removes user, page and session attributes", () => {
    const result = sanitize(
      "exception",
      {
        type: "TypeError",
        value: SENTINEL,
        context: { answer: SENTINEL },
        action: { name: SENTINEL },
        timestamp: "2026-08-30T10:00:00.000Z",
        stacktrace: {
          frames: [
            {
              filename: `https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/app-123.js?answer=${SENTINEL}`,
              function: "renderDashboard",
              lineno: 42,
              colno: 7,
            },
          ],
        },
      },
      {
        user: { id: "A123456", email: SENTINEL },
        page: {
          id: "/surveyverksted/project-123",
          url: `https://lumi-dashboard.ansatt.nav.no/surveyverksted/project-123?answer=${SENTINEL}`,
          attributes: { answer: SENTINEL },
        },
        session: { id: "Abcdef1234", attributes: { answer: SENTINEL } },
      },
    );

    expect(result).toMatchObject({
      payload: {
        type: "TypeError",
        value: "Unexpected browser error",
        stacktrace: {
          frames: [
            {
              filename:
                "https://cdn.nav.no/team-esyfo/lumi-dashboard/client/assets/app-123.js",
              function: "renderDashboard",
              lineno: 42,
              colno: 7,
            },
          ],
        },
      },
      meta: {
        page: {
          id: "/surveyverksted/{projectId}",
          url: "https://lumi-dashboard.ansatt.nav.no/surveyverksted/{projectId}",
        },
        session: { id: "Abcdef1234" },
      },
    });
    expect((result?.meta as Record<string, unknown>).user).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
    expect(JSON.stringify(result)).not.toContain("project-123");
  });

  it("keeps a synthetic canary recognizable without exporting canary data", () => {
    const result = sanitize(
      "exception",
      {
        type: "Error",
        value: "Lumi browser observability canary",
        context: { canaryData: SENTINEL },
        timestamp: "2026-08-30T10:00:00.000Z",
      },
      {
        page: {
          id: "/feedback",
          url: `https://lumi-dashboard.ansatt.dev.nav.no/feedback?canary=${SENTINEL}`,
        },
      },
    );

    expect(result).toMatchObject({
      payload: { value: "Lumi browser observability canary" },
      meta: {
        page: {
          id: "/feedback",
          url: "https://lumi-dashboard.ansatt.dev.nav.no/feedback",
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it("keeps numeric browser measurements without contexts", () => {
    const result = sanitize("measurement", {
      type: "web-vitals",
      values: { lcp: 123.4, answer: SENTINEL },
      context: {
        rating: "good",
        navigation_type: "reload",
        element: SENTINEL,
        interaction_target: SENTINEL,
      },
      timestamp: "2026-08-30T10:00:00.000Z",
    });

    expect(result).toMatchObject({
      payload: {
        type: "web-vitals",
        values: { lcp: 123.4 },
        context: { rating: "good", navigation_type: "reload" },
      },
    });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });
});
