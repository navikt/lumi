import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
  it("renders selected choice options as pills with a checkmark", () => {
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

    render(<RenderAnswer answer={answer} styles={styles} />);

    expect(screen.getByText("✓ Søknad")).toBeInTheDocument();
    expect(screen.getByText("Oppfølging")).toBeInTheDocument();
  });
});
