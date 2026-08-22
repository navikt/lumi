import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataFetchBoundary } from "../index";

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
});
