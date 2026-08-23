import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from "@tanstack/router-core";
import { fromCrossJSON, toCrossJSONAsync } from "seroval";
import { describe, expect, it } from "vitest";
import { startInstance } from "~/start";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { apiErrorSerializationAdapter } from "../apiErrorSerialization";
import {
  ANALYSIS_BUDGET_ERROR_DESCRIPTION,
  getDashboardStatsErrorDescription,
} from "../dashboardStatsError";

describe("ApiErrorException serialization", () => {
  it("survives the TanStack server-function boundary with its API error", async () => {
    const startOptions = await startInstance.getOptions();
    expect(startOptions.serializationAdapters).toContain(
      apiErrorSerializationAdapter,
    );

    const plugins = [
      makeSerovalPlugin(apiErrorSerializationAdapter),
      ...defaultSerovalPlugins,
    ];
    const original = new ApiErrorException({
      status: 400,
      type: ErrorType.ANALYSIS_BUDGET_EXCEEDED,
      message: "Too much feedback data for in-memory analysis",
      timestamp: "2026-08-23T00:00:00Z",
    });

    const serialized = await toCrossJSONAsync(original, { plugins });
    const restored = fromCrossJSON<unknown>(serialized, { plugins });

    expect(restored).toBeInstanceOf(ApiErrorException);
    expect(getDashboardStatsErrorDescription(restored)).toBe(
      ANALYSIS_BUDGET_ERROR_DESCRIPTION,
    );
  });
});
