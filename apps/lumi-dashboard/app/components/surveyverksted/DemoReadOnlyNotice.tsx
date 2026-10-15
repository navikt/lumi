import { Alert, Link } from "@navikt/ds-react";

/** Surveyverksted in the Lumi dashboard behind Nav login. */
export const SURVEYVERKSTED_SIGN_IN_URL =
  "https://lumi-dashboard.ansatt.nav.no/surveyverksted";

/**
 * Shown where the public demo refuses to save. The demo has no login and
 * one store for every visitor, so drafts are made in the real dashboard.
 */
export function DemoReadOnlyNotice() {
  return (
    <Alert variant="info">
      Demoen lagrer ikke utkast.{" "}
      <Link href={SURVEYVERKSTED_SIGN_IN_URL}>Logg inn i Lumi-dashboardet</Link>{" "}
      for å lage en survey.
    </Alert>
  );
}
