import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { FeedbackTable } from "../index";

const { mockBootstrap } = vi.hoisted(() => ({
  mockBootstrap: { data: undefined, error: null as unknown },
}));

vi.mock("~/hooks/useFeedback", () => ({
  useFeedback: () => ({
    data: undefined,
    error: new Error("403"),
    isError: true,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("~/hooks/useFilterBootstrap", () => ({
  useFilterBootstrap: () => mockBootstrap,
}));

describe("FeedbackTable when the team cannot be read", () => {
  beforeEach(() => {
    mockBootstrap.error = null;
  });

  it("leaves the explanation to FilterBar", () => {
    mockBootstrap.error = new ApiErrorException({
      status: 403,
      type: ErrorType.AUTHORIZATION_ERROR,
      message: "Du har ikke tilgang til team: team-x",
      timestamp: "2026-10-15T08:00:00Z",
    });

    const { container } = render(<FeedbackTable />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error when the team is readable", () => {
    render(<FeedbackTable />);

    expect(
      screen.getByText("Kunne ikke hente tilbakemeldinger"),
    ).toBeInTheDocument();
  });
});
