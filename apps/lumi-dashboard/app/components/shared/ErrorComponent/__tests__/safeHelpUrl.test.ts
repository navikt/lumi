import { describe, expect, it } from "vitest";

import { safeHelpUrl } from "~/components/shared/ErrorComponent";

describe("safeHelpUrl", () => {
  it("accepts https URLs", () => {
    expect(safeHelpUrl("https://example.nav.no/help")).toBe(
      "https://example.nav.no/help",
    );
  });

  it("rejects javascript protocol", () => {
    expect(safeHelpUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects non-https protocols", () => {
    expect(safeHelpUrl("http://example.nav.no/help")).toBeNull();
    expect(safeHelpUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(safeHelpUrl("not-a-url")).toBeNull();
  });
});
