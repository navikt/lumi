import {
  focusManager,
  onlineManager,
  type QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analysisBudgetError } from "~/mock/analysisBudget";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { createDashboardQueryClient } from "../queryClient";
import { shouldRetryQuery } from "../queryRetry";

describe("createDashboardQueryClient", () => {
  it("uses the shared retry rule for every query", () => {
    const queryClient = createDashboardQueryClient();

    expect(queryClient.getDefaultOptions().queries?.retry).toBe(
      shouldRetryQuery,
    );
  });
});

describe("a query that failed in the dashboard's QueryClient", () => {
  let queryClient: QueryClient | undefined;

  afterEach(() => {
    queryClient?.unmount();
    queryClient?.clear();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  });

  /**
   * Fails a query, then focuses the window, reconnects and mounts a second
   * observer, like a menu that renders its content again when it opens.
   */
  async function failAndWakeUp(error: Error) {
    const client = createDashboardQueryClient();
    queryClient = client;
    client.mount();
    const queryFn = vi.fn().mockRejectedValue(error);
    const options = { queryKey: ["top-tasks"], queryFn };
    // The client reacts to focus and reconnect after a promise, and each
    // failed fetch settles before the next event.
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await vi.waitFor(() => {
        const state = client.getQueryState(options.queryKey);
        expect(state?.status).toBe("error");
        expect(state?.fetchStatus).toBe("idle");
      });
    };

    const unsubscribe = new QueryObserver(client, options).subscribe(
      () => undefined,
    );
    await settle();
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await settle();
    new QueryObserver(client, options).subscribe(() => undefined)();
    await settle();
    unsubscribe();

    return queryFn;
  }

  it("is not fetched again when the API refused it for the analysis budget", async () => {
    const queryFn = await failAndWakeUp(analysisBudgetError());

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("is not fetched again for a new observer while it has data from before the refusal", async () => {
    const client = createDashboardQueryClient();
    queryClient = client;
    client.mount();
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce("tidligere tall")
      .mockRejectedValue(analysisBudgetError());
    const options = { queryKey: ["top-tasks"], queryFn, staleTime: 0 };
    await client.fetchQuery(options);
    await client.fetchQuery(options).catch(() => undefined);

    new QueryObserver(client, options).subscribe(() => undefined)();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("is fetched again on focus, reconnect and mount after another error", async () => {
    const badRequest = new ApiErrorException({
      status: 400,
      type: ErrorType.BAD_REQUEST,
      message: "Ugyldig dato",
      timestamp: "2026-10-22T00:00:00Z",
    });

    const queryFn = await failAndWakeUp(badRequest);

    expect(queryFn).toHaveBeenCalledTimes(4);
  });
});
