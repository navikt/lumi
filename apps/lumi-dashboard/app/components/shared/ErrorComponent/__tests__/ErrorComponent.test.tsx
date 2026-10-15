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

  it("renders and reports a plain Error unchanged", () => {
    const error = new Error("Test error message");

    render(<ErrorComponent error={error} />);

    expect(
      screen.getByRole("heading", { name: "En uventet feil oppstod" }),
    ).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    expect(reportDashboardRouteError).toHaveBeenCalledExactlyOnceWith(error);
  });

  it.each([
    "raw synthetic error",
    { message: "raw synthetic error" },
  ])("normalizes a non-Error without displaying or reporting its raw value (%j)", (error) => {
    const { rerender } = render(<ErrorComponent error={error} />);

    expect(
      screen.getByRole("heading", { name: "En uventet feil oppstod" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Vennligst prøv igjen senere."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw synthetic error/)).not.toBeInTheDocument();
    expect(reportDashboardRouteError).toHaveBeenCalledTimes(1);
    const reported = vi.mocked(reportDashboardRouteError).mock.calls[0][0];
    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe("Vennligst prøv igjen senere.");
    expect(reported).not.toHaveProperty("cause");

    rerender(<ErrorComponent error={error} />);

    expect(reportDashboardRouteError).toHaveBeenCalledTimes(1);
  });
});
