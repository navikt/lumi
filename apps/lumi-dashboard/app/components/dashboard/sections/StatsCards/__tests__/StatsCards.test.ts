import { describe, expect, it } from "vitest";

function getRatingEmoji(rating: number): string {
  if (Number.isNaN(rating)) return "";
  if (rating < 1.5) return "😡";
  if (rating < 2.5) return "🙁";
  if (rating < 3.5) return "😐";
  if (rating < 4.5) return "😀";
  return "😍";
}

describe("getRatingEmoji", () => {
  it("returns empty string for NaN", () => {
    expect(getRatingEmoji(Number.NaN)).toBe("");
  });

  it("returns angry emoji for ratings below 1.5", () => {
    expect(getRatingEmoji(1)).toBe("😡");
    expect(getRatingEmoji(1.4)).toBe("😡");
  });

  it("returns sad emoji for ratings 1.5-2.4", () => {
    expect(getRatingEmoji(1.5)).toBe("🙁");
    expect(getRatingEmoji(2)).toBe("🙁");
    expect(getRatingEmoji(2.4)).toBe("🙁");
  });

  it("returns neutral emoji for ratings 2.5-3.4", () => {
    expect(getRatingEmoji(2.5)).toBe("😐");
    expect(getRatingEmoji(3)).toBe("😐");
    expect(getRatingEmoji(3.4)).toBe("😐");
  });

  it("returns happy emoji for ratings 3.5-4.4", () => {
    expect(getRatingEmoji(3.5)).toBe("😀");
    expect(getRatingEmoji(4)).toBe("😀");
    expect(getRatingEmoji(4.4)).toBe("😀");
  });

  it("returns love emoji for ratings 4.5 and above", () => {
    expect(getRatingEmoji(4.5)).toBe("😍");
    expect(getRatingEmoji(5)).toBe("😍");
  });
});
