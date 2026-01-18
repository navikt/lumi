import type {
  ApiError,
  FeedbackSubmissionV1,
  SubmissionCreatedResponse,
} from "@navikt/lumi-types";
import {
  ApiErrorSchema,
  FeedbackSubmissionV1Schema,
  SubmissionCreatedResponseSchema,
} from "@navikt/lumi-types";

import type { LumiSurveySubmission, LumiSurveyTransport } from "./types";

export interface LumiApiTransportOptions {
  /** Full endpoint URL, e.g. `https://.../api/v1/feedback` or `/api/v1/feedback`. */
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
    return `${baseUrl.replace(/\/$/, "")}/api/v1/feedback`;
  }

  return "/api/v1/feedback";
}

async function parseApiError(response: Response): Promise<ApiError | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const json: unknown = await response.json();
    const parsed = ApiErrorSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function submitFeedbackToLumiApi(
  submission: FeedbackSubmissionV1,
  options?: LumiApiTransportOptions,
): Promise<SubmissionCreatedResponse> {
  const endpoint = resolveEndpoint(options);
  const fetchFn = options?.fetchFn ?? fetch;

  const headersFromProvider = (await options?.getHeaders?.()) ?? {};
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...options?.headers,
    ...headersFromProvider,
  };

  const strictSubmission = FeedbackSubmissionV1Schema.parse(submission);

  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(strictSubmission),
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
  return SubmissionCreatedResponseSchema.parse(json);
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
      // Validate it against the shared contract before sending.
      await submitFeedbackToLumiApi(
        submission.transportPayload as unknown as FeedbackSubmissionV1,
        options,
      );
    },
  };
}
