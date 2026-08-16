import type { SurveyQuestionV1 } from "@navikt/lumi-survey";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuestionCard } from "~/components/surveyverksted/QuestionCard";

const ratingQuestion: SurveyQuestionV1 = {
  id: "rating-1",
  type: "rating",
  prompt: "Hvordan opplevde du tjenesten?",
  variant: "emoji",
  required: true,
};

function renderCard(options?: {
  expanded?: boolean;
  question?: SurveyQuestionV1;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const noop = () => {};
  return render(
    <QuestionCard
      question={options?.question ?? ratingQuestion}
      index={0}
      expanded={options?.expanded ?? false}
      canDelete
      canMoveUp={false}
      canMoveDown
      onExpand={options?.onExpand ?? noop}
      onCollapse={options?.onCollapse ?? noop}
      onChange={noop}
      onChangeType={noop}
      onDuplicate={noop}
      onDelete={noop}
      onMove={noop}
    />,
  );
}

describe("QuestionCard collapsed", () => {
  it("renders exactly one button and shows the prompt", () => {
    const { container } = renderCard();
    const buttons = within(container as HTMLElement).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(buttons[0]).toHaveAccessibleName(/hvordan opplevde du tjenesten/i);
  });

  it("hides the mini preview from the accessibility tree", () => {
    const { container } = renderCard();
    const preview = (container as HTMLElement).querySelector(
      "[data-mini-preview]",
    );
    expect(preview).not.toBeNull();
    expect(preview).toHaveAttribute("aria-hidden", "true");
  });

  it("expands when the card button is clicked", async () => {
    const onExpand = vi.fn();
    renderCard({ onExpand });
    await userEvent.click(screen.getByRole("button", { name: /hvordan/i }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});

describe("QuestionCard expanded", () => {
  it("focuses the prompt field when the card transitions to expanded", () => {
    const noop = () => {};
    const props = {
      question: ratingQuestion,
      index: 0,
      canDelete: true,
      canMoveUp: false,
      canMoveDown: true,
      onExpand: noop,
      onCollapse: noop,
      onChange: noop,
      onChangeType: noop,
      onDuplicate: noop,
      onDelete: noop,
      onMove: noop,
    };
    const { rerender } = render(<QuestionCard {...props} expanded={false} />);
    rerender(<QuestionCard {...props} expanded={true} />);
    expect(screen.getByLabelText("Spørsmålstekst")).toHaveFocus();
  });

  it("does not steal focus when mounted already expanded", () => {
    renderCard({ expanded: true });
    expect(screen.getByLabelText("Spørsmålstekst")).not.toHaveFocus();
  });

  it("focuses the prompt on mount when focusOnMount is set", () => {
    const noop = () => {};
    render(
      <QuestionCard
        question={ratingQuestion}
        index={0}
        expanded
        focusOnMount
        canDelete
        canMoveUp={false}
        canMoveDown
        onExpand={noop}
        onCollapse={noop}
        onChange={noop}
        onChangeType={noop}
        onDuplicate={noop}
        onDelete={noop}
        onMove={noop}
      />,
    );
    expect(screen.getByLabelText("Spørsmålstekst")).toHaveFocus();
  });

  it("collapses when Escape is pressed inside the card", async () => {
    const onCollapse = vi.fn();
    renderCard({ expanded: true, onCollapse });
    await userEvent.click(screen.getByLabelText("Spørsmålstekst"));
    await userEvent.keyboard("{Escape}");
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("exposes a collapse toggle with aria-expanded=true", () => {
    renderCard({ expanded: true });
    expect(
      screen.getByRole("button", { name: /lukk redigering/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
