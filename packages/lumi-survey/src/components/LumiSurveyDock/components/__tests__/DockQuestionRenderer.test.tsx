import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LumiSurveyQuestion, RatingQuestion } from "../../../../core";
import { DockQuestionRenderer } from "../DockQuestionRenderer.js";

// ---------------------------------------------------------------------------
// Mocks – isolate DockQuestionRenderer from the real question field internals
// ---------------------------------------------------------------------------

vi.mock("../../../questions", () => ({
  RatingQuestionField: (props: Record<string, unknown>) => (
    <div
      data-testid="rating-question-field"
      data-fieldset-class={props.fieldsetClassName}
      data-hide-prompt={String(props.hidePrompt)}
      data-hide-description={String(props.hideDescription)}
      data-hide-value-labels={String(props.hideValueLabels)}
      data-wrap={String(props.wrap)}
      data-aria-labelledby={props.ariaLabelledBy ?? ""}
      data-aria-describedby={props.ariaDescribedBy ?? ""}
      data-row-class={props.rowClassName}
      data-button-class={props.buttonClassName}
    />
  ),
  DefaultQuestionRenderer: (props: Record<string, unknown>) => (
    <div
      data-testid="default-question-renderer"
      data-question-id={(props.question as LumiSurveyQuestion).id}
      data-hide-label={String(props.hideLabel)}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ratingQuestion: RatingQuestion = {
  id: "rating-q",
  type: "rating",
  prompt: "Hvor fornøyd er du?",
};

const radioQuestion: LumiSurveyQuestion = {
  id: "radio-q",
  type: "singleChoice",
  prompt: "Velg et alternativ",
  options: [
    { value: "a", label: "Alt A" },
    { value: "b", label: "Alt B" },
  ],
};

const baseProps = {
  value: undefined,
  onChange: vi.fn(),
  isMissing: false,
  disabled: false,
  promptQuestionId: "rating-q",
  promptHeadingId: "heading-id",
  promptDescriptionId: "desc-id",
  validationErrorMessage: "Feltet er påkrevd",
  textTooLongErrorMessage: (maxLength: number) =>
    `Svaret kan være maks ${maxLength} tegn`,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DockQuestionRenderer", () => {
  it("renders RatingQuestionField with dock-specific CSS classes for rating questions", () => {
    render(
      <DockQuestionRenderer
        {...baseProps}
        question={ratingQuestion}
        hideLabel={false}
      />,
    );

    const field = screen.getByTestId("rating-question-field");
    expect(field).toBeInTheDocument();

    // Dock applies custom class names for fieldset, row, and button
    expect(field.dataset.fieldsetClass).toBeTruthy();
    expect(field.dataset.rowClass).toBeTruthy();
    expect(field.dataset.buttonClass).toBeTruthy();

    // Always hides value labels and disables wrapping in the dock
    expect(field.dataset.hideValueLabels).toBe("true");
    expect(field.dataset.wrap).toBe("false");
  });

  it("delegates non-rating questions to DefaultQuestionRenderer", () => {
    render(
      <DockQuestionRenderer
        {...baseProps}
        question={radioQuestion}
        hideLabel={false}
      />,
    );

    const renderer = screen.getByTestId("default-question-renderer");
    expect(renderer).toBeInTheDocument();
    expect(renderer.dataset.questionId).toBe("radio-q");

    expect(
      screen.queryByTestId("rating-question-field"),
    ).not.toBeInTheDocument();
  });

  it("hides internal heading when question is the prompt question", () => {
    render(
      <DockQuestionRenderer
        {...baseProps}
        question={ratingQuestion}
        promptQuestionId="rating-q"
      />,
    );

    const field = screen.getByTestId("rating-question-field");
    expect(field.dataset.hidePrompt).toBe("true");
    expect(field.dataset.hideDescription).toBe("true");
  });

  it("shows internal heading when question is NOT the prompt question", () => {
    const otherRating: RatingQuestion = {
      id: "other-rating",
      type: "rating",
      prompt: "Annet spørsmål",
    };

    render(
      <DockQuestionRenderer
        {...baseProps}
        question={otherRating}
        promptQuestionId="rating-q"
        hideLabel={false}
      />,
    );

    const field = screen.getByTestId("rating-question-field");
    expect(field.dataset.hidePrompt).toBe("false");
    expect(field.dataset.hideDescription).toBe("false");
  });

  it("sets ariaLabelledBy and ariaDescribedBy only for the prompt question", () => {
    render(
      <DockQuestionRenderer
        {...baseProps}
        question={ratingQuestion}
        promptQuestionId="rating-q"
        promptHeadingId="heading-id"
        promptDescriptionId="desc-id"
      />,
    );

    const field = screen.getByTestId("rating-question-field");
    expect(field.dataset.ariaLabelledby).toBe("heading-id");
    expect(field.dataset.ariaDescribedby).toBe("desc-id");
  });

  it("does NOT set ariaLabelledBy / ariaDescribedBy for non-prompt questions", () => {
    const otherRating: RatingQuestion = {
      id: "other-rating",
      type: "rating",
      prompt: "Annet spørsmål",
    };

    render(
      <DockQuestionRenderer
        {...baseProps}
        question={otherRating}
        promptQuestionId="rating-q"
        promptHeadingId="heading-id"
        promptDescriptionId="desc-id"
        hideLabel={false}
      />,
    );

    const field = screen.getByTestId("rating-question-field");
    expect(field.dataset.ariaLabelledby).toBe("");
    expect(field.dataset.ariaDescribedby).toBe("");
  });
});
