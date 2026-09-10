import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StageSurface } from "../StageSurface";

const survey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  pages: [
    {
      id: "first",
      questions: [{ id: "q1", type: "text", prompt: "Hva fungerte?" }],
    },
    {
      id: "second",
      questions: [{ id: "q2", type: "text", prompt: "Hva kan bli bedre?" }],
    },
  ],
};

const props = {
  document: survey,
  instanceKey: 1,
  surveyId: "stage-test",
  environmentTag: "test",
  successTitle: "Takk",
  successBody: "Takk for hjelpen",
};

const observers = new Map<Element, (entries: ResizeObserverEntry[]) => void>();

function resize(element: Element, width: number, height: number) {
  const callback = observers.get(element);
  if (!callback) throw new Error("Stage viewport is not being observed");
  act(() => {
    callback([
      {
        target: element,
        contentRect: { width, height },
      } as ResizeObserverEntry,
    ]);
  });
}

beforeEach(() => {
  observers.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private targets = new Set<Element>();
      constructor(private callback: (entries: ResizeObserverEntry[]) => void) {}
      observe(element: Element) {
        this.targets.add(element);
        observers.set(element, this.callback);
      }
      unobserve(element: Element) {
        this.targets.delete(element);
        observers.delete(element);
      }
      disconnect() {
        for (const element of this.targets) observers.delete(element);
        this.targets.clear();
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StageSurface respondent viewport", () => {
  it("keeps normal text size in the roomy view, including narrow screens, without resetting answers", async () => {
    const user = userEvent.setup();
    const { container } = render(<StageSurface {...props} roomy />);
    const viewport = container.firstElementChild as HTMLElement;
    const canvas = viewport.firstElementChild as HTMLElement;
    resize(viewport, 432, 720);

    const dock = await screen.findByRole("complementary", {
      name: "Tilbakemeldingspanel",
    });
    expect(dock).toHaveStyle({ width: "384px" });
    expect(canvas).toHaveStyle({ transform: "scale(1)", height: "720px" });
    const input = screen.getByRole("textbox");
    await user.type(input, "God informasjon");

    resize(viewport, 320, 650);
    expect(dock).toHaveStyle({ width: "288px" });
    expect(canvas).toHaveStyle({
      transform: "scale(1)",
      width: "320px",
      height: "650px",
    });
    expect(screen.getByRole("textbox")).toHaveValue("God informasjon");

    resize(viewport, 480, 850);
    expect(canvas).toHaveStyle({ transform: "scale(1)", height: "850px" });
    expect(screen.getByRole("textbox")).toHaveValue("God informasjon");
  });

  it("retains miniature scaling by default and survives a temporarily hidden viewport", async () => {
    const { container, unmount } = render(<StageSurface {...props} />);
    const viewport = container.firstElementChild as HTMLElement;
    const canvas = viewport.firstElementChild as HTMLElement;
    resize(viewport, 312, 384);
    await screen.findByRole("complementary", { name: "Tilbakemeldingspanel" });
    expect(canvas).toHaveStyle({
      transform: "scale(0.75)",
      width: "416px",
      height: "512px",
    });

    resize(viewport, 0, 0);
    expect(canvas).toHaveStyle({
      transform: "scale(0.75)",
      width: "416px",
      height: "512px",
    });
    resize(viewport, 480, 560);
    expect(canvas).toHaveStyle({ transform: "scale(1)", height: "560px" });
    unmount();
    expect(observers.has(viewport)).toBe(false);
  });

  it("allows the editor to hide progress while retaining the default for other previews", async () => {
    const { rerender } = render(<StageSurface {...props} />);
    expect(
      await screen.findByLabelText("Fremdrift i undersøkelsen"),
    ).toBeInTheDocument();
    rerender(<StageSurface {...props} showProgress={false} />);
    expect(
      screen.queryByLabelText("Fremdrift i undersøkelsen"),
    ).not.toBeInTheDocument();
  });
});
