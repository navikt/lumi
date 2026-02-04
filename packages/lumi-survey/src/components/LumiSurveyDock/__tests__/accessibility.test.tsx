import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRatingSurvey } from "../../../presets";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const survey = createRatingSurvey({
  ratingPrompt: "Hvor fornøyd er du?",
  followUpQuestions: [
    {
      id: "feedback",
      type: "text",
      prompt: "Hva kan vi forbedre?",
      required: false,
    },
  ],
});

const mockTransport = { submit: vi.fn().mockResolvedValue(undefined) };

describe("LumiSurveyDock Accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should have no axe violations in open state", async () => {
    const { container } = render(
      <LumiSurveyDock
        surveyId="a11y-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("should have no axe violations in minimized state", async () => {
    const { container } = render(
      <LumiSurveyDock
        surveyId="a11y-test-min"
        survey={survey}
        transport={mockTransport}
        behavior={{ initialOpen: false }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /gi tilbakemelding/i }),
      ).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("renders widget in aside element", async () => {
    render(
      <LumiSurveyDock
        surveyId="aside-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("complementary")).toBeInTheDocument();
    });
  });

  it("supports keyboard navigation for rating", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="keyboard-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /1\./i })).toBeInTheDocument();
    });

    const firstRadio = screen.getByRole("radio", { name: /1\./i });

    // Focus the first radio
    firstRadio.focus();
    expect(firstRadio).toHaveFocus();

    // Arrow right should select next option
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /2\./i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("has proper heading hierarchy", async () => {
    render(
      <LumiSurveyDock
        surveyId="heading-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Hvor fornøyd er du?");
    });
  });

  it("announces success state to screen readers", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="announce-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    // Complete the form
    await user.click(screen.getByRole("radio", { name: /5\./i }));

    const textbox = screen.queryByRole("textbox");
    if (textbox) {
      await user.type(textbox, "Feedback");
    }

    await user.click(screen.getByRole("button", { name: /send/i }));

    // Check for status announcement
    await waitFor(() => {
      const statusRegion = screen.getByRole("status");
      expect(statusRegion).toBeInTheDocument();
    });
  });

  it("radiogroup has accessible name", async () => {
    render(
      <LumiSurveyDock
        surveyId="radiogroup-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup).toHaveAttribute("aria-labelledby");
    });
  });
});
