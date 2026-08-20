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
    expect(liveRegion?.id).toBeTruthy();
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(liveRegion?.id as string),
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

    await user.tab();
    expect(radios[0]).toHaveFocus();
    await user.keyboard("{Control>}{Alt>}{ArrowRight}{/Alt}{/Control}");

    expect(radios[0]).toHaveFocus();
    expect(
      radios.every((radio) => radio.getAttribute("aria-checked") === "false"),
    ).toBe(true);

    await user.keyboard("{ArrowLeft}");

    expect(radios.at(-1)).toHaveFocus();
    expect(radios.at(-1)).toHaveAttribute("aria-checked", "true");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([
      radios.at(-1),
    ]);

    await user.keyboard("{ArrowRight}");

    expect(radios[0]).toHaveFocus();
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([radios[0]]);
  });

  it.each([
    {
      question: {
        id: "emoji-invalid",
        type: "rating" as const,
        variant: "emoji" as const,
        prompt: "How was your experience?",
      },
      invalidValue: 6,
    },
    {
      question: {
        id: "thumbs-invalid",
        type: "rating" as const,
        variant: "thumbs" as const,
        prompt: "Was this useful?",
      },
      invalidValue: 3,
    },
    {
      question: {
        id: "stars-invalid",
        type: "rating" as const,
        variant: "stars" as const,
        prompt: "How many stars?",
      },
      invalidValue: 1.5,
    },
    {
      question: {
        id: "nps-invalid",
        type: "rating" as const,
        variant: "nps" as const,
        prompt: "Would you recommend us?",
      },
      invalidValue: 11,
    },
  ])("keeps the $question.variant radiogroup reachable for an invalid controlled value", ({
    question,
    invalidValue,
  }) => {
    render(
      <DefaultQuestionRenderer
        question={question}
        value={invalidValue}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing={false}
        disabled={false}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([radios[0]]);
    expect(
      radios.every((radio) => radio.getAttribute("aria-checked") === "false"),
    ).toBe(true);
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
    const errorRegion = container.querySelector(".aksel-fieldset__error");

    expect(fieldset).toHaveClass("aksel-fieldset");
    expect(legend).toHaveClass("aksel-sr-only");
    expect(errorRegion).toHaveClass("aksel-fieldset__error");
    expect(errorRegion).toHaveAttribute("aria-live", "polite");
    expect(errorRegion).toHaveTextContent("This field is required");
    expect(radiogroup).toHaveAttribute("aria-invalid", "true");
    expect(errorRegion?.id).toBeTruthy();
    expect(radiogroup).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(errorRegion?.id as string),
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

  it("uses unique valid DOM ids for repeated questions", () => {
    const question = {
      id: "overall rating",
      type: "rating" as const,
      prompt: "How was your experience?",
      description: "Choose the answer that fits best.",
      required: true,
    };

    const { container } = render(
      <>
        <DefaultQuestionRenderer
          question={question}
          value={undefined}
          onChange={() => undefined}
          validationErrorMessage="This field is required"
          isMissing
          disabled={false}
        />
        <DefaultQuestionRenderer
          question={question}
          value={undefined}
          onChange={() => undefined}
          validationErrorMessage="This field is required"
          isMissing
          disabled={false}
        />
      </>,
    );

    const groups = screen.getAllByRole("radiogroup", {
      name: /How was your experience/i,
    });
    expect(groups).toHaveLength(2);

    const allIds = Array.from(container.querySelectorAll<HTMLElement>("[id]"));
    const referencedIds = groups.flatMap((group) =>
      [
        group.getAttribute("aria-labelledby"),
        group.getAttribute("aria-describedby"),
      ]
        .filter(Boolean)
        .flatMap((ids) => ids?.split(/\s+/) ?? []),
    );

    for (const id of referencedIds) {
      expect(allIds.filter((element) => element.id === id)).toHaveLength(1);
    }
    expect(groups[0].getAttribute("aria-labelledby")).not.toBe(
      groups[1].getAttribute("aria-labelledby"),
    );
  });

  it("associates the NPS endpoint labels with the radiogroup", () => {
    const { container } = render(
      <DefaultQuestionRenderer
        question={{
          id: "nps-endpoints",
          type: "rating",
          variant: "nps",
          prompt: "Would you recommend us?",
          lowLabel: "Not likely",
          highLabel: "Very likely",
        }}
        value={undefined}
        onChange={() => undefined}
        validationErrorMessage="This field is required"
        isMissing={false}
        disabled={false}
      />,
    );

    const describedBy = screen
      .getByRole("radiogroup")
      .getAttribute("aria-describedby");
    const description = (describedBy ?? "")
      .split(/\s+/)
      .map(
        (id) =>
          container.querySelector<HTMLElement>(`[id="${id}"]`)?.textContent,
      )
      .join(" ");

    expect(description).toContain("Not likely");
    expect(description).toContain("Very likely");
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

  it("enforces maxSelections for checkbox multi-choice questions", () => {
    const handleChange = vi.fn();
    const question = {
      id: "multi-limited",
      type: "multiChoice" as const,
      prompt: "Velg opptil to",
      maxSelections: 2,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
    };

    const { rerender } = render(
      <DefaultQuestionRenderer
        question={question}
        value={["a", "b"]}
        onChange={handleChange}
        validationErrorMessage="Velg opptil to"
        isMissing={false}
        disabled={false}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "C" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "A" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "C" }));
    expect(handleChange).not.toHaveBeenCalled();

    rerender(
      <DefaultQuestionRenderer
        question={question}
        value={["a"]}
        onChange={handleChange}
        validationErrorMessage="Velg opptil to"
        isMissing={false}
        disabled={false}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "C" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "C" }));
    expect(handleChange).toHaveBeenCalledWith(["a", "c"]);
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
