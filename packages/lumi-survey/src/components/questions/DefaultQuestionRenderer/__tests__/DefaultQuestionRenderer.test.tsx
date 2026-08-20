import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyQuestion,
  RatingQuestion,
} from "../../../../core/types.js";
import { DefaultQuestionRenderer } from "../DefaultQuestionRenderer.js";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  }
});

describe("DefaultQuestionRenderer", () => {
  it("renders a rating question and forwards numeric values", () => {
    const handleChange = vi.fn();
    const question = {
      id: "rating",
      type: "rating" as const,
      prompt: "How satisfied are you?",
      scale: 3,
      labels: [
        { value: 1, label: "Very dissatisfied" },
        { value: 2, label: "Neutral" },
        { value: 3, label: "Very satisfied" },
      ],
    };

    render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={handleChange}
        validationErrorMessage="This field is required"
        isMissing={false}
        disabled={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: new RegExp(question.prompt) }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "2. Neutral" }));

    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it("announces a missing rating through a persistent polite live region", () => {
    const question = {
      id: "rating",
      type: "rating" as const,
      prompt: "How satisfied are you?",
      scale: 3,
    };

    const { container, rerender } = render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing={false}
        disabled={false}
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toBeEmptyDOMElement();
    expect(liveRegion).toHaveClass("aksel-fieldset__error");

    rerender(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing
        disabled={false}
      />,
    );

    expect(container.querySelector('[aria-live="polite"]')).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("This field is required");
    expect(liveRegion).toHaveAttribute("aria-relevant", "additions removals");
    expect(liveRegion).not.toHaveAttribute("role", "alert");
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-describedby",
      "rating-error",
    );
  });

  it.each<RatingQuestion>([
    {
      id: "thumbs",
      type: "rating",
      variant: "thumbs",
      prompt: "Was this useful?",
    },
    {
      id: "stars",
      type: "rating",
      variant: "stars",
      prompt: "How many stars?",
    },
    {
      id: "nps",
      type: "rating",
      variant: "nps",
      prompt: "Would you recommend us?",
    },
  ])("keeps the polite error region mounted for $variant ratings", (question) => {
    const { container, rerender } = render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing={false}
        disabled={false}
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeEmptyDOMElement();

    rerender(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing
        disabled={false}
      />,
    );

    expect(container.querySelector('[aria-live="polite"]')).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("This field is required");
  });

  it.each<RatingQuestion>([
    {
      id: "emoji-keyboard",
      type: "rating",
      variant: "emoji",
      prompt: "How was your experience?",
    },
    {
      id: "thumbs-keyboard",
      type: "rating",
      variant: "thumbs",
      prompt: "Was this useful?",
    },
    {
      id: "stars-keyboard",
      type: "rating",
      variant: "stars",
      prompt: "How many stars?",
    },
    {
      id: "nps-keyboard",
      type: "rating",
      variant: "nps",
      prompt: "Would you recommend us?",
    },
  ])("uses one tab stop and moves focus with wrapping for $variant ratings", async (question) => {
    const user = userEvent.setup();

    function ControlledRating() {
      const [value, setValue] = useState<number | undefined>();

      return (
        <DefaultQuestionRenderer
          question={question}
          value={value}
          onChange={(nextValue) =>
            setValue(typeof nextValue === "number" ? nextValue : undefined)
          }
          validationErrorMessage="This field is required"
          isMissing={false}
          disabled={false}
        />
      );
    }

    render(<ControlledRating />);

    const radios = screen.getAllByRole("radio");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([radios[0]]);

    radios[0].focus();
    await user.keyboard("{ArrowLeft}");

    expect(radios.at(-1)).toHaveFocus();
    expect(radios.at(-1)).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowRight}");

    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  it.each<RatingQuestion>([
    {
      id: "emoji-error",
      type: "rating",
      variant: "emoji",
      prompt: "How was your experience?",
    },
    {
      id: "thumbs-error",
      type: "rating",
      variant: "thumbs",
      prompt: "Was this useful?",
    },
    {
      id: "stars-error",
      type: "rating",
      variant: "stars",
      prompt: "How many stars?",
    },
    {
      id: "nps-error",
      type: "rating",
      variant: "nps",
      prompt: "Would you recommend us?",
    },
  ])("connects the Aksel fieldset error to the $variant radiogroup", async (question) => {
    const { container } = render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing
        disabled={false}
      />,
    );

    const fieldset = container.querySelector("fieldset");
    const legend = container.querySelector("legend");
    const radiogroup = screen.getByRole("radiogroup");
    const errorRegion = document.getElementById(`${question.id}-error`);

    expect(fieldset).toHaveClass("aksel-fieldset");
    expect(legend).toHaveClass("aksel-sr-only");
    expect(errorRegion).toHaveClass("aksel-fieldset__error");
    expect(errorRegion).toHaveAttribute("aria-live", "polite");
    expect(errorRegion).toHaveTextContent("This field is required");
    expect(radiogroup).toHaveAttribute("aria-invalid", "true");
    expect(radiogroup).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(`${question.id}-error`),
    );
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it("keeps the visible thumbs labels in their accessible names", () => {
    render(
      <DefaultQuestionRenderer
        question={{
          id: "thumb-labels",
          type: "rating",
          variant: "thumbs",
          prompt: "Was this useful?",
        }}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing={false}
        disabled={false}
      />,
    );

    expect(
      screen.getByRole("radio", { name: /Nei.*tommel ned/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /Ja.*tommel opp/i }),
    ).toBeVisible();
  });

  it("renders a text question with textarea label", () => {
    const handleChange = vi.fn();
    const question = {
      id: "text",
      type: "text" as const,
      prompt: "Describe your experience",
      description: "We appreciate honest feedback",
    };

    render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={handleChange}
        validationErrorMessage="You must answer"
        isMissing={false}
        disabled={false}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: new RegExp(question.prompt),
    });
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "Great" } });

    expect(handleChange).toHaveBeenCalledWith("Great");
  });

  it("renders a single choice question and shows validation message when missing", () => {
    const handleChange = vi.fn();
    const question = {
      id: "single",
      type: "singleChoice" as const,
      prompt: "Pick one option",
      options: [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ],
    };

    render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={handleChange}
        validationErrorMessage="Select an option"
        isMissing
        disabled={false}
      />,
    );

    expect(screen.getByText("Select an option")).toBeInTheDocument();

    const option = screen.getByRole("radio", { name: "Option B" });
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith("b");
  });

  it("renders a multi choice question and returns the selected values", () => {
    const handleChange = vi.fn();
    const question = {
      id: "multi",
      type: "multiChoice" as const,
      prompt: "Pick all that apply",
      options: [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
        { value: "c", label: "Option C" },
      ],
    };

    render(
      <DefaultQuestionRenderer
        question={question}
        value={["b"]}
        onChange={handleChange}
        validationErrorMessage="Select at least one option"
        isMissing={false}
        disabled={false}
      />,
    );

    const checked = screen.getByRole("checkbox", { name: "Option B" });
    expect(checked).toBeChecked();

    const optionC = screen.getByRole("checkbox", { name: "Option C" });
    fireEvent.click(optionC);

    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining(["b", "c"]),
    );
    expect(handleChange.mock.calls[0][0]).toHaveLength(2);
  });

  it("returns null for unsupported question types", () => {
    const question: LumiSurveyQuestion = {
      id: "unknown",
      // @ts-expect-error: this is intentionally invalid to test runtime handling
      type: "unsupported",
      prompt: "Unsupported",
    };

    const { container } = render(
      <DefaultQuestionRenderer
        question={question}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage=""
        isMissing={false}
        disabled={false}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
