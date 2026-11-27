import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  resolveSurveyHeadingLevel,
  SurveyHeadingLevelProvider,
  useQuestionHeadingLevel,
  useSurveyHeadingLevel,
} from "../surveyHeadingLevel.js";

const Levels = () => (
  <span data-testid="levels">
    {useSurveyHeadingLevel()}/{useQuestionHeadingLevel()}
  </span>
);

describe("survey heading level", () => {
  it.each([
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["5", "5"],
    [3, "3"],
  ])("keeps level %j", (level, expected) => {
    expect(resolveSurveyHeadingLevel(level)).toBe(expected);
  });

  it.each([undefined, null, "1", "6", 0, 7, "h3", "", {}])(
    "falls back to level 2 for %j",
    (level) => {
      expect(resolveSurveyHeadingLevel(level)).toBe("2");
    },
  );

  it("uses level 2 for the survey and level 3 for its questions by default", () => {
    render(<Levels />);

    expect(screen.getByTestId("levels")).toHaveTextContent("2/3");
  });

  it("places the questions one level below the level from the provider", () => {
    render(
      <SurveyHeadingLevelProvider value="5">
        <Levels />
      </SurveyHeadingLevelProvider>,
    );

    expect(screen.getByTestId("levels")).toHaveTextContent("5/6");
  });
});
