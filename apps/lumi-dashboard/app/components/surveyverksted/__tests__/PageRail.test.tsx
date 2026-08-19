import type { SurveyPageV1 } from "@navikt/lumi-survey";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageRail } from "~/components/surveyverksted/PageRail";

const noop = () => {};

function makePage(over: Partial<SurveyPageV1> = {}): SurveyPageV1 {
  return {
    id: "side-a",
    questions: [
      {
        id: "q1",
        type: "rating",
        prompt: "Hvordan opplevde du tjenesten?",
        variant: "emoji",
        required: true,
      },
    ],
    ...over,
  };
}

function renderRail(pages: SurveyPageV1[]) {
  return render(
    <PageRail
      pages={pages}
      selectedPageId={pages[0].id}
      onSelect={noop}
      onAdd={noop}
      onMove={noop}
      onReorder={noop}
      onDuplicate={noop}
      onDelete={noop}
    />,
  );
}

describe("PageRail", () => {
  it("labels a page by its title when the author set one", () => {
    renderRail([makePage({ title: "Om opplevelsen" })]);

    expect(
      screen.getByRole("button", { name: /Om opplevelsen/ }),
    ).toBeInTheDocument();
  });

  it("falls back to the first question rather than calling the page untitled", () => {
    // Most pages hold a single question and need no group heading, so the
    // rail must stay readable without one.
    renderRail([makePage()]);

    expect(
      screen.getByRole("button", { name: /Hvordan opplevde du tjenesten\?/ }),
    ).toBeInTheDocument();
  });

  it("falls back to the page number when the prompt is still empty", () => {
    renderRail([
      makePage({
        questions: [{ id: "q1", type: "text", prompt: "   " }],
      }),
    ]);

    expect(screen.getByRole("button", { name: /Side 1/ })).toBeInTheDocument();
  });
});
