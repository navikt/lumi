import { describe, expect, it } from "vitest";
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
