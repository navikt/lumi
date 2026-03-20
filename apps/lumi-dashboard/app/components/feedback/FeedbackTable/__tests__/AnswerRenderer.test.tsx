import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Answer } from "~/types/api";
import { RenderAnswer } from "../AnswerRenderer";

const styles = {
  answerCard: "answerCard",
  answerIcon: "answerIcon",
  answerContentGrow: "answerContentGrow",
  answerContent: "answerContent",
  clickableTag: "clickableTag",
  choiceOptions: "choiceOptions",
  unselectedOption: "unselectedOption",
  iconWarning: "iconWarning",
  iconInfo: "iconInfo",
  iconThumbPositive: "iconThumbPositive",
  iconThumbNegative: "iconThumbNegative",
  answerEmpty: "answerEmpty",
  ratingBadge: "ratingBadge",
  ratingBadgeThumbPositive: "ratingBadgeThumbPositive",
  ratingBadgeThumbNegative: "ratingBadgeThumbNegative",
  ratingBadgePromoter: "ratingBadgePromoter",
  ratingBadgePassive: "ratingBadgePassive",
  ratingBadgeDetractor: "ratingBadgeDetractor",
  starsVisual: "starsVisual",
  ratingScore: "ratingScore",
  ratingBar: "ratingBar",
  ratingDot: "ratingDot",
  ratingDotFilled: "ratingDotFilled",
};

describe("AnswerRenderer", () => {
  it("calls onChoiceFilter with fieldId and optionId when selected Tag is clicked", async () => {
    const user = userEvent.setup();
    const onChoiceFilter = vi.fn();

    const answer: Answer = {
      fieldId: "task_choice",
      fieldType: "SINGLE_CHOICE",
      question: {
        label: "Hva skulle du gjøre?",
        options: [
          { id: "opt-1", label: "Søknad" },
          { id: "opt-2", label: "Oppfølging" },
        ],
      },
      value: { type: "singleChoice", selectedOptionId: "opt-1" },
    };

    render(
      <RenderAnswer
        answer={answer}
        styles={styles}
        onChoiceFilter={onChoiceFilter}
      />,
    );

    await user.click(screen.getByText("Søknad"));

    expect(onChoiceFilter).toHaveBeenCalledWith("task_choice", "opt-1");
  });
});
