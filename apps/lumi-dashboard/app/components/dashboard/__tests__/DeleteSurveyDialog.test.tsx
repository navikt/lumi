import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteSurveyDialog } from "../DeleteSurveyDialog";

const { mockMutateAsync } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
}));

vi.mock("~/hooks/useDeleteSurvey", () => ({
  useDeleteSurvey: () => ({
    mutateAsync: mockMutateAsync,
    isError: false,
    isPending: false,
  }),
}));

vi.mock("~/hooks/useSurveyTotalCount", () => ({
  useSurveyTotalCount: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
  }),
}));

describe("DeleteSurveyDialog", () => {
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
});
