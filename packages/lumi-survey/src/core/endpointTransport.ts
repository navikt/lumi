import { LumiSurveyHttpError } from "./httpError.js";
import type { LumiSurveyEndpoint, LumiSurveyTransport } from "./types";

const DOCS_URL =
  "https://navikt.github.io/lumi/kom-i-gang/konfigurer-survey#send-svarene";

export type EndpointResolution =
  | { ok: true; url: string }
  | { ok: false; problem: string };

/**
 * True when `transport` is the plain `{ endpoint }` form rather than an object
 * with its own `submit`. A `submit` function always wins.
 */
export function isEndpointTransport(
  transport: LumiSurveyTransport | LumiSurveyEndpoint | undefined | null,
): transport is LumiSurveyEndpoint {
  return (
    typeof transport === "object" &&
    transport !== null &&
    typeof (transport as Partial<LumiSurveyTransport>).submit !== "function"
  );
}

/**
 * Checks that `endpoint` is a path or URL on the page's own origin. The
 * payload contains free text and context, so it must never go to another
 * origin, for example a cluster-internal Lumi API address from config.
 * During server rendering only the form of the value is checked.
 */
export function resolveEndpoint(endpoint: unknown): EndpointResolution {
  if (typeof endpoint !== "string" || endpoint.trim() === "") {
    return {
      ok: false,
      problem: `endpoint must be a non-empty string, got ${JSON.stringify(endpoint)}`,
    };
  }

  const value = endpoint.trim();
  const isRootPath = value.startsWith("/") && !value.startsWith("//");
  const isAbsoluteUrl = /^https?:\/\//i.test(value);
  if (!isRootPath && !isAbsoluteUrl) {
    return {
      ok: false,
      problem: `endpoint must start with "/" or be a URL on the same origin, got "${value}"`,
    };
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: true, url: value };
  }

  let url: URL;
  try {
    url = new URL(value, document.baseURI);
  } catch {
    return { ok: false, problem: `endpoint "${value}" is not a valid URL` };
  }
  if (url.origin !== window.location.origin) {
    return {
      ok: false,
      problem: `endpoint "${value}" is on ${url.origin}, not on the page's own origin ${window.location.origin}. Send the answers to the app's own backend, which forwards them to Lumi API.`,
    };
  }

  return { ok: true, url: url.href };
}

/** Error message for a dock without a usable transport. */
export function describeMissingTransport(problem: string): string {
  return `[Lumi] The survey is not shown: ${problem}. See ${DOCS_URL}`;
}

/**
 * The transport behind `transport={{ endpoint }}`. It POSTs the transport
 * payload as JSON to the app's own backend and treats only a real 2xx answer
 * from that backend as success.
 */
export function createEndpointTransport(url: string): LumiSurveyTransport {
  return {
    async submit({ transportPayload }, options) {
      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transportPayload),
        signal: options?.signal ?? null,
        credentials: "same-origin",
        mode: "same-origin",
        // A followed redirect, for example to a login page, could end in a
        // 200 page and show the receipt while the answers are lost.
        redirect: "manual",
      });

      if (response.type === "opaqueredirect") {
        throw failure(
          new LumiSurveyHttpError(0, {
            message:
              "Lumi: The endpoint redirected instead of answering. The login may have expired, or the path is missing the app's base path.",
          }),
          url,
        );
      }
      if (!response.ok) {
        throw failure(LumiSurveyHttpError.fromResponse(response), url);
      }
      if ((response.headers.get("Content-Type") ?? "").includes("text/html")) {
        throw failure(
          new LumiSurveyHttpError(response.status, {
            message:
              "Lumi: The endpoint answered with a web page, not the backend route. Check the path and the base path.",
          }),
          url,
        );
      }
    },
  };
}

function failure(error: LumiSurveyHttpError, url: string): LumiSurveyHttpError {
  // One line per failed attempt helps teams find the cause without the
  // payload, which may contain personal data, ever reaching the console.
  console.error(
    `[Lumi] Sending the survey to ${url} failed with status ${error.status}: ${error.message}`,
  );
  return error;
}
