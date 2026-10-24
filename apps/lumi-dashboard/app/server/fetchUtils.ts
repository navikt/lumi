import type { z } from "zod";

import { logger } from "~/server/logger";
import { BadGatewayError } from "~/server/serverFnStatus";
import { ApiErrorException, ApiErrorSchema, ErrorType } from "~/types/errors";

const ERROR_TYPES = new Set<unknown>(Object.values(ErrorType));

/**
 * Handle API response and throw typed exceptions for errors.
 * Parses the backend's standard ApiError JSON structure. Any other error
 * answer gives a BadGatewayError (502).
 */
export async function handleApiResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const failure = `Backend request failed: ${response.status} ${response.statusText}`;
  let errorData: unknown;
  try {
    errorData = await response.json();
  } catch {
    throw new BadGatewayError(failure);
  }

  const parsedError = ApiErrorSchema.safeParse(errorData);
  if (parsedError.success) {
    throw new ApiErrorException(parsedError.data);
  }

  // JSON without Lumi API's error format. The body can contain user data, so
  // only the status and a known error type are logged, as a warning:
  // serverFnFailureMiddleware logs the failure itself.
  const type =
    typeof errorData === "object" && errorData !== null && "type" in errorData
      ? errorData.type
      : undefined;
  logger.warn(
    {
      status: response.status,
      errorType: ERROR_TYPES.has(type) ? type : undefined,
    },
    "Backend error (unknown format)",
  );
  throw new BadGatewayError(failure);
}

/**
 * Parses an answer from Lumi API. An answer that breaks the contract is a
 * failure in Lumi API, so it gives 502 and is not mistaken for invalid input.
 * The message is zod's, as with schema.parse(), so the page shows the same.
 */
export function parseApiAnswer<S extends z.ZodType>(
  schema: S,
  answer: unknown,
): z.output<S> {
  const result = schema.safeParse(answer);
  if (!result.success) throw new BadGatewayError(result.error.message);
  return result.data;
}
