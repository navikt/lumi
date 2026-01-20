import type {
  ApiError,
  FeedbackSubmissionV1,
  SubmissionCreatedResponse,
} from "../contracts/lumiApi";
import { isApiError, isSubmissionCreatedResponse } from "../contracts/lumiApi";

import type { LumiSurveySubmission, LumiSurveyTransport } from "./types";

export interface LumiApiTransportOptions {
  /** Full endpoint URL, e.g. `https://.../api/tokenx/v1/feedback` or `/api/tokenx/v1/feedback`. */
  endpoint?: string;
  /** Base URL if you want to provide `baseUrl` + default path. */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetchFn?: typeof fetch;
  /** Extra headers added to every request. */
  headers?: Record<string, string>;
  /** Optional async header provider (e.g. get token). */
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
}

function resolveEndpoint(options?: LumiApiTransportOptions): string {
  const endpoint = options?.endpoint;
  if (endpoint && endpoint.length > 0) return endpoint;

  const baseUrl = options?.baseUrl;
  if (baseUrl && baseUrl.length > 0) {
    return `${baseUrl.replace(/\/$/, "")}/api/tokenx/v1/feedback`;
  }

  return "/api/tokenx/v1/feedback";
}

async function parseApiError(response: Response): Promise<ApiError | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const json: unknown = await response.json();
    return isApiError(json) ? json : null;
  } catch {
    return null;
  }
}

export async function submitFeedbackToLumiApi(
  submission: FeedbackSubmissionV1,
  options?: LumiApiTransportOptions,
): Promise<SubmissionCreatedResponse> {
  // NOTE: This should be called server-side.
  // Browser clients should submit to their own backend first, which performs token exchange
  // and forwards the request to lumi-api.
  const endpoint = resolveEndpoint(options);
  const fetchFn = options?.fetchFn ?? fetch;

  const headersFromProvider = (await options?.getHeaders?.()) ?? {};
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...options?.headers,
    ...headersFromProvider,
  };

  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(submission),
  });

  if (!response.ok) {
    const apiError = await parseApiError(response);
    if (apiError) {
      throw new Error(
        `Lumi API error ${apiError.status} ${apiError.type}: ${apiError.message}`,
      );
    }

    throw new Error(
      `Lumi API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json: unknown = await response.json();
  if (!isSubmissionCreatedResponse(json)) {
    throw new Error("Lumi API response did not match expected shape");
  }
  return json;
}

/**
 * Convenience transport implementation that submits the widget's canonical payload
 * (`submission.transportPayload`) to the Lumi API.
 */
export function createLumiApiTransport(
  options?: LumiApiTransportOptions,
): LumiSurveyTransport {
  return {
    submit: async (submission: LumiSurveySubmission) => {
      // The widget already builds schemaVersion=1 payload.
      // Submit the payload as a FeedbackSubmissionV1-compatible shape.
      await submitFeedbackToLumiApi(
        submission.transportPayload as unknown as FeedbackSubmissionV1,
        options,
      );
    },
  };
}
