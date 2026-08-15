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
    validationMissing: [],

    // Grouped props
    stepNavigation: {
      isStepMode: false,
      currentStep: 0,
      canGoBack: false,
      canGoNext: true,
      isLastStep: false,
      nextLabel: "Neste",
      backLabel: "Tilbake",
    },
    progress: {
      showProgress: false,
      totalSteps: 3,
      hasBranching: false,
    },
    questionContext: {
      promptQuestionId: "rating",
      promptHeadingId: "heading-id",
      validationErrorMessage: "Feltet er påkrevd",
    },

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
            stepNavigation: {
              isStepMode: true,
              currentStepQuestion: ratingQuestion,
            },
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
            stepNavigation: {
              isStepMode: true,
              currentStepQuestion: textQuestion,
              canGoBack: true,
            },
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
            stepNavigation: {
              isStepMode: true,
              currentStepQuestion: ratingQuestion,
              canGoBack: false,
            },
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
            stepNavigation: {
              isStepMode: true,
              currentStepQuestion: choiceQuestion,
              isLastStep: true,
            },
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
            stepNavigation: {
              isStepMode: true,
              currentStepQuestion: ratingQuestion,
              isLastStep: false,
            },
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
            stepNavigation: {
              isStepMode: true,
              currentStepQuestion: textQuestion,
              canGoBack: true,
              onBack,
            },
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
          stepNavigation: {
            isStepMode: true,
            currentStep: 1,
            currentStepQuestion: ratingQuestion,
          },
          progress: {
            showProgress: true,
            totalSteps: 3,
            hasBranching: false,
          },
        })}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute(
      "aria-label",
      "Fremdrift i undersøkelsen",
    );
    expect(progressBar).toHaveAttribute("aria-valuetext", "Steg 2 av 3");
    expect(progressBar).toHaveAttribute("aria-valuenow", "2");
    expect(progressBar).toHaveAttribute("aria-valuemax", "3");
  });

  it("shows ProgressBar on the first step", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          stepNavigation: {
            isStepMode: true,
            currentStep: 0,
            currentStepQuestion: ratingQuestion,
          },
          progress: {
            showProgress: true,
            totalSteps: 3,
            hasBranching: false,
          },
        })}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute(
      "aria-label",
      "Fremdrift i undersøkelsen",
    );
    expect(progressBar).toHaveAttribute("aria-valuenow", "1");
    expect(progressBar).toHaveAttribute("aria-valuemax", "3");
    expect(progressBar).toHaveAttribute("aria-valuetext", "Steg 1 av 3");
  });

  it("does not show ProgressBar when the survey has only one step", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          stepNavigation: {
            isStepMode: true,
            currentStep: 0,
            currentStepQuestion: ratingQuestion,
          },
          progress: {
            showProgress: true,
            totalSteps: 1,
            hasBranching: false,
          },
        })}
      />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not expose an estimated total as accessible text for branching", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          stepNavigation: {
            isStepMode: true,
            currentStep: 0,
            currentStepQuestion: ratingQuestion,
          },
          progress: {
            showProgress: true,
            totalSteps: 4,
            hasBranching: true,
          },
        })}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute(
      "aria-label",
      "Fremdrift i undersøkelsen",
    );
    expect(progressBar).toHaveAttribute("aria-valuetext", "Steg 1");
  });

  it("shows ProgressBar value based on currentStep + 1", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          stepNavigation: {
            isStepMode: true,
            currentStep: 4,
            currentStepQuestion: choiceQuestion,
            isLastStep: true,
          },
          progress: {
            showProgress: true,
            totalSteps: 5,
            hasBranching: true,
          },
        })}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    // Value is always currentStep + 1, no isLastStep override
    expect(progressBar).toHaveAttribute("aria-valuenow", "5");
    expect(progressBar).toHaveAttribute("aria-valuemax", "5");
  });

  it("does NOT show ProgressBar when showProgress is false", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          stepNavigation: {
            isStepMode: true,
            currentStep: 0,
            currentStepQuestion: ratingQuestion,
          },
          progress: {
            showProgress: false,
            totalSteps: 3,
          },
        })}
      />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not show ProgressBar outside step mode", () => {
    render(
      <SurveyFormContent
        {...defaultProps({
          progress: {
            showProgress: true,
            totalSteps: 3,
          },
        })}
      />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
