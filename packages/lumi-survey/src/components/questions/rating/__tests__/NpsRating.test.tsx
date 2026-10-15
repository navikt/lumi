import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NpsRatingQuestion } from "../../../../core/types.js";
import { NpsRating } from "../NpsRating.js";

const question: NpsRatingQuestion = {
  id: "nps",
  type: "rating",
  variant: "nps",
  prompt: "Hvor sannsynlig er det at du anbefaler oss?",
};

describe("NpsRating layout", () => {
  it("leaves the row layout to the stylesheet", () => {
    render(
      <NpsRating
        question={question}
        value={undefined}
        onChange={() => {}}
        validationErrorMessage="Velg et tall"
        isMissing={false}
        disabled={false}
      />,
    );

    const firstButton = screen.getByRole("radio", { name: "0 av 10" });
    const scale = firstButton.parentElement as HTMLElement;

    expect(scale).toHaveClass("lumi-survey-rating__nps-scale");
    // nps.fallback.css wraps the scale in narrow layouts. An inline grid
    // would override it, and clipping hid the focus ring and cut off "10".
    expect(scale.style.display).toBe("");
    expect(scale.style.gridTemplateColumns).toBe("");
    expect(scale.style.overflow).toBe("");
    expect(screen.getAllByRole("radio")).toHaveLength(11);
  });
});
