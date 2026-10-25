import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from "@tanstack/router-core/ssr/client";
import { fromCrossJSON, toCrossJSONAsync } from "seroval";
import { describe, expect, it } from "vitest";
import { analysisBudgetError } from "~/mock/analysisBudget";
import { startInstance } from "~/start";
import { ApiErrorException } from "~/types/errors";
import { isAnalysisBudgetError } from "../analysisBudget";
import { apiErrorSerializationAdapter } from "../apiErrorSerialization";

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
    const original = analysisBudgetError();

    const serialized = await toCrossJSONAsync(original, { plugins });
    const restored = fromCrossJSON<unknown>(serialized, { plugins });

    expect(restored).toBeInstanceOf(ApiErrorException);
    expect(isAnalysisBudgetError(restored)).toBe(true);
  });
});
