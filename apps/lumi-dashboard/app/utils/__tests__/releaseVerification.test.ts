import { describe, expect, it } from "vitest";
import {
  canStartReleaseVerificationRun,
  createReleaseVerificationControlCode,
  createReleaseVerificationReport,
  createReleaseVerificationSurveyId,
  isReleaseVerificationEnabled,
  type ReleaseVerificationProbeEvidence,
  verifyReleaseVerificationReadback,
} from "~/utils/releaseVerification";

const surveyId = "lumi-release-verification-20260822-8a0dc3b1";
const initialStoredAt = "2026-08-22T08:49:47.000Z";

function verifiedProbe(
  phase: "initial" | "closing",
  storedAt = initialStoredAt,
): ReleaseVerificationProbeEvidence {
  return {
    phase,
    status: "verified",
    receiptId: `${phase}-receipt-id`,
    duplicate: false,
    storedAt,
    mismatches: [],
  };
}

describe("release verification", () => {
  it("creates a unique, recognizable synthetic survey id", () => {
    expect(
      createReleaseVerificationSurveyId(
        new Date("2026-08-22T12:00:00Z"),
        "8a0dc3b1-7538-44a2-8b44-bdbfe58193bd",
      ),
    ).toBe(surveyId);
  });

  it("derives a stable, non-personal control code from the survey id", () => {
    expect(createReleaseVerificationControlCode(surveyId)).toBe("RV-8A0DC3B1");
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

  it("verifies the exact stored receipt and expected synthetic fields", () => {
    const evidence = verifyReleaseVerificationReadback(
      {
        id: "receipt-id",
        submittedAt: initialStoredAt,
        surveyId,
        app: "lumi-dashboard",
        surveyType: "rating",
        context: {
          tags: {
            purpose: "release-verification",
            phase: "initial",
            channel: "azure-obo",
          },
        },
        answers: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            value: { type: "rating", rating: 4 },
          },
          {
            fieldId: "control-code",
            fieldType: "SINGLE_CHOICE",
            value: {
              type: "singleChoice",
              selectedOptionId: "rv-8a0dc3b1",
            },
          },
        ],
      },
      {
        receiptId: "receipt-id",
        surveyId,
        app: "lumi-dashboard",
        phase: "initial",
        channel: "azure-obo",
        duplicate: false,
      },
    );

    expect(evidence).toEqual({
      phase: "initial",
      status: "verified",
      receiptId: "receipt-id",
      duplicate: false,
      storedAt: initialStoredAt,
      mismatches: [],
    });
  });

  it("reports all exact-readback mismatches without inventing a pass", () => {
    const evidence = verifyReleaseVerificationReadback(
      {
        id: "wrong-receipt",
        submittedAt: "not-a-date",
        surveyId: "wrong-survey",
        app: "wrong-app",
        surveyType: "custom",
        context: { tags: {} },
        answers: [],
      },
      {
        receiptId: "receipt-id",
        surveyId,
        app: "lumi-dashboard",
        phase: "closing",
        channel: "azure-obo",
        duplicate: true,
      },
    );

    expect(evidence.status).toBe("mismatch");
    expect(evidence.duplicate).toBe(true);
    expect(evidence.mismatches).toEqual([
      "receipt-id",
      "survey-id",
      "app",
      "survey-type",
      "stored-at",
      "context-purpose",
      "context-phase",
      "context-channel",
      "rating-answer",
      "control-code-answer",
    ]);
  });

  it("keeps the report pending until the database-backed hold window closes", () => {
    const report = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: "2026-08-22T09:00:00.000Z",
      holdDurationMs: 15 * 60 * 1000,
      preflight: {
        status: "passed",
        checkedAt: "2026-08-22T08:48:00.000Z",
        team: "team-esyfo",
        app: "lumi-dashboard",
      },
      initialProbe: verifiedProbe("initial"),
    });

    expect(report.schemaVersion).toBe(1);
    expect(report.outcome).toBe("pending");
    expect(report.observeAfter).toBe("2026-08-22T09:04:47.000Z");
    expect(report.checks.map(({ status }) => status)).toEqual([
      "passed",
      "passed",
      "pending",
      "pending",
    ]);
  });

  it("passes the controlled chain only after a closing exact readback", () => {
    const report = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: "2026-08-22T09:05:00.000Z",
      holdDurationMs: 15 * 60 * 1000,
      preflight: {
        status: "passed",
        checkedAt: "2026-08-22T08:48:00.000Z",
        team: "team-esyfo",
        app: "lumi-dashboard",
      },
      initialProbe: verifiedProbe("initial"),
      closingProbe: verifiedProbe("closing", "2026-08-22T09:05:00.000Z"),
    });

    expect(report.outcome).toBe("passed");
    expect(report.finishedAt).toBe("2026-08-22T09:05:00.000Z");
    expect(report.coverage).toEqual({
      controlledRoundTrip: "passed",
      localSubmissionProxy: "not-tested",
      globalAzureHealth: "not-assessed",
      trygdeetatenProxy: "not-tested",
      navWideRelease: "pending",
    });
  });

  it("keeps an early closing probe retryable instead of permanently failing", () => {
    const report = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: "2026-08-22T09:05:00.000Z",
      holdDurationMs: 15 * 60 * 1000,
      preflight: {
        status: "passed",
        checkedAt: "2026-08-22T08:48:00.000Z",
        team: "team-esyfo",
        app: "lumi-dashboard",
      },
      initialProbe: verifiedProbe("initial"),
      closingProbe: verifiedProbe("closing", "2026-08-22T09:04:46.999Z"),
    });

    expect(report.outcome).toBe("pending");
    expect(
      report.checks.find(({ id }) => id === "closing-round-trip")?.status,
    ).toBe("pending");
  });

  it("keeps a transient readback failure pending for retry", () => {
    const report = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: "2026-08-22T08:50:00.000Z",
      holdDurationMs: 15 * 60 * 1000,
      preflight: {
        status: "passed",
        checkedAt: "2026-08-22T08:48:00.000Z",
        team: "team-esyfo",
        app: "lumi-dashboard",
      },
      initialProbe: {
        phase: "initial",
        status: "unavailable",
        receiptId: "initial-receipt-id",
        duplicate: false,
        storedAt: null,
        mismatches: ["readback-http-503"],
      },
    });

    expect(report.outcome).toBe("pending");
    expect(report.checks[1].status).toBe("pending");
  });

  it("keeps a transient preflight failure pending instead of inventing a pass", () => {
    const report = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: "2026-08-22T09:05:00.000Z",
      holdDurationMs: 15 * 60 * 1000,
      preflight: {
        status: "unavailable",
        checkedAt: "2026-08-22T09:05:00.000Z",
        team: "team-esyfo",
        app: "lumi-dashboard",
        message: "API-et svarte ikke",
      },
      initialProbe: verifiedProbe("initial"),
      closingProbe: verifiedProbe("closing", "2026-08-22T09:05:00.000Z"),
    });

    expect(report.outcome).toBe("pending");
    expect(report.checks[0]).toMatchObject({
      id: "team-preflight",
      status: "pending",
      detail: "API-et svarte ikke",
    });
  });

  it("fails closed when team preflight or an exact readback fails", () => {
    const failedPreflight = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: "2026-08-22T08:49:00.000Z",
      holdDurationMs: 15 * 60 * 1000,
      preflight: {
        status: "failed",
        checkedAt: "2026-08-22T08:48:00.000Z",
        team: "team-esyfo",
        app: "lumi-dashboard",
        message: "Teamtilgang mangler",
      },
    });
    expect(failedPreflight.outcome).toBe("failed");

    const mismatchedInitial = createReleaseVerificationReport({
      profile: "local-full-chain",
      environment: "local",
      surveyId,
      now: "2026-08-22T08:49:00.000Z",
      holdDurationMs: 0,
      preflight: {
        status: "passed",
        checkedAt: "2026-08-22T08:48:00.000Z",
        team: "local-dev",
        app: "local-app",
      },
      initialProbe: {
        ...verifiedProbe("initial"),
        status: "mismatch",
        mismatches: ["app"],
      },
    });
    expect(mismatchedInitial.outcome).toBe("failed");
  });
});
