import {
  SPECIALIZED_SURVEY_FIELD_IDS,
  type SurveyQuestionV1,
} from "@navikt/lumi-survey";
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
  contractLocked?: boolean;
  onChange?: (
    updater: (question: SurveyQuestionV1) => SurveyQuestionV1,
  ) => void;
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
      contractLocked={options?.contractLocked}
      onExpand={options?.onExpand ?? noop}
      onCollapse={options?.onCollapse ?? noop}
      onChange={options?.onChange ?? noop}
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

  it("summarizes a searchable multi-choice field when collapsed", () => {
    renderCard({
      question: {
        id: "choice-1",
        type: "multiChoice",
        prompt: "Hva er viktigst?",
        variant: "combobox",
        options: [
          { value: "one", label: "Første valg" },
          { value: "two", label: "Andre valg" },
        ],
      },
    });

    expect(
      screen.getByText("Flervalg · Søkbart felt · 2 alternativer"),
    ).toBeVisible();
    const preview = document.querySelector<HTMLElement>("[data-mini-preview]");
    expect(preview).not.toBeNull();
    expect(
      within(preview as HTMLElement).getByRole("combobox", { hidden: true }),
    ).toBeInTheDocument();
  });

  it("expands when the card button is clicked", async () => {
    const onExpand = vi.fn();
    renderCard({ onExpand });
    await userEvent.click(screen.getByRole("button", { name: /hvordan/i }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});

describe("QuestionCard collapsed condition indicator", () => {
  it("shows the condition count when several conditions gate the question", () => {
    renderCard({
      question: {
        ...ratingQuestion,
        id: "gated",
        visibleIf: {
          any: [
            { questionId: "a", operator: "EXISTS" },
            { questionId: "b", operator: "EXISTS" },
          ],
        },
      },
    });
    expect(screen.getByText("Vises betinget · 2")).toBeInTheDocument();
  });

  it("shows no count for a single condition", () => {
    renderCard({
      question: {
        ...ratingQuestion,
        id: "gated",
        visibleIf: { questionId: "a", operator: "EXISTS" },
      },
    });
    expect(screen.getByText("Vises betinget")).toBeInTheDocument();
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

  it("uses form radios to change the rating scale", async () => {
    const onChange = vi.fn();
    renderCard({ expanded: true, onChange });

    expect(screen.getByRole("group", { name: "Skala" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "NPS" }));

    const updater = onChange.mock.calls[0]?.[0];
    expect(updater).toBeTypeOf("function");
    expect(updater(ratingQuestion)).toMatchObject({ variant: "nps" });
  });

  it("lets authors randomize choice options in plain language", async () => {
    const question: SurveyQuestionV1 = {
      id: "choice-1",
      type: "singleChoice",
      prompt: "Hva vil du gjøre?",
      options: [
        { value: "one", label: "Første valg" },
        { value: "two", label: "Andre valg" },
      ],
    };
    const onChange = vi.fn();
    renderCard({ expanded: true, question, onChange });

    await userEvent.click(
      screen.getByRole("checkbox", { name: /^Bland rekkefølgen/ }),
    );

    const updater = onChange.mock.calls[0]?.[0];
    expect(updater).toBeTypeOf("function");
    expect(updater(question)).toMatchObject({ randomize: true });
    expect(
      screen.getByRole("checkbox", { name: /^Bland rekkefølgen/ }),
    ).toHaveAccessibleName(/alternativene øverst får flere svar/i);
  });

  it.each([
    "singleChoice",
    "multiChoice",
  ] as const)("removes randomization from a %s question when switched off", async (type) => {
    const question: SurveyQuestionV1 = {
      id: "choice-1",
      type,
      prompt: "Hva vil du gjøre?",
      randomize: true,
      options: [
        { value: "one", label: "Første valg" },
        { value: "two", label: "Andre valg" },
      ],
    };
    const onChange = vi.fn();
    renderCard({ expanded: true, question, onChange });

    await userEvent.click(
      screen.getByRole("checkbox", { name: /^Bland rekkefølgen/ }),
    );

    const updater = onChange.mock.calls[0]?.[0];
    expect(updater).toBeTypeOf("function");
    expect(updater(question)).not.toHaveProperty("randomize");
  });

  it("keeps the ordered analysis outcome from being randomized", () => {
    const question: SurveyQuestionV1 = {
      id: SPECIALIZED_SURVEY_FIELD_IDS.success,
      type: "singleChoice",
      prompt: "Fikk du gjort det?",
      required: true,
      options: [
        { value: "yes", label: "Ja" },
        { value: "partial", label: "Delvis" },
        { value: "no", label: "Nei" },
      ],
    };
    renderCard({ expanded: true, question, contractLocked: true });

    expect(
      screen.queryByRole("checkbox", { name: /^Bland rekkefølgen/ }),
    ).not.toBeInTheDocument();
  });

  it("lets authors choose a searchable field for multi-choice questions", async () => {
    const question: SurveyQuestionV1 = {
      id: "choice-1",
      type: "multiChoice",
      prompt: "Hva er viktigst?",
      options: [
        { value: "one", label: "Første valg" },
        { value: "two", label: "Andre valg" },
      ],
    };
    const onChange = vi.fn();
    renderCard({ expanded: true, question, onChange });

    await userEvent.click(screen.getByRole("radio", { name: "Søkbart felt" }));

    const updater = onChange.mock.calls.at(-1)?.[0];
    expect(updater).toBeTypeOf("function");
    expect(updater(question)).toMatchObject({ variant: "combobox" });
    expect(
      screen.getByRole("group", {
        name: /^Slik vises svaralternativene/,
      }),
    ).toHaveAccessibleName(/opptil 6 alternativer/i);
  });

  it("restores the default checkbox presentation without keeping stale data", async () => {
    const question: SurveyQuestionV1 = {
      id: "choice-1",
      type: "multiChoice",
      prompt: "Hva er viktigst?",
      variant: "combobox",
      options: [
        { value: "one", label: "Første valg" },
        { value: "two", label: "Andre valg" },
      ],
    };
    const onChange = vi.fn();
    renderCard({ expanded: true, question, onChange });

    await userEvent.click(screen.getByRole("radio", { name: "Avkryssing" }));

    const updater = onChange.mock.calls.at(-1)?.[0];
    expect(updater).toBeTypeOf("function");
    expect(updater(question)).not.toHaveProperty("variant");
  });

  it("does not show choice settings for rating questions", () => {
    renderCard({ expanded: true });
    expect(
      screen.queryByRole("checkbox", { name: "Bland rekkefølgen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Slik vises svaralternativene"),
    ).not.toBeInTheDocument();
  });
});
