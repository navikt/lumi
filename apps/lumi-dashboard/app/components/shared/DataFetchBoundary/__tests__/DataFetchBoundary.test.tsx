import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  ANALYSIS_BUDGET_DESCRIPTION,
  FILTER_BUDGET_DESCRIPTION,
} from "~/utils/analysisBudget";
import { DataFetchBoundary } from "../index";

vi.mock("~/components/shared/ShorterPeriodButton", () => ({
  ShorterPeriodButton: () => <button type="button">Vis siste 30 dager</button>,
}));

const analysisBudgetError = new ApiErrorException({
  status: 400,
  type: ErrorType.ANALYSIS_BUDGET_EXCEEDED,
  message: "Too much feedback data for in-memory analysis",
  timestamp: "2026-10-22T00:00:00Z",
});

describe("DataFetchBoundary", () => {
  it("renders its content when all queries have succeeded", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[
          {
            isError: false,
            isFetching: false,
            refetch: vi.fn(),
          },
        ]}
      >
        <div>42 tilbakemeldinger</div>
      </DataFetchBoundary>,
    );

    expect(screen.getByText("42 tilbakemeldinger")).toBeInTheDocument();
    expect(
      screen.queryByText("Kunne ikke hente dashboarddata"),
    ).not.toBeInTheDocument();
  });

  it("hides potentially misleading content and retries only failed queries", () => {
    const failedRefetch = vi.fn(() => new Promise<never>(() => undefined));
    const successfulRefetch = vi.fn().mockResolvedValue(undefined);

    render(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        description="Databasen svarer ikke akkurat nå."
        queries={[
          {
            isError: true,
            isFetching: false,
            refetch: failedRefetch,
          },
          {
            isError: false,
            isFetching: false,
            refetch: successfulRefetch,
          },
        ]}
      >
        <div>0 tilbakemeldinger</div>
      </DataFetchBoundary>,
    );

    expect(
      screen.getByText("Kunne ikke hente dashboarddata"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Databasen svarer ikke akkurat nå."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0 tilbakemeldinger")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prøv igjen" }));

    expect(failedRefetch).toHaveBeenCalledOnce();
    expect(successfulRefetch).not.toHaveBeenCalled();
  });

  it("keeps the alert and focus stable during retry, then announces recovery", async () => {
    let resolveRefetch: (value: { isError: false }) => void = () => undefined;
    const refetch = vi.fn(
      () =>
        new Promise<{ isError: false }>((resolve) => {
          resolveRefetch = resolve;
        }),
    );
    const query = {
      isError: true,
      isFetching: false,
      refetch,
    };
    const { rerender } = render(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[query]}
      >
        <div>42 tilbakemeldinger</div>
      </DataFetchBoundary>,
    );

    const retryButton = screen.getByRole("button", { name: "Prøv igjen" });
    retryButton.focus();
    fireEvent.click(retryButton);

    query.isError = false;
    query.isFetching = true;
    rerender(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[query]}
      >
        <div>42 tilbakemeldinger</div>
      </DataFetchBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(retryButton).toHaveFocus();
    expect(screen.queryByText("42 tilbakemeldinger")).not.toBeInTheDocument();

    await act(async () => resolveRefetch({ isError: false }));

    await waitFor(() =>
      expect(screen.getByText("42 tilbakemeldinger")).toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Dataene er lastet inn.",
    );

    query.isError = true;
    query.isFetching = false;
    rerender(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[query]}
      >
        <div>0 tilbakemeldinger</div>
      </DataFetchBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("0 tilbakemeldinger")).not.toBeInTheDocument();
  });
  it("offers a shorter period instead of a retry when the analysis budget is exceeded", () => {
    const refetch = vi.fn();

    render(
      <DataFetchBoundary
        title="Kunne ikke hente Top Tasks-data"
        description="Databasen svarer ikke akkurat nå."
        queries={[
          {
            error: analysisBudgetError,
            isError: true,
            isFetching: false,
            refetch,
          },
        ]}
      >
        <div>Oppgavekvadrant</div>
      </DataFetchBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Kunne ikke hente Top Tasks-data");
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_DESCRIPTION);
    expect(alert).not.toHaveTextContent("Databasen svarer ikke akkurat nå.");
    expect(
      screen.queryByRole("button", { name: "Prøv igjen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vis siste 30 dager" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Oppgavekvadrant")).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("uses the page's own text for the analysis budget", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente tilbakemeldinger"
        analysisBudgetDescription={FILTER_BUDGET_DESCRIPTION}
        queries={[
          {
            error: analysisBudgetError,
            isError: true,
            isFetching: false,
            refetch: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      FILTER_BUDGET_DESCRIPTION,
    );
  });

  it("keeps the retry for other API errors", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente Top Tasks-data"
        queries={[
          {
            error: new ApiErrorException({
              status: 400,
              type: ErrorType.BAD_REQUEST,
              message: "Ugyldig dato",
              timestamp: "2026-10-22T00:00:00Z",
            }),
            isError: true,
            isFetching: false,
            refetch: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Prøv igjen" })).toBeVisible();
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      ANALYSIS_BUDGET_DESCRIPTION,
    );
  });
});
