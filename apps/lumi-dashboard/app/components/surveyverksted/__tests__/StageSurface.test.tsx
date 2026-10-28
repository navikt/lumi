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

  it("reports each page the respondent reaches, from the requested start", async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const { rerender } = render(
      <StageSurface {...props} roomy onStepChange={onStepChange} />,
    );
    expect(
      await screen.findByRole("textbox", { name: /Hva fungerte/ }),
    ).toBeInTheDocument();
    expect(onStepChange).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(
      await screen.findByRole("textbox", { name: /Hva kan bli bedre/ }),
    ).toBeInTheDocument();
    expect(onStepChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tilbake" }));
    expect(onStepChange).toHaveBeenLastCalledWith(0);

    onStepChange.mockClear();
    rerender(
      <StageSurface
        {...props}
        roomy
        initialPageId="second"
        onStepChange={onStepChange}
      />,
    );
    expect(
      await screen.findByRole("textbox", { name: /Hva kan bli bedre/ }),
    ).toBeInTheDocument();
    expect(onStepChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("keeps the respondent when a following parent moves the page, and resets to that page on close", async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const following = (initialPageId: string) => (
      <StageSurface
        {...props}
        roomy
        restartOnPageChange={false}
        initialPageId={initialPageId}
        onStepChange={onStepChange}
      />
    );
    const { rerender } = render(following("first"));
    await user.type(
      await screen.findByRole("textbox", { name: /Hva fungerte/ }),
      "God informasjon",
    );
    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(onStepChange).toHaveBeenLastCalledWith(1);

    rerender(following("second"));
    await user.click(screen.getByRole("button", { name: "Tilbake" }));
    expect(screen.getByRole("textbox", { name: /Hva fungerte/ })).toHaveValue(
      "God informasjon",
    );
    await user.click(screen.getByRole("button", { name: "Neste" }));

    onStepChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Lukk" }));
    await user.click(screen.getByRole("button", { name: "Gi tilbakemelding" }));
    expect(
      await screen.findByRole("textbox", { name: /Hva kan bli bedre/ }),
    ).toBeInTheDocument();
    expect(onStepChange).not.toHaveBeenCalled();
    // A fresh respondent: the reset page is the start, with nothing behind it.
    expect(
      screen.queryByRole("button", { name: "Tilbake" }),
    ).not.toBeInTheDocument();

    // A new nonce still restarts the respondent on the current page.
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByRole("heading", { name: "Takk" }),
    ).toBeInTheDocument();
    rerender(
      <StageSurface
        {...props}
        roomy
        restartOnPageChange={false}
        initialPageId="second"
        nonce={1}
        onStepChange={onStepChange}
      />,
    );
    expect(
      await screen.findByRole("textbox", { name: /Hva kan bli bedre/ }),
    ).toHaveValue("");
    expect(onStepChange).toHaveBeenLastCalledWith(1);
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
