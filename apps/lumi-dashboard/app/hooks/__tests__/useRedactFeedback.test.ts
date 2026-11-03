import {
  onlineManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { resetRedactedFeedbackQueries } from "../useRedactFeedback";

vi.mock("~/server/actions/redactFeedback", () => ({
  redactFeedbackServerFn: vi.fn(),
}));

describe("cache after text masking", () => {
  it("clears inactive filters and all text analysis values", async () => {
    const client = new QueryClient();
    const keys = [
      ["feedback", "team", "old-filter"],
      ["stats", "team"],
      ["discoveryStats"],
      ["topTasksStats"],
      ["blockerStats"],
      ["taskPriorityStats"],
    ];
    for (const key of keys) client.setQueryData(key, { text: "old name" });
    client.setQueryData(["markers"], { text: "unrelated marker" });
    await resetRedactedFeedbackQueries(client);
    for (const key of keys) expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(["markers"])).toEqual({
      text: "unrelated marker",
    });
    client.clear();
  });
  it("ignores a late response from a cancelled request", async () => {
    const client = new QueryClient();
    let finish: (value: string) => void = () => {};
    const pending = client
      .fetchQuery({
        queryKey: ["feedback", "team"],
        queryFn: () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      })
      .catch(() => undefined);
    await resetRedactedFeedbackQueries(client);
    finish("old name");
    await pending;
    expect(client.getQueryData(["feedback", "team"])).toBeUndefined();
    client.clear();
  });
  it("does not report a paused offline refresh as complete", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.mount();
    onlineManager.setOnline(false);
    const queryKey = ["feedback", "team"];
    client.setQueryData(queryKey, "old value");
    const fetchFeedback = vi
      .fn()
      .mockRejectedValue(new Error("Refresh failed after reconnect"));
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: fetchFeedback,
      staleTime: Infinity,
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await expect(
        resetRedactedFeedbackQueries(client, { requireFreshFeedback: true }),
      ).rejects.toThrow();
      expect(client.getQueryState(queryKey)?.fetchStatus).toBe("paused");
      expect(client.getQueryData(queryKey)).toBeUndefined();

      onlineManager.setOnline(true);
      await vi.waitFor(() =>
        expect(client.getQueryState(queryKey)?.status).toBe("error"),
      );
      expect(fetchFeedback).toHaveBeenCalledOnce();
    } finally {
      onlineManager.setOnline(true);
      unsubscribe();
      client.clear();
      client.unmount();
    }
  });
  it("allows a fresh feedback list when another text query fails", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const feedbackKey = ["feedback", "team"];
    const statsKey = ["stats", "team"];
    client.setQueryData(feedbackKey, "old value");
    client.setQueryData(statsKey, "old value");
    const feedback = new QueryObserver(client, {
      queryKey: feedbackKey,
      queryFn: async () => "fresh value",
      staleTime: Infinity,
    });
    const stats = new QueryObserver(client, {
      queryKey: statsKey,
      queryFn: () => Promise.reject(new Error("Stats refresh failed")),
      staleTime: Infinity,
    });
    const unsubscribeFeedback = feedback.subscribe(() => {});
    const unsubscribeStats = stats.subscribe(() => {});
    try {
      await expect(
        resetRedactedFeedbackQueries(client, { requireFreshFeedback: true }),
      ).resolves.toBeUndefined();
      expect(client.getQueryData(feedbackKey)).toBe("fresh value");
      expect(client.getQueryState(statsKey)?.status).toBe("error");
      expect(client.getQueryData(statsKey)).toBeUndefined();
    } finally {
      unsubscribeFeedback();
      unsubscribeStats();
      client.clear();
    }
  });
});
