import { Alert, BodyShort, Box, Heading } from "@navikt/ds-react";
import { useEffect, useMemo } from "react";
import { reportDashboardRouteError } from "~/observability/errors";
import { ApiErrorException, ErrorType } from "~/types/errors";

export function safeHelpUrl(helpUrl: string | null | undefined): string | null {
  if (!helpUrl) return null;
  try {
    const parsed = new URL(helpUrl);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Shown for every error that does not come from the API. */
const UNEXPECTED_ERROR_TEXT =
  "Siden kunne ikke vises. Prøv å laste den inn på nytt.";

export function ErrorComponent({ error }: { error: unknown }) {
  const normalizedError = useMemo(
    () => (error instanceof Error ? error : new Error(UNEXPECTED_ERROR_TEXT)),
    [error],
  );
  useEffect(
    () => reportDashboardRouteError(normalizedError),
    [normalizedError],
  );

  return (
    <Box
      as="main"
      paddingBlock={{ xs: "space-16", md: "space-24" }}
      paddingInline={{ xs: "space-12", sm: "space-16" }}
      className="main-container"
    >
      <ErrorAlert error={error} />
    </Box>
  );
}

function ErrorAlert({ error }: { error: unknown }) {
  // Handle structured ApiErrors
  if (error instanceof ApiErrorException) {
    const { type, message, status } = error.error;

    if (type === ErrorType.AUTHENTICATION_ERROR || status === 401) {
      // Reload page to re-trigger auth flow if session expired
      // Or show login message
      // For now, simple message
      return (
        <Alert variant="warning">
          <Heading spacing size="small" level="3">
            Du er ikke logget inn
          </Heading>
          <BodyShort>
            Din sesjon har utløpt. Vennligst last inn siden på nytt.
          </BodyShort>
        </Alert>
      );
    }

    // The API answers 503 when the team lookup in Nais fails, when Texas
    // cannot check the login and when the database does not answer. Its
    // details say what to try, so the dashboard adds no tip of its own.
    if (status === 503) {
      const { details } = error.error;
      return (
        <Alert variant="warning">
          <Heading spacing size="small" level="3">
            Midlertidig problem
          </Heading>
          <BodyShort>{message || "Prøv igjen om litt."}</BodyShort>
          {details && <BodyShort className="mt-2">{details}</BodyShort>}
        </Alert>
      );
    }

    if (type === ErrorType.AUTHORIZATION_ERROR || status === 403) {
      const { details, helpUrl } = error.error;
      const validatedHelpUrl = safeHelpUrl(helpUrl);
      return (
        <Alert variant="warning">
          <Heading spacing size="small" level="3">
            Ingen tilgang
          </Heading>
          <BodyShort>{message}</BodyShort>
          {details && <BodyShort className="mt-2">{details}</BodyShort>}
          {validatedHelpUrl && (
            <BodyShort className="mt-4">
              <a
                href={validatedHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Les mer om hvordan du får tilgang →
              </a>
            </BodyShort>
          )}
        </Alert>
      );
    }

    if (type === ErrorType.NOT_FOUND || status === 404) {
      return (
        <Alert variant="info">
          <Heading spacing size="small" level="3">
            Fant ikke ressursen
          </Heading>
          <BodyShort>{message || "Vi fant ikke det du lette etter."}</BodyShort>
        </Alert>
      );
    }

    // Default ApiError handling
    return (
      <Alert variant="error">
        <Heading spacing size="small" level="3">
          Noe gikk galt ({status})
        </Heading>
        <BodyShort>
          {message || "En uventet feil oppstod ved kommunikasjon med serveren."}
        </BodyShort>
        {type && (
          <BodyShort className="mt-2 text-xs font-mono">{type}</BodyShort>
        )}
      </Alert>
    );
  }

  // Other errors can carry zod issues as JSON, stack traces or English text
  // from a library, so their message is not shown.
  return (
    <Alert variant="error">
      <Heading spacing size="small" level="3">
        En uventet feil oppstod
      </Heading>
      <BodyShort>{UNEXPECTED_ERROR_TEXT}</BodyShort>
    </Alert>
  );
}
