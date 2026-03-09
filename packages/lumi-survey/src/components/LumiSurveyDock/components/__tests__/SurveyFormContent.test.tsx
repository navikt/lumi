import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LumiSurveyQuestion } from "../../../../core";
import { SurveyFormContent } from "../SurveyFormContent.js";

// ---------------------------------------------------------------------------
// Mock – replace DockQuestionRenderer with a lightweight stub
// ---------------------------------------------------------------------------

vi.mock("../DockQuestionRenderer.js", () => ({
  DockQuestionRenderer: ({ question }: { question: LumiSurveyQuestion }) => (
    <div data-testid={`question-${question.id}`}>{question.prompt}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ratingQuestion: LumiSurveyQuestion = {
  id: "rating",
  type: "rating",
  prompt: "Hvor fornøyd er du?",
};

const textQuestion: LumiSurveyQuestion = {
  id: "feedback",
  type: "text",
  prompt: "Hva kan vi forbedre?",
};

const choiceQuestion: LumiSurveyQuestion = {
  id: "choice",
  type: "singleChoice",
  prompt: "Velg et alternativ",
  options: [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ],
};

const allQuestions = [ratingQuestion, textQuestion, choiceQuestion];

function defaultProps(
  overrides: Partial<Parameters<typeof SurveyFormContent>[0]> = {},
): Parameters<typeof SurveyFormContent>[0] {
  return {
    // Form
    onSubmit: vi.fn((e) => {
      e.preventDefault();
      return Promise.resolve();
    }),
    isSubmitting: false,
    isSubmitBlocked: false,
    submitLabel: "Send",
    submitPendingLabel: "Sender…",

    // Questions
    orderedQuestions: allQuestions,
    answers: {},
    onQuestionChange: vi.fn(),
    promptQuestionId: "rating",
    promptHeadingId: "heading-id",
    validationMissing: [],
    validationErrorMessage: "Feltet er påkrevd",

    // Step navigation (default: no step mode)
    isStepMode: false,
    canGoBack: false,
    canGoNext: true,
    isLastStep: false,
    nextLabel: "Neste",
    backLabel: "Tilbake",

    // Progress
    showProgress: false,
    currentStep: 0,
    totalSteps: 3,
    hasBranching: false,

    // Notices
    showPersonalDataNotice: false,
    hasTransportError: false,
    transportErrorMessage: "Kunne ikke sende tilbakemeldingen.",

    // Misc
    disabled: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SurveyFormContent", () => {
  // ---- Step mode ----

  describe("step mode", () => {
    it("renders only the current step question, not all questions", () => {
      render(
        <SurveyFormContent
          {...defaultProps({
            isStepMode: true,
            currentStepQuestion: ratingQuestion,
          })}
        />,
      );

      expect(screen.getByTestId("question-rating")).toBeInTheDocument();
      expect(screen.queryByTestId("question-feedback")).not.toBeInTheDocument();
      expect(screen.queryByTestId("question-choice")).not.toBeInTheDocument();
    });

    it("shows Tilbake button when canGoBack is true", () => {
      render(
        <SurveyFormContent
          {...defaultProps({
            isStepMode: true,
            currentStepQuestion: textQuestion,
            canGoBack: true,
          })}
        />,
      );

      expect(
        screen.getByRole("button", { name: /tilbake/i }),
      ).toBeInTheDocument();
    });

    it("does NOT show Tilbake button when canGoBack is false", () => {
      render(
        <SurveyFormContent
          {...defaultProps({
            isStepMode: true,
            currentStepQuestion: ratingQuestion,
            canGoBack: false,
          })}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /tilbake/i }),
      ).not.toBeInTheDocument();
    });

    it("shows submit button (submitLabel) when isLastStep is true instead of Neste", () => {
      render(
        <SurveyFormContent
          {...defaultProps({
            isStepMode: true,
            currentStepQuestion: choiceQuestion,
            isLastStep: true,
          })}
        />,
      );

      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /neste/i }),
      ).not.toBeInTheDocument();
    });

    it("shows Neste button when isLastStep is false", () => {
      render(
        <SurveyFormContent
          {...defaultProps({
            isStepMode: true,
            currentStepQuestion: ratingQuestion,
            isLastStep: false,
          })}
        />,
      );

      expect(
        screen.getByRole("button", { name: /neste/i }),
      ).toBeInTheDocument();
      // No submit button in non-last step
      expect(
        screen.queryByRole("button", { name: /^send$/i }),
      ).not.toBeInTheDocument();
    });

    it("calls onBack when Tilbake button is clicked", async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(
        <SurveyFormContent
          {...defaultProps({
            isStepMode: true,
            currentStepQuestion: textQuestion,
            canGoBack: true,
            onBack,
          })}
        />,
      );

      await user.click(screen.getByRole("button", { name: /tilbake/i }));
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  // ---- Single-page mode ----

  describe("single-page mode", () => {
    it("renders all questions", () => {
      render(<SurveyFormContent {...defaultProps()} />);

      expect(screen.getByTestId("question-rating")).toBeInTheDocument();
      expect(screen.getByTestId("question-feedback")).toBeInTheDocument();
      expect(screen.getByTestId("question-choice")).toBeInTheDocument();
    });

    it("shows the submit button", () => {
      render(<SurveyFormContent {...defaultProps()} />);

      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    });
  });

  // ---- Privacy notice ----

  it("shows privacy notice when showPersonalDataNotice is true", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          showPersonalDataNotice: true,
          personalDataNoticeBody: "Ikke skriv personopplysninger.",
        })}
      />,
    );

    expect(
      screen.getByText(/ikke skriv personopplysninger/i),
    ).toBeInTheDocument();

    // Alert should have warning variant (role="status" for non-urgent info)
    expect(
      screen
        .getByText(/ikke skriv personopplysninger/i)
        .closest('[role="status"]'),
    ).toBeInTheDocument();
  });

  it("does NOT show privacy notice when showPersonalDataNotice is false", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          showPersonalDataNotice: false,
          personalDataNoticeBody: "Ikke skriv personopplysninger.",
        })}
      />,
    );

    expect(
      screen.queryByText(/ikke skriv personopplysninger/i),
    ).not.toBeInTheDocument();
  });

  // ---- Transport error ----

  it("shows transport error when hasTransportError is true", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          hasTransportError: true,
          transportErrorMessage: "Kunne ikke sende tilbakemeldingen.",
        })}
      />,
    );

    expect(
      screen.getByText(/kunne ikke sende tilbakemeldingen/i),
    ).toBeInTheDocument();

    expect(
      screen
        .getByText(/kunne ikke sende tilbakemeldingen/i)
        .closest('[role="alert"]'),
    ).toBeInTheDocument();
  });

  it("does NOT show transport error when hasTransportError is false", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          hasTransportError: false,
          transportErrorMessage: "Kunne ikke sende tilbakemeldingen.",
        })}
      />,
    );

    expect(
      screen.queryByText(/kunne ikke sende tilbakemeldingen/i),
    ).not.toBeInTheDocument();
  });

  // ---- ProgressBar ----

  it("shows ProgressBar when showProgress is true in step mode", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          isStepMode: true,
          currentStepQuestion: ratingQuestion,
          showProgress: true,
          currentStep: 1,
          totalSteps: 3,
          hasBranching: false,
        })}
      />,
    );

    // ProgressBar should be present with aria-label "Steg 2 av 3" (currentStep + 1)
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("aria-label", "Steg 2 av 3");
    expect(progressBar).toHaveAttribute("aria-valuenow", "2");
    expect(progressBar).toHaveAttribute("aria-valuemax", "3");
  });

  it("shows ProgressBar with branching-aware label when hasBranching is true", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          isStepMode: true,
          currentStepQuestion: ratingQuestion,
          showProgress: true,
          currentStep: 0,
          totalSteps: 4,
          hasBranching: true,
        })}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    // When branching, label omits " av X" since total is unpredictable
    expect(progressBar).toHaveAttribute("aria-label", "Steg 1");
  });

  it("does NOT show ProgressBar when showProgress is false", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          isStepMode: true,
          currentStepQuestion: ratingQuestion,
          showProgress: false,
          currentStep: 0,
          totalSteps: 3,
        })}
      />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
