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
  ANALYSIS_BUDGET_TITLE,
  analysisBudgetDescription,
  FILTER_BUDGET_DESCRIPTION,
} from "~/utils/analysisBudget";
import { DataFetchBoundary } from "../index";

vi.mock("~/components/shared/ShorterPeriodButton", () => ({
  ShorterPeriodButton: () => (
    <button type="button">Vis de siste 30 dagene i perioden</button>
  ),
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
            error: undefined,
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
            error: undefined,
            isError: true,
            isFetching: false,
            refetch: failedRefetch,
          },
          {
            error: undefined,
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
      error: undefined,
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
  it("explains the analysis budget and offers a shorter period, without a retry", () => {
    const refetch = vi.fn();

    render(
      <DataFetchBoundary
        title="Kunne ikke hente Top Tasks-data"
        description="Databasen svarer ikke akkurat nå."
        analysisBudgetDescription={analysisBudgetDescription(
          "Top Tasks-analysen",
        )}
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
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_TITLE);
    expect(alert).toHaveTextContent(
      "Top Tasks-analysen kan ikke regnes ut for så mange svar. Velg en kortere periode.",
    );
    expect(alert).not.toHaveTextContent("Kunne ikke hente");
    expect(alert).not.toHaveTextContent("Databasen svarer ikke akkurat nå.");
    expect(
      screen.queryByRole("button", { name: "Prøv igjen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vis de siste 30 dagene i perioden" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Oppgavekvadrant")).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("uses the page's own text and can leave out the shorter period", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente tilbakemeldinger"
        analysisBudgetDescription={FILTER_BUDGET_DESCRIPTION}
        offerShorterPeriod={false}
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
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the retry when another query failed for another reason", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[
          {
            error: analysisBudgetError,
            isError: true,
            isFetching: false,
            refetch: vi.fn(),
          },
          {
            error: new Error("network failure"),
            isError: true,
            isFetching: false,
            refetch: vi.fn(),
          },
        ]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kunne ikke hente dashboarddata",
    );
    expect(screen.getByRole("button", { name: "Prøv igjen" })).toBeVisible();
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
      ANALYSIS_BUDGET_TITLE,
    );
  });
});
