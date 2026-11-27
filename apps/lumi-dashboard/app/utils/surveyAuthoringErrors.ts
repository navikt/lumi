import { ApiErrorException } from "~/types/errors";
import type { SurveyAuthoringProject } from "~/types/surveyAuthoring";
import {
  LUMI_API_READ_TIMEOUT_MESSAGE,
  LUMI_API_WRITE_TIMEOUT_MESSAGE,
  UNREADABLE_WRITE_ANSWER_MESSAGE,
} from "~/utils/apiErrorMessages";
import { ServerFnHttpError } from "~/utils/serverFnFetch";

/**
 * The draft was saved, but not the display choice that was sent with it. A
 * dashboard server from before the choice existed leaves it out, which can
 * happen while a new version is rolled out. `saved` is the draft as the
 * server saved it, so the editor can go on from that version. Sending again
 * is worth a try: the next request can reach a server that keeps the choice.
 */
export class PresentationNotSavedError extends Error {
  readonly saved: SurveyAuthoringProject;

  constructor(saved: SurveyAuthoringProject) {
    super(
      "Visningsvalget ble ikke lagret. Resten av utkastet er lagret. Prøv igjen om litt.",
    );
    this.name = "PresentationNotSavedError";
    this.saved = saved;
  }
}

/**
 * Distinguishes an optimistic-locking conflict from other failures. Both the
 * API ("Draft changed since it was loaded. Reload before saving again.") and
 * the mock ("Draft changed since it was loaded") signal the conflict in the
 * message, the only shape that survives the server-function serialization
 * boundary. It holds for sharing too.
 */
export function isDraftConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Draft changed");
}

/**
 * What a failed save says about the draft on the server.
 *
 * - `conflict`: the server holds a newer draft. Nothing more is saved before
 *   the page is loaded again.
 * - `uncertain`: the draft may be saved, and the answer does not say. Nothing
 *   more is saved before the page is loaded again.
 * - `partial`: the draft is saved, but not its display choice.
 * - `unknown`: the request may have reached the server before the connection
 *   broke, or a gateway or the API failed. The draft is sent again, also when
 *   the author has changed it back. A conflict then says that the server got
 *   it.
 * - `refused`: the server did not save the draft, as when it gets too many
 *   requests.
 * - `rejected`: the server did not save the draft, and would not save it
 *   again as it is.
 *
 * Another try can save the draft after `partial`, `unknown` and `refused`.
 */
export type SaveFailure =
  | "conflict"
  | "uncertain"
  | "partial"
  | "unknown"
  | "refused"
  | "rejected";

// A status is read where a message starts with it, or where the dashboard
// says that a request to Lumi API failed with it. A number elsewhere, as in
// "at most 500 characters", is no status.
const REFUSED_PATTERN = /too many requests|^\s*429\b|request failed: 429\b/i;
const UNKNOWN_PATTERN =
  /fetch failed|failed to fetch|network|load failed|terminated|timeout|timed out|econn|socket|aborted|internal server error|bad gateway|service unavailable|gateway timeout|^\s*5\d\d\b|request failed: 5\d\d\b/i;
const UNCERTAIN_MESSAGES = new Set([
  LUMI_API_WRITE_TIMEOUT_MESSAGE,
  UNREADABLE_WRITE_ANSWER_MESSAGE,
]);

export function saveFailureOf(error: unknown): SaveFailure {
  if (error instanceof PresentationNotSavedError) return "partial";
  if (!(error instanceof Error)) return "rejected";
  if (isDraftConflictError(error)) return "conflict";
  if (UNCERTAIN_MESSAGES.has(error.message)) return "uncertain";
  if (REFUSED_PATTERN.test(error.message)) return "refused";
  if (UNKNOWN_PATTERN.test(error.message)) return "unknown";
  return "rejected";
}

/** Whether another try can save the draft. */
export function isRetryable(failure: SaveFailure): boolean {
  return (
    failure === "partial" || failure === "unknown" || failure === "refused"
  );
}

const DRAFT_UNAVAILABLE_STATUSES = new Set([401, 403, 404]);
// The dashboard's own login check and the mock store for a deleted draft
// fail with these messages.
const DRAFT_UNAVAILABLE_PATTERN = /^Unauthorized\b|^Survey project not found$/;

/**
 * Whether a failed fetch says that the viewer can no longer see the draft:
 * it is deleted, or the login or the access has ended. A draft fetched
 * before must then not be shown any more.
 */
export function isDraftUnavailableError(error: unknown): boolean {
  if (error instanceof ApiErrorException) {
    return DRAFT_UNAVAILABLE_STATUSES.has(error.error.status);
  }
  return (
    error instanceof Error && DRAFT_UNAVAILABLE_PATTERN.test(error.message)
  );
}

/**
 * Whether a failed fetch can pass by itself: the network, a timeout, a server
 * error or too many requests. Any other failure, such as a refusal with
 * plain text or an unreadable answer, says nothing about whether the viewer
 * may still see a draft fetched before. A known status decides over the text.
 */
export function isTransientFetchError(error: unknown): boolean {
  if (error instanceof ApiErrorException) {
    return isTransientStatus(error.error.status);
  }
  if (error instanceof ServerFnHttpError) {
    return isTransientStatus(error.status);
  }
  return (
    error instanceof Error &&
    (error.message === LUMI_API_READ_TIMEOUT_MESSAGE ||
      UNKNOWN_PATTERN.test(error.message) ||
      REFUSED_PATTERN.test(error.message))
  );
}

function isTransientStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}
