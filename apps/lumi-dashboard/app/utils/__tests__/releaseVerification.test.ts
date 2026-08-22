import { describe, expect, it } from "vitest";
import {
  canStartReleaseVerificationRun,
  createReleaseVerificationSurveyId,
  isReleaseVerificationEnabled,
} from "~/utils/releaseVerification";

describe("release verification", () => {
  it("creates a unique, recognizable synthetic survey id", () => {
    expect(
      createReleaseVerificationSurveyId(
        new Date("2026-08-22T12:00:00Z"),
        "8a0dc3b1-7538-44a2-8b44-bdbfe58193bd",
      ),
    ).toBe("lumi-release-verification-20260822-8a0dc3b1");
  });

  it("is enabled only for real dev or an explicit local backend", () => {
    expect(
      isReleaseVerificationEnabled({
        cluster: "dev-gcp",
        mockMode: false,
        localAuthBypass: false,
      }),
    ).toBe(true);
    expect(
      isReleaseVerificationEnabled({
        cluster: "prod-gcp",
        mockMode: false,
        localAuthBypass: true,
      }),
    ).toBe(false);
    expect(
      isReleaseVerificationEnabled({
        mockMode: false,
        localAuthBypass: true,
      }),
    ).toBe(true);
    expect(
      isReleaseVerificationEnabled({
        cluster: "dev-gcp",
        mockMode: true,
        localAuthBypass: false,
      }),
    ).toBe(false);
  });

  it("does not allow the test id to change while a submission is in flight", () => {
    expect(canStartReleaseVerificationRun("idle")).toBe(true);
    expect(canStartReleaseVerificationRun("success")).toBe(true);
    expect(canStartReleaseVerificationRun("error")).toBe(true);
    expect(canStartReleaseVerificationRun("sending")).toBe(false);
  });
});
