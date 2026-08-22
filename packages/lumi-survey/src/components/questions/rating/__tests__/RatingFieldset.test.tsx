import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RatingQuestion } from "../../../../core/types.js";
import { RatingQuestionField } from "../RatingQuestionField.js";

const question: RatingQuestion = {
  id: "rating",
  type: "rating",
  prompt: "Hvor fornøyd er du?",
  required: true,
};

describe("RatingFieldset accessible naming", () => {
  it("renders the prompt exactly once in the DOM", () => {
    render(
      <RatingQuestionField
        question={question}
        value={undefined}
        onChange={() => {}}
        validationErrorMessage="Velg en vurdering"
        isMissing={false}
        disabled={false}
      />,
    );

    expect(screen.getAllByText("Hvor fornøyd er du?")).toHaveLength(1);
  });

  it("exposes exactly one named group: the radiogroup", () => {
    render(
      <RatingQuestionField
        question={question}
        value={undefined}
        onChange={() => {}}
        validationErrorMessage="Velg en vurdering"
        isMissing={false}
        disabled={false}
      />,
    );

    const radiogroup = screen.getByRole("radiogroup", {
      name: "Hvor fornøyd er du?",
    });
    expect(radiogroup).toBeInTheDocument();

    // The fieldset must not appear as a second, separately named group
    // wrapped around the radiogroup.
    expect(
      screen.queryByRole("group", { name: "Hvor fornøyd er du?" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the prompt reachable as a level 3 heading", () => {
    render(
      <RatingQuestionField
        question={question}
        value={undefined}
        onChange={() => {}}
        validationErrorMessage="Velg en vurdering"
        isMissing={false}
        disabled={false}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Hvor fornøyd er du?" }),
    ).toBeInTheDocument();
  });

  it("does not duplicate an external prompt heading in the hidden legend", () => {
    render(
      <>
        <h2 id="external-heading">Hvor fornøyd er du?</h2>
        <RatingQuestionField
          question={question}
          value={undefined}
          onChange={() => {}}
          validationErrorMessage="Velg en vurdering"
          isMissing={false}
          disabled={false}
          hidePrompt
          ariaLabelledBy="external-heading"
        />
      </>,
    );

    const radiogroup = screen.getByRole("radiogroup", {
      name: "Hvor fornøyd er du?",
    });
    expect(radiogroup).toHaveAttribute("aria-labelledby", "external-heading");

    // The prompt text must only exist once outside the widget; the sr-only
    // legend copy must be hidden from the accessibility tree.
    const copies = screen.getAllByText("Hvor fornøyd er du?");
    const visibleToAssistiveTech = copies.filter(
      (el) => !el.closest("[aria-hidden='true']"),
    );
    expect(visibleToAssistiveTech).toHaveLength(1);
  });

  it("keeps the sr-only legend as name source when the prompt is hidden without an external label", () => {
    render(
      <RatingQuestionField
        question={question}
        value={undefined}
        onChange={() => {}}
        validationErrorMessage="Velg en vurdering"
        isMissing={false}
        disabled={false}
        hidePrompt
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Hvor fornøyd er du?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
