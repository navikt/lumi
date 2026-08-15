import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteSurveyDialog } from "../DeleteSurveyDialog";

const { mockMutateAsync, mockUseSurveyTotalCount } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockUseSurveyTotalCount: vi.fn(),
}));

vi.mock("~/hooks/useDeleteSurvey", () => ({
  useDeleteSurvey: () => ({
    mutateAsync: mockMutateAsync,
    isError: false,
    isPending: false,
  }),
}));

vi.mock("~/hooks/useSurveyTotalCount", () => ({
  useSurveyTotalCount: mockUseSurveyTotalCount,
}));

describe("DeleteSurveyDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSurveyTotalCount.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
    });
  });

  it("blocks deletion when the authoritative total count cannot be loaded", () => {
    render(
      <DeleteSurveyDialog
        surveyId="survey-old"
        filteredCount={0}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Kunne ikke hente totalt antall svar/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Slett svar permanent/i }),
    ).toBeDisabled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("describes permanent survey deletion without referring to zero answers", () => {
    mockUseSurveyTotalCount.mockReturnValue({
      data: 0,
      isLoading: false,
      isFetching: false,
      isError: false,
    });

    render(
      <DeleteSurveyDialog
        surveyId="survey-empty"
        filteredCount={0}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/surveyen har ingen lagrede svar/i)).toBeVisible();
    expect(
      screen.getByRole("checkbox", {
        name: /ja, slett surveyen permanent/i,
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /slett survey permanent/i }),
    ).toBeDisabled();
    expect(screen.queryByText(/slette alle 0 svar/i)).not.toBeInTheDocument();
  });

  it("blocks deletion while a cached total count is being refreshed", () => {
    mockUseSurveyTotalCount.mockReturnValue({
      data: 5,
      isLoading: false,
      isFetching: true,
      isError: false,
    });

    render(
      <DeleteSurveyDialog
        surveyId="survey-stale"
        filteredCount={5}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Slett svar permanent/i }),
    ).toBeDisabled();
    expect(screen.queryByText(/alle 5 svar/i)).not.toBeInTheDocument();
  });

  it("requires new confirmation when the refreshed total count changes", () => {
    mockUseSurveyTotalCount.mockReturnValue({
      data: 5,
      isLoading: false,
      isFetching: false,
      isError: false,
    });

    const props = {
      surveyId: "survey-changing",
      filteredCount: 5,
      isOpen: true,
      onClose: vi.fn(),
    };
    const { rerender } = render(<DeleteSurveyDialog {...props} />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(
      screen.getByRole("button", { name: /Slett 5 svar permanent/i }),
    ).toBeEnabled();

    mockUseSurveyTotalCount.mockReturnValue({
      data: 5,
      isLoading: false,
      isFetching: true,
      isError: false,
    });
    rerender(<DeleteSurveyDialog {...props} />);

    mockUseSurveyTotalCount.mockReturnValue({
      data: 4,
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    rerender(<DeleteSurveyDialog {...props} />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /Slett 4 svar permanent/i }),
    ).toBeDisabled();
  });
});
