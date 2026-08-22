export const RELEASE_VERIFICATION_SURVEY_PREFIX = "lumi-release-verification-";
export const RELEASE_VERIFICATION_SURVEY_ID_PATTERN =
  /^lumi-release-verification-\d{8}-[a-f0-9]{8}$/;
export const RELEASE_VERIFICATION_SCHEMA_VERSION = 1 as const;
export const RELEASE_VERIFICATION_RATING = 4;
export const RELEASE_VERIFICATION_CONTROL_FIELD_ID = "control-code";

interface ReleaseVerificationEnvironment {
  cluster?: string;
  mockMode: boolean;
  localAuthBypass: boolean;
}

export type ReleaseVerificationAttemptStatus =
  | "idle"
  | "sending"
  | "success"
  | "error";

export type ReleaseVerificationPhase = "initial" | "closing";
export type ReleaseVerificationProfile =
  | "local-full-chain"
  | "dev-authenticated-roundtrip";
export type ReleaseVerificationCheckStatus = "pending" | "passed" | "failed";

export interface ReleaseVerificationPreflightEvidence {
  status: "passed" | "failed" | "unavailable";
  checkedAt: string;
  team: string;
  app: string;
  message?: string;
}

export interface ReleaseVerificationProbeEvidence {
  phase: ReleaseVerificationPhase;
  status: "verified" | "not-found" | "mismatch" | "unavailable";
  receiptId: string;
  duplicate: boolean | null;
  storedAt: string | null;
  mismatches: string[];
}

export interface ReleaseVerificationCheck {
  id:
    | "team-preflight"
    | "initial-round-trip"
    | "hold-window"
    | "closing-round-trip"
    | "local-submission-proxy"
    | "controlled-dashboard-round-trip";
  status: ReleaseVerificationCheckStatus;
  completedAt: string | null;
  detail: string;
}

export interface ReleaseVerificationReportV1 {
  schemaVersion: typeof RELEASE_VERIFICATION_SCHEMA_VERSION;
  profileVersion: 1;
  profile: ReleaseVerificationProfile;
  runId: string;
  environment: string;
  generatedAt: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: ReleaseVerificationCheckStatus;
  subject: {
    surveyId: string;
    team: string;
    app: string;
  };
  observeAfter: string | null;
  checks: ReleaseVerificationCheck[];
  probes: {
    initial: ReleaseVerificationProbeEvidence | null;
    closing: ReleaseVerificationProbeEvidence | null;
  };
  coverage: {
    controlledRoundTrip: ReleaseVerificationCheckStatus;
    localSubmissionProxy: ReleaseVerificationCheckStatus | "not-tested";
    globalAzureHealth: "not-assessed";
    trygdeetatenProxy: "not-tested";
    navWideRelease: "pending";
  };
}

interface ReleaseVerificationReadback {
  id: string;
  submittedAt: string;
  surveyId: string;
  app: string | null;
  surveyType?: string;
  context?: { tags?: Record<string, string> };
  answers: Array<{
    fieldId: string;
    fieldType: string;
    value: {
      type: string;
      rating?: number;
      selectedOptionId?: string;
    };
  }>;
}

interface ExpectedReleaseVerificationReadback {
  receiptId: string;
  surveyId: string;
  app: string;
  phase: ReleaseVerificationPhase;
  channel: "azure-obo" | "local-bypass";
  duplicate: boolean | null;
}

interface CreateReleaseVerificationReportInput {
  profile: ReleaseVerificationProfile;
  environment: string;
  surveyId: string;
  now: string;
  holdDurationMs: number;
  preflight: ReleaseVerificationPreflightEvidence;
  initialProbe?: ReleaseVerificationProbeEvidence;
  closingProbe?: ReleaseVerificationProbeEvidence;
}

export function canStartReleaseVerificationRun(
  status: ReleaseVerificationAttemptStatus,
): boolean {
  return status !== "sending";
}

export function createReleaseVerificationSurveyId(
  now: Date = new Date(),
  randomId: string = globalThis.crypto.randomUUID(),
): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomId.replaceAll("-", "").slice(0, 8).toLowerCase();
  return `${RELEASE_VERIFICATION_SURVEY_PREFIX}${date}-${suffix}`;
}

export function createReleaseVerificationControlCode(surveyId: string): string {
  const suffix = surveyId.split("-").at(-1)?.toUpperCase();
  if (!suffix || !/^[A-F0-9]{8}$/.test(suffix)) {
    throw new Error("surveyId must end with an eight-character hexadecimal id");
  }
  return `RV-${suffix}`;
}

export function createReleaseVerificationControlOptionId(
  surveyId: string,
): string {
  return createReleaseVerificationControlCode(surveyId).toLowerCase();
}

export function isReleaseVerificationEnabled({
  cluster,
  mockMode,
  localAuthBypass,
}: ReleaseVerificationEnvironment): boolean {
  if (mockMode) return false;
  return cluster === "dev-gcp" || (!cluster && localAuthBypass);
}

export function verifyReleaseVerificationReadback(
  feedback: ReleaseVerificationReadback | null,
  expected: ExpectedReleaseVerificationReadback,
): ReleaseVerificationProbeEvidence {
  if (!feedback) {
    return {
      phase: expected.phase,
      status: "not-found",
      receiptId: expected.receiptId,
      duplicate: expected.duplicate,
      storedAt: null,
      mismatches: ["receipt-not-found"],
    };
  }

  const mismatches: string[] = [];
  if (feedback.id !== expected.receiptId) mismatches.push("receipt-id");
  if (feedback.surveyId !== expected.surveyId) mismatches.push("survey-id");
  if (feedback.app !== expected.app) mismatches.push("app");
  if (feedback.surveyType !== "rating") mismatches.push("survey-type");
  if (!isValidTimestamp(feedback.submittedAt)) mismatches.push("stored-at");
  if (feedback.context?.tags?.purpose !== "release-verification") {
    mismatches.push("context-purpose");
  }
  if (feedback.context?.tags?.phase !== expected.phase) {
    mismatches.push("context-phase");
  }
  if (feedback.context?.tags?.channel !== expected.channel) {
    mismatches.push("context-channel");
  }

  const ratingAnswer = feedback.answers.find(
    ({ fieldId }) => fieldId === "rating",
  );
  if (
    ratingAnswer?.fieldType !== "RATING" ||
    ratingAnswer.value.type !== "rating" ||
    ratingAnswer.value.rating !== RELEASE_VERIFICATION_RATING
  ) {
    mismatches.push("rating-answer");
  }

  const controlAnswer = feedback.answers.find(
    ({ fieldId }) => fieldId === RELEASE_VERIFICATION_CONTROL_FIELD_ID,
  );
  if (
    controlAnswer?.fieldType !== "SINGLE_CHOICE" ||
    controlAnswer.value.type !== "singleChoice" ||
    controlAnswer.value.selectedOptionId !==
      createReleaseVerificationControlOptionId(expected.surveyId)
  ) {
    mismatches.push("control-code-answer");
  }

  return {
    phase: expected.phase,
    status: mismatches.length === 0 ? "verified" : "mismatch",
    receiptId: expected.receiptId,
    duplicate: expected.duplicate,
    storedAt: isValidTimestamp(feedback.submittedAt)
      ? new Date(feedback.submittedAt).toISOString()
      : null,
    mismatches,
  };
}

export function createReleaseVerificationReport({
  profile,
  environment,
  surveyId,
  now,
  holdDurationMs,
  preflight,
  initialProbe,
  closingProbe,
}: CreateReleaseVerificationReportInput): ReleaseVerificationReportV1 {
  const generatedAt = toIsoTimestamp(now, "now");
  const initialPassed = initialProbe?.status === "verified";
  const initialFailed =
    initialProbe !== undefined &&
    (initialProbe.status === "mismatch" || initialProbe.status === "not-found");
  const observeAfter =
    initialPassed && initialProbe.storedAt
      ? new Date(
          new Date(initialProbe.storedAt).getTime() + holdDurationMs,
        ).toISOString()
      : null;
  const holdPassed = observeAfter
    ? new Date(generatedAt).getTime() >= new Date(observeAfter).getTime()
    : false;
  const closingStoredAfterHold = Boolean(
    closingProbe?.storedAt &&
      observeAfter &&
      new Date(closingProbe.storedAt).getTime() >=
        new Date(observeAfter).getTime(),
  );
  const closingPassed =
    closingProbe?.status === "verified" && closingStoredAfterHold;
  const closingFailed =
    closingProbe !== undefined &&
    (closingProbe.status === "mismatch" || closingProbe.status === "not-found");

  let outcome: ReleaseVerificationCheckStatus = "pending";
  if (preflight.status === "failed" || initialFailed || closingFailed) {
    outcome = "failed";
  } else if (
    preflight.status === "passed" &&
    initialPassed &&
    holdPassed &&
    closingPassed
  ) {
    outcome = "passed";
  }

  const checks: ReleaseVerificationCheck[] = [
    {
      id: "team-preflight",
      status: preflight.status === "unavailable" ? "pending" : preflight.status,
      completedAt: preflight.checkedAt,
      detail:
        preflight.status === "passed"
          ? `Lesetilgang bekreftet for ${preflight.team}/${preflight.app}`
          : preflight.status === "unavailable"
            ? (preflight.message ?? "Teamtilgang prøves på nytt senere")
            : (preflight.message ?? "Teamtilgang kunne ikke bekreftes"),
    },
    {
      id: "initial-round-trip",
      status: probeCheckStatus(initialProbe),
      completedAt: initialProbe?.storedAt ?? null,
      detail: probeDetail(initialProbe, "Startproben er ikke sendt ennå"),
    },
    {
      id: "hold-window",
      status: initialFailed ? "failed" : holdPassed ? "passed" : "pending",
      completedAt: holdPassed ? observeAfter : null,
      detail: observeAfter
        ? holdPassed
          ? "Holdetiden er fullført"
          : `Vent til ${observeAfter}`
        : "Venter på lagret startprobe",
    },
    {
      id: "closing-round-trip",
      status: closingFailed ? "failed" : closingPassed ? "passed" : "pending",
      completedAt: closingProbe?.storedAt ?? null,
      detail: closingProbe
        ? closingPassed
          ? "Avsluttende receipt er lest tilbake etter holdetiden"
          : closingProbe.status === "verified"
            ? "Avsluttende probe ble lagret før holdetiden var ferdig"
            : probeDetail(closingProbe, "")
        : holdPassed
          ? "Klar for avsluttende probe"
          : "Venter på holdetiden",
    },
  ];

  return {
    schemaVersion: RELEASE_VERIFICATION_SCHEMA_VERSION,
    profileVersion: 1,
    profile,
    runId: surveyId,
    environment,
    generatedAt,
    startedAt: initialProbe?.storedAt
      ? toIsoTimestamp(initialProbe.storedAt, "initialProbe.storedAt")
      : toIsoTimestamp(preflight.checkedAt, "preflight.checkedAt"),
    finishedAt:
      outcome === "passed"
        ? (closingProbe?.storedAt ?? generatedAt)
        : outcome === "failed"
          ? generatedAt
          : null,
    outcome,
    subject: {
      surveyId,
      team: preflight.team,
      app: preflight.app,
    },
    observeAfter,
    checks,
    probes: {
      initial: initialProbe ?? null,
      closing: closingProbe ?? null,
    },
    coverage: {
      controlledRoundTrip: outcome,
      localSubmissionProxy: "not-tested",
      globalAzureHealth: "not-assessed",
      trygdeetatenProxy: "not-tested",
      navWideRelease: "pending",
    },
  };
}

function probeCheckStatus(
  probe: ReleaseVerificationProbeEvidence | undefined,
): ReleaseVerificationCheckStatus {
  if (!probe) return "pending";
  if (probe.status === "unavailable") return "pending";
  return probe.status === "verified" ? "passed" : "failed";
}

function probeDetail(
  probe: ReleaseVerificationProbeEvidence | undefined,
  pendingDetail: string,
): string {
  if (!probe) return pendingDetail;
  if (probe.status === "verified") {
    return `Receipt ${probe.receiptId} er lest tilbake eksakt`;
  }
  if (probe.status === "unavailable") {
    return "Readback er midlertidig utilgjengelig og prøves på nytt";
  }
  return `Readback feilet: ${probe.mismatches.join(", ")}`;
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function toIsoTimestamp(value: string, field: string): string {
  if (!isValidTimestamp(value))
    throw new Error(`${field} must be a valid timestamp`);
  return new Date(value).toISOString();
}
