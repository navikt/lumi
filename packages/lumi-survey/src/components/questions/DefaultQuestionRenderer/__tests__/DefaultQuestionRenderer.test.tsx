import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
      screen.getByRole("heading", { name: question.prompt }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "2. Neutral" }));

    expect(handleChange).toHaveBeenCalledWith(2);
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

    const textarea = screen.getByRole("textbox", { name: question.prompt });
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
    const { container } = render(
      <DefaultQuestionRenderer
        // @ts-expect-error intentionally using an unsupported type to verify guard behaviour
        question={{ id: "unknown", type: "unsupported", prompt: "Unsupported" }}
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
