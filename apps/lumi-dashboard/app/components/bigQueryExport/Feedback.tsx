import { Alert, Box } from "@navikt/ds-react";
import type { ReactNode } from "react";

type Gap = "space-8" | "space-12";

/**
 * Where results appear after an action. The region stays in the page, so
 * screen readers read what appears in it, and it takes no space while it is
 * empty.
 */
export function LiveRegion({
  children,
  gap = "space-12",
}: {
  children?: ReactNode;
  gap?: Gap;
}) {
  return (
    <div aria-live="polite">
      {children ? <Box paddingBlock={`${gap} space-0`}>{children}</Box> : null}
    </div>
  );
}

/** An error after an action. Screen readers read it right away. */
export function ActionError({
  children,
  gap = "space-12",
}: {
  children?: ReactNode;
  gap?: Gap;
}) {
  if (!children) return null;
  return (
    <Box paddingBlock={`${gap} space-0`}>
      <Alert variant="error" size="small" role="alert">
        {children}
      </Alert>
    </Box>
  );
}

/** The result or the error of an action, placed right after its button. */
export function ActionFeedback({
  result,
  error,
}: {
  result?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <>
      <LiveRegion>{result}</LiveRegion>
      <ActionError>{error}</ActionError>
    </>
  );
}
