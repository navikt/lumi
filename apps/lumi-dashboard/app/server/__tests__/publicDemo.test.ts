import { describe, expect, it, vi } from "vitest";

import { resolveIsPublicDemo } from "../publicDemo";

vi.mock("@tanstack/react-start/server", () => ({
  setResponseStatus: vi.fn(),
}));
vi.mock("~/serverEnv", () => ({ serverEnv: {} }));

describe("resolveIsPublicDemo", () => {
  it("treats the mock build on Nais as the public demo", () => {
    expect(
      resolveIsPublicDemo({ isMockMode: true, naisClusterName: "dev-gcp" }),
    ).toBe(true);
  });

  it("keeps local mock mode writable", () => {
    expect(resolveIsPublicDemo({ isMockMode: true })).toBe(false);
    expect(resolveIsPublicDemo({ isMockMode: true, naisClusterName: "" })).toBe(
      false,
    );
  });

  it("never applies to real data, on Nais or locally", () => {
    expect(
      resolveIsPublicDemo({ isMockMode: false, naisClusterName: "prod-gcp" }),
    ).toBe(false);
    expect(resolveIsPublicDemo({ isMockMode: false })).toBe(false);
  });
});
