import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshSurveyOverview } from ".";

const { mockMutation } = vi.hoisted(() => ({
  mockMutation: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  },
}));

vi.mock("~/hooks/useRefreshSurveyOverview", () => ({
  useRefreshSurveyOverview: () => mockMutation,
}));

describe("RefreshSurveyOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation.isPending = false;
    mockMutation.isError = false;
    mockMutation.isSuccess = false;
  });

  it("starts one explicit refresh from an accessible button", () => {
    render(<RefreshSurveyOverview />);

    const button = screen.getByRole("button", {
      name: "Oppdater surveyoversikt",
    });
    expect(button).toHaveAttribute(
      "title",
      "Oppdaterer surveyvalg og svarperioder, men ikke statistikken.",
    );
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockMutation.mutate).toHaveBeenCalledOnce();
  });

  it("keeps the button in place and disables repeated clicks while refreshing", () => {
    mockMutation.isPending = true;
    render(<RefreshSurveyOverview />);

    expect(
      screen.getByRole("button", { name: "Oppdater surveyoversikt" }),
    ).toBeDisabled();
  });

  it("shows a retryable error without replacing the existing page", () => {
    mockMutation.isError = true;
    render(<RefreshSurveyOverview />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kunne ikke oppdatere surveyoversikten. Prøv igjen.",
    );
    expect(
      screen.getByRole("button", { name: "Oppdater surveyoversikt" }),
    ).toBeEnabled();
  });

  it("announces a completed refresh", () => {
    mockMutation.isSuccess = true;
    render(<RefreshSurveyOverview />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Surveyoversikten er oppdatert.",
    );
  });
});
