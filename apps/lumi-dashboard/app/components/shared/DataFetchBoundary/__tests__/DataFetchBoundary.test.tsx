import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analysisBudgetError } from "~/mock/analysisBudget";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  ANALYSIS_BUDGET_TITLE,
  describeAnalysisBudget,
  FILTER_BUDGET_DESCRIPTION,
} from "~/utils/analysisBudget";
import { DataFetchBoundary } from "../index";

const search = vi.hoisted(() => ({
  params: {} as Record<string, string>,
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: search.params, setParams: vi.fn() }),
}));

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => undefined,
}));

function failedQuery(error: unknown) {
  return { error, isError: true, isFetching: false, refetch: vi.fn() };
}

function failingFetch(first: Error, then = first) {
  return vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(first)
    .mockRejectedValue(then);
}

function Analysis({
  queryFn,
  offerShorterPeriod,
}: {
  queryFn: () => Promise<string>;
  offerShorterPeriod?: boolean;
}) {
  const query = useQuery({ queryKey: ["analysis"], queryFn, retry: false });
  return (
    <DataFetchBoundary
      title="Kunne ikke hente Top Tasks-data"
      offerShorterPeriod={offerShorterPeriod}
      queries={[query]}
    >
      <div>Oppgavekvadrant</div>
    </DataFetchBoundary>
  );
}

describe("DataFetchBoundary", () => {
  beforeEach(() => {
    search.params = {};
  });

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
    const query = failedQuery(analysisBudgetError());

    render(
      <DataFetchBoundary
        title="Kunne ikke hente Top Tasks-data"
        description="Databasen svarer ikke akkurat nå."
        analysisBudgetDescription={describeAnalysisBudget("Top Tasks-analysen")}
        queries={[query]}
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
      screen.getByRole("button", { name: /^Vis perioden / }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Oppgavekvadrant")).not.toBeInTheDocument();
    expect(query.refetch).not.toHaveBeenCalled();
  });

  it("names the analysis in general by default", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[failedQuery(analysisBudgetError())]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Analysen kan ikke regnes ut for så mange svar.",
    );
  });

  it("uses the page's own text and can leave out the shorter period", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente tilbakemeldinger"
        analysisBudgetDescription={FILTER_BUDGET_DESCRIPTION}
        offerShorterPeriod={false}
        queries={[failedQuery(analysisBudgetError())]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      FILTER_BUDGET_DESCRIPTION,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers to remove the filter for a list the API filters in memory", () => {
    search.params = { task: "soke" };

    render(
      <DataFetchBoundary
        title="Kunne ikke hente tilbakemeldinger"
        analysisBudgetDescription={FILTER_BUDGET_DESCRIPTION}
        offerRemoveFilter
        queries={[failedQuery(analysisBudgetError())]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Fjern filteret på oppgave" }),
    ).toBeInTheDocument();
  });

  it("keeps the retry when another query failed for another reason", () => {
    render(
      <DataFetchBoundary
        title="Kunne ikke hente dashboarddata"
        queries={[
          failedQuery(analysisBudgetError()),
          failedQuery(new Error("network failure")),
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
          failedQuery(
            new ApiErrorException({
              status: 400,
              type: ErrorType.BAD_REQUEST,
              message: "Ugyldig dato",
              timestamp: "2026-10-22T00:00:00Z",
            }),
          ),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Prøv igjen" })).toBeVisible();
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      ANALYSIS_BUDGET_TITLE,
    );
  });

  describe("when a retry ends in the analysis budget", () => {
    async function retry(element: ReactElement) {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={new QueryClient()}>
          {element}
        </QueryClientProvider>,
      );
      const retryButton = await screen.findByRole("button", {
        name: "Prøv igjen",
      });
      retryButton.focus();
      await user.keyboard("{Enter}");
    }

    it("moves focus to the budget alert, where screen readers read all of it", async () => {
      await retry(
        <Analysis
          queryFn={failingFetch(
            new Error("network failure"),
            analysisBudgetError(),
          )}
        />,
      );

      await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
      expect(
        screen.getByRole("button", { name: /^Vis perioden / }),
      ).toBeInTheDocument();
    });

    it("moves focus to the alert when it has no button", async () => {
      await retry(
        <Analysis
          queryFn={failingFetch(
            new Error("network failure"),
            analysisBudgetError(),
          )}
          offerShorterPeriod={false}
        />,
      );

      await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
      expect(screen.getByRole("alert")).toHaveTextContent(
        ANALYSIS_BUDGET_TITLE,
      );
    });
  });

  it("leaves the focus alone for a later refusal after a retry that failed for another reason", async () => {
    const client = new QueryClient();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockRejectedValueOnce(new Error("network failure"))
      .mockRejectedValue(analysisBudgetError());
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <Analysis queryFn={queryFn} />
      </QueryClientProvider>,
    );
    const retryButton = await screen.findByRole("button", {
      name: "Prøv igjen",
    });
    retryButton.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Prøv igjen" })).toBeEnabled(),
    );

    (document.activeElement as HTMLElement | null)?.blur();
    await act(() => client.refetchQueries({ queryKey: ["analysis"] }));

    await screen.findByText(ANALYSIS_BUDGET_TITLE);
    expect(document.activeElement).toBe(document.body);
  });

  it("leaves the focus alone when the first load ends in the budget", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Analysis queryFn={failingFetch(analysisBudgetError())} />
      </QueryClientProvider>,
    );

    await screen.findByText(ANALYSIS_BUDGET_TITLE);
    expect(document.activeElement).toBe(document.body);
  });
});
