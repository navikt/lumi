import { QueryClient } from "@tanstack/react-query";
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
});
