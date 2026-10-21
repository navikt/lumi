import { notFound, redirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "~/server/logger";
import { logServerFnError } from "../serverFnErrors";

vi.mock("~/server/logger", () => ({ logger: { error: vi.fn() } }));

describe("logServerFnError", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it("logs a failure with the server function name", () => {
    const error = new Error("Backend request failed: 500");

    logServerFnError(error, "fetchFeedbackServerFn");

    expect(logger.error).toHaveBeenCalledWith(
      { err: error, serverFn: "fetchFeedbackServerFn" },
      "Server function failed",
    );
  });

  it("ignores redirects and not-found errors", () => {
    logServerFnError(redirect({ to: "/" }), "fetchFeedbackServerFn");
    logServerFnError(notFound(), "fetchFeedbackServerFn");

    expect(logger.error).not.toHaveBeenCalled();
  });
});
