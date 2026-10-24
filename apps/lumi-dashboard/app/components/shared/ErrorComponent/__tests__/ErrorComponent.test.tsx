import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportDashboardRouteError } from "~/observability/errors";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { ErrorComponent } from "..";

vi.mock("~/observability/errors", () => ({
  reportDashboardRouteError: vi.fn(),
}));

describe("ErrorComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [403, ErrorType.AUTHORIZATION_ERROR, "Ingen tilgang"],
    [404, ErrorType.NOT_FOUND, "Fant ikke ressursen"],
    [500, ErrorType.INTERNAL_SERVER_ERROR, "Noe gikk galt (500)"],
  ])("renders an API error with status %s", (status, type, heading) => {
    const error = new ApiErrorException({
      status,
      type,
      message: "Test API error message",
      timestamp: "2026-10-01T00:00:00Z",
    });

    render(<ErrorComponent error={error} />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    expect(reportDashboardRouteError).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("shows the API's message and details when the team lookup is unavailable", () => {
    const details =
      "Dette er ofte midlertidig, for eksempel når Nais API er nede. Jobber du utenfor Nav-nettet, sjekk at Kolide kjører. Prøv igjen om litt.";
    const error = new ApiErrorException({
      status: 503,
      type: ErrorType.INTERNAL_SERVER_ERROR,
      message: "Kunne ikke hente teamtilgang akkurat nå",
      details,
      timestamp: "2026-10-01T00:00:00Z",
    });

    render(<ErrorComponent error={error} />);

    expect(
      screen.getByRole("heading", { name: "Midlertidig problem" }),
    ).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    expect(screen.getByText(details)).toBeInTheDocument();
  });

  it("adds no Kolide tip of its own when the login could not be checked", () => {
    const error = new ApiErrorException({
      status: 503,
      type: ErrorType.INTERNAL_SERVER_ERROR,
      message: "Kunne ikke kontrollere innloggingen akkurat nå",
      details: "Dette er som regel midlertidig. Prøv igjen om litt.",
      timestamp: "2026-10-01T00:00:00Z",
    });

    render(<ErrorComponent error={error} />);

    expect(
      screen.getByRole("heading", { name: "Midlertidig problem" }),
    ).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    expect(screen.queryByText(/teamtilgang/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kolide/)).not.toBeInTheDocument();
  });

  it.each([
    ["a plain Error", new Error("Test error message"), "Test error message"],
    [
      // TanStack Router throws this when a search parameter fails validation.
      "zod issues as JSON",
      new Error(
        JSON.stringify(
          [
            {
              expected: "string",
              code: "invalid_type",
              path: ["team"],
              message: "Invalid input: expected string, received undefined",
            },
          ],
          null,
          2,
        ),
      ),
      "invalid_type",
    ],
    [
      "a stack trace",
      new TypeError(
        "Cannot read properties of undefined (reading 'map')\n    at FeedbackTable (app.js:1:2)",
      ),
      "Cannot read properties",
    ],
  ])(
    "shows a fixed text instead of %s and reports the error itself",
    (_name, error, rawText) => {
      const { container } = render(<ErrorComponent error={error} />);

      expect(
        screen.getByRole("heading", { name: "En uventet feil oppstod" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Siden kunne ikke vises. Sjekk at adressen er riktig, eller last inn siden på nytt.",
        ),
      ).toBeInTheDocument();
      expect(container).not.toHaveTextContent(rawText);
      expect(reportDashboardRouteError).toHaveBeenCalledExactlyOnceWith(error);
    },
  );

  it.each(["raw synthetic error", { message: "raw synthetic error" }])(
    "normalizes a non-Error without displaying or reporting its raw value (%j)",
    (error) => {
      const { rerender } = render(<ErrorComponent error={error} />);

      expect(
        screen.getByRole("heading", { name: "En uventet feil oppstod" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Siden kunne ikke vises. Sjekk at adressen er riktig, eller last inn siden på nytt.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/raw synthetic error/)).not.toBeInTheDocument();
      expect(reportDashboardRouteError).toHaveBeenCalledTimes(1);
      const reported = vi.mocked(reportDashboardRouteError).mock.calls[0][0];
      expect(reported).toBeInstanceOf(Error);
      expect(reported.message).toBe(
        "Siden kunne ikke vises. Sjekk at adressen er riktig, eller last inn siden på nytt.",
      );
      expect(reported).not.toHaveProperty("cause");

      rerender(<ErrorComponent error={error} />);

      expect(reportDashboardRouteError).toHaveBeenCalledTimes(1);
    },
  );
});
