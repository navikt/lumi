import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CanonicalSurveyPage } from "../../../shared/canonicalSurvey.js";
import { usePageNavigation } from "../usePageNavigation.js";

const PAGES: CanonicalSurveyPage[] = [
  {
    id: "first",
    questions: [
      {
        id: "choice",
        type: "singleChoice",
        prompt: "Velg",
        required: true,
        options: [
          { value: "yes", label: "Ja" },
          { value: "no", label: "Nei" },
        ],
      },
      {
        id: "reason",
        type: "text",
        prompt: "Begrunn",
        required: true,
      },
    ],
  },
  {
    id: "conditional",
    questions: [
      {
        id: "details",
        type: "text",
        prompt: "Fortell mer",
        visibleIf: {
          questionId: "choice",
          operator: "EQ",
          value: "yes",
        },
      },
    ],
  },
  {
    id: "last",
    questions: [
      {
        id: "comment",
        type: "text",
        prompt: "Kommentar",
      },
    ],
  },
];

describe("usePageNavigation", () => {
  it("validates every visible question on the current page", () => {
    const { result, rerender } = renderHook(
      ({ answers }) =>
        usePageNavigation({
          pages: PAGES,
          answers,
          autoStepMode: true,
        }),
      { initialProps: { answers: {} } },
    );

    expect(result.current.currentPage?.id).toBe("first");
    expect(result.current.currentPageQuestions.map(({ id }) => id)).toEqual([
      "choice",
      "reason",
    ]);
    expect(result.current.canGoNext).toBe(false);

    rerender({ answers: { choice: "yes", reason: "Fordi" } });
    expect(result.current.canGoNext).toBe(true);
  });

  it("skips hidden pages and returns through the visited page history", () => {
    const answers = { choice: "no", reason: "Fordi" };
    const { result } = renderHook(() =>
      usePageNavigation({ pages: PAGES, answers, autoStepMode: true }),
    );

    act(() => {
      result.current.goToNext();
    });
    expect(result.current.currentPage?.id).toBe("last");
    expect(result.current.visitedSteps).toEqual([0, 2]);

    act(() => {
      result.current.goToPrevious();
    });
    expect(result.current.currentPage?.id).toBe("first");
    expect(result.current.visitedSteps).toEqual([0]);
  });

  it("treats only conditionally visible pages as uncertain progress", () => {
    const pageWithConditionalExtra: CanonicalSurveyPage = {
      id: "stable",
      questions: [
        PAGES[2].questions[0],
        {
          ...PAGES[1].questions[0],
          id: "conditional-extra",
        },
      ],
    };

    const { result } = renderHook(() =>
      usePageNavigation({
        pages: [PAGES[0], pageWithConditionalExtra],
        answers: {},
        autoStepMode: true,
      }),
    );

    expect(result.current.hasBranching).toBe(false);
  });

  it("uses the current visible path to choose the submit button", () => {
    const pages = PAGES.slice(0, 2);
    const { result, rerender } = renderHook(
      ({ answers }) =>
        usePageNavigation({ pages, answers, autoStepMode: true }),
      {
        initialProps: {
          answers: {} as Record<string, string>,
        },
      },
    );

    expect(result.current.isLastStep).toBe(true);

    rerender({ answers: { choice: "yes", reason: "Fordi" } });
    expect(result.current.isLastStep).toBe(false);

    rerender({ answers: { choice: "no", reason: "Fordi" } });
    expect(result.current.isLastStep).toBe(true);
  });

  it("recovers when metadata makes the first page visible", async () => {
    const pages: CanonicalSurveyPage[] = [
      {
        id: "metadata-page",
        questions: [
          {
            id: "metadata-question",
            type: "text",
            prompt: "Metadata question",
            visibleIf: {
              field: "METADATA",
              key: "ready",
              operator: "EQ",
              value: true,
            },
          },
        ],
      },
    ];
    const onStepChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ metadata }) =>
        usePageNavigation({
          pages,
          answers: {},
          metadata,
          autoStepMode: true,
          onStepChange,
        }),
      { initialProps: { metadata: {} as Record<string, unknown> } },
    );

    expect(result.current.currentStep).toBe(-1);
    expect(result.current.currentPage).toBeUndefined();
    expect(onStepChange).not.toHaveBeenCalled();

    rerender({ metadata: { ready: true } });

    await waitFor(() => expect(result.current.currentStep).toBe(0));
    expect(result.current.currentPage?.id).toBe("metadata-page");
    expect(onStepChange).toHaveBeenCalledWith(0, 1);
  });

  it("does not reset navigation for a structurally identical pages prop", () => {
    const answers = { choice: "no", reason: "Fordi" };
    const { result, rerender } = renderHook(
      ({ pages }) => usePageNavigation({ pages, answers, autoStepMode: true }),
      { initialProps: { pages: PAGES } },
    );

    act(() => {
      result.current.goToNext();
    });
    expect(result.current.currentPage?.id).toBe("last");

    rerender({ pages: JSON.parse(JSON.stringify(PAGES)) });
    expect(result.current.currentPage?.id).toBe("last");
    expect(result.current.visitedSteps).toEqual([0, 2]);
  });
});
