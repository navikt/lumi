import type { SurveyPageV1 } from "@navikt/lumi-survey";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionCanvas } from "~/components/surveyverksted/QuestionCanvas";
import type { ReferenceableQuestion } from "~/utils/surveyDocument";

const page: SurveyPageV1 = {
  id: "page-1",
  title: "Side 1",
  questions: [
    {
      id: "q1",
      type: "rating",
      prompt: "Hvordan opplevde du tjenesten?",
      variant: "emoji",
      required: true,
    },
    {
      id: "q2",
      type: "text",
      prompt: "Fortell mer",
      required: false,
      visibleIf: { questionId: "q1", operator: "GT", value: 3 },
    },
  ],
};

const noop = () => {};

function canvasProps(
  referenceableByQuestion: ReadonlyMap<string, ReferenceableQuestion[]>,
) {
  return {
    page,
    pageNumber: 1,
    totalPages: 1,
    expandedIds: new Set(["q2"]),
    focusQuestionId: null,
    undo: null,
    onUndo: noop,
    onUndoExpire: noop,
    onExpand: noop,
    onCollapse: noop,
    onUpdatePage: noop,
    onQuestionChange: noop,
    onChangeType: noop,
    onDuplicate: noop,
    onDelete: noop,
    onMoveQuestion: noop,
    onReorderQuestion: noop,
    optionHandlersFor: () => ({
      onAdd: noop,
      onUpdateLabel: noop,
      onUpdateValue: noop,
      onRemove: noop,
      onMove: noop,
    }),
    referenceableByQuestion,
    suggestionsFor: () => [],
    onChangeVisibleIf: noop,
    onAddQuestion: noop,
  };
}

describe("QuestionCanvas condition freshness", () => {
  // Regression for a memo-staleness bug: the expanded card computed its
  // referenceable list behind the CanvasQuestion memo boundary, so a type
  // change on the REFERENCED question never reached an open editor.
  it("propagates a reference type change into an open condition editor", () => {
    const asRating = new Map<string, ReferenceableQuestion[]>([
      [
        "q2",
        [
          {
            id: "q1",
            prompt: "Hvordan opplevde du tjenesten?",
            type: "rating",
            pageNumber: 1,
            questionNumber: 1,
          },
        ],
      ],
    ]);
    // Every other prop keeps its identity across the rerender — exactly the
    // route contract (stable useCallbacks) — so only the map may invalidate
    // the CanvasQuestion memo.
    const stableProps = canvasProps(asRating);
    const { rerender } = render(<QuestionCanvas {...stableProps} />);
    expect(screen.queryByText(/passer ikke spørsmålet/i)).toBeNull();

    const asText = new Map<string, ReferenceableQuestion[]>([
      [
        "q2",
        [
          {
            id: "q1",
            prompt: "Hvordan opplevde du tjenesten?",
            type: "text",
            pageNumber: 1,
            questionNumber: 1,
          },
        ],
      ],
    ]);
    rerender(
      <QuestionCanvas {...stableProps} referenceableByQuestion={asText} />,
    );
    expect(screen.getByText(/passer ikke spørsmålet/i)).toBeVisible();
  });
});
