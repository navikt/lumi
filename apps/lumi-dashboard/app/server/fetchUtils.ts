import { logger } from "~/server/logger";
import { ApiErrorException, ApiErrorSchema } from "~/types/errors";

/**
 * Handle API response and throw typed exceptions for errors.
 * Parses the backend's standard ApiError JSON structure.
 */
export async function handleApiResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  // Attempt to parse JSON error response
  try {
    const errorData = await response.json();

    // Check if it matches the ApiError shape using Zod
    const parsedError = ApiErrorSchema.safeParse(errorData);

    if (parsedError.success) {
      throw new ApiErrorException(parsedError.data);
    }

    // Fallback if JSON but not ApiError shape
    logger.error({ msg: "Backend error (unknown format)", data: errorData });
    throw new Error(
      `Backend request failed: ${response.status} ${response.statusText}`,
    );
  } catch (e) {
    if (e instanceof ApiErrorException) {
      throw e;
    }

    // Failed to parse JSON or other error
    throw new Error(
      `Backend request failed: ${response.status} ${response.statusText}`,
    );
  }
}
