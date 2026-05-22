import { describe, expect, it } from "vitest";
import { generateDeduplicationKey } from "../deduplicationKey.js";

describe("generateDeduplicationKey", () => {
  it("generates a key matching backend rules: 16-128 chars, [A-Za-z0-9._:-]", () => {
    const key = generateDeduplicationKey();
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(key).toMatch(/^[A-Za-z0-9._:-]+$/);
  });

  it("generates unique keys on each call", () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => generateDeduplicationKey()),
    );
    expect(keys.size).toBe(100);
  });
});
