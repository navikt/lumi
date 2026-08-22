export const RELEASE_VERIFICATION_SURVEY_PREFIX = "lumi-release-verification-";

interface ReleaseVerificationEnvironment {
  cluster?: string;
  mockMode: boolean;
  localAuthBypass: boolean;
}

export function createReleaseVerificationSurveyId(
  now: Date = new Date(),
  randomId: string = globalThis.crypto.randomUUID(),
): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomId.replaceAll("-", "").slice(0, 8).toLowerCase();
  return `${RELEASE_VERIFICATION_SURVEY_PREFIX}${date}-${suffix}`;
}

export function isReleaseVerificationEnabled({
  cluster,
  mockMode,
  localAuthBypass,
}: ReleaseVerificationEnvironment): boolean {
  if (mockMode) return false;
  return cluster === "dev-gcp" || (!cluster && localAuthBypass);
}
