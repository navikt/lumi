/**
 * Error a transport can throw when the app's backend answers with an HTTP
 * error. The status lets the widget try once more by itself when Lumi API is
 * briefly unavailable (429 or 503).
 *
 * @example
 * ```ts
 * if (!response.ok) {
 *   throw LumiSurveyHttpError.fromResponse(response);
 * }
 * ```
 */
export class LumiSurveyHttpError extends Error {
  readonly status: number;
  /** Seconds to wait from a valid `Retry-After` header, if the response had one. */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    options: { retryAfter?: string | null; message?: string } = {},
  ) {
    super(options.message ?? `Lumi: Submission failed with status ${status}`);
    this.name = "LumiSurveyHttpError";
    this.status = status;
    this.retryAfterSeconds = parseRetryAfter(options.retryAfter);
  }

  static fromResponse(
    response: Pick<Response, "status" | "headers">,
  ): LumiSurveyHttpError {
    return new LumiSurveyHttpError(response.status, {
      retryAfter: response.headers.get("Retry-After"),
    });
  }
}

/**
 * Reads `Retry-After` as delay seconds or as an HTTP date. Returns undefined
 * for a missing or invalid value.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  // HTTP dates end in GMT. Date.parse alone accepts values such as "-1".
  if (!/ GMT$/.test(trimmed)) return undefined;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}
