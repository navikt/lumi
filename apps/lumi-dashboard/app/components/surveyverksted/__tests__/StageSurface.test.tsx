import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeLiveVisibility } from "~/utils/liveVisibility";
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

describe("StageSurface at the content", () => {
  const atContent = {
    mode: "inline" as const,
    placementNote: "Under resultatlisten",
  };

  it("shows the real inline survey below content that is marked as an example", () => {
    const { container } = render(
      <StageSurface {...props} presentation={atContent} />,
    );

    // The inline component, not the docked panel.
    expect(container.querySelector(".lumi-survey-inline")).not.toBeNull();
    expect(
      container.querySelector('aside[aria-label="Tilbakemeldingspanel"]'),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Lukk" })).toBeNull();

    const example = screen.getByText("Eksempelinnhold")
      .parentElement as HTMLElement;
    expect(example).toHaveTextContent(
      "Her står innholdet i appen som surveyen spør om.",
    );
    expect(example).toHaveTextContent("Plassering: Under resultatlisten");
    // The example comes before the survey in the page.
    const survey = container.querySelector(".lumi-survey-inline") as Element;
    expect(
      example.compareDocumentPosition(survey) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows no placement line when the author has written no note", () => {
    render(
      <StageSurface
        {...props}
        presentation={{ mode: "inline", placementNote: null }}
      />,
    );

    expect(screen.getByText("Eksempelinnhold")).toBeInTheDocument();
    expect(screen.queryByText("Plassering:")).toBeNull();
  });

  it("lays the page out for the width the author chooses", () => {
    const { container, rerender } = render(
      <StageSurface {...props} presentation={atContent} inlineWidth="full" />,
    );
    const page = () =>
      container.querySelector("[data-mode='inline'] [data-width]");
    expect(page()).toHaveAttribute("data-width", "full");

    rerender(
      <StageSurface {...props} presentation={atContent} inlineWidth="column" />,
    );
    expect(page()).toHaveAttribute("data-width", "column");

    rerender(
      <StageSurface {...props} presentation={atContent} inlineWidth="mobile" />,
    );
    expect(page()).toHaveAttribute("data-width", "mobile");
  });

  it("shows questions for phones only when the page is as narrow as a phone", () => {
    const mobileOnly: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "side",
          questions: [
            {
              id: "kun-mobil",
              type: "text",
              prompt: "Hvordan var det på mobil?",
              visibleIf: {
                field: "METADATA",
                key: "deviceType",
                operator: "EQ",
                value: "mobile",
              },
            },
            { id: "alltid", type: "text", prompt: "Noe mer?" },
          ],
        },
      ],
    };
    const { container, rerender } = render(
      <StageSurface
        {...props}
        document={mobileOnly}
        presentation={atContent}
        inlineWidth="full"
      />,
    );
    resize(container.firstElementChild as HTMLElement, 1200, 700);
    expect(
      screen.queryByRole("textbox", { name: /Hvordan var det på mobil\?/ }),
    ).toBeNull();

    rerender(
      <StageSurface
        {...props}
        document={mobileOnly}
        presentation={atContent}
        inlineWidth="mobile"
      />,
    );
    expect(
      screen.getByRole("textbox", { name: /Hvordan var det på mobil\?/ }),
    ).toBeInTheDocument();
  });

  it("keeps the answers when the author changes the width of the preview", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <StageSurface {...props} presentation={atContent} inlineWidth="full" />,
    );
    await user.type(screen.getByRole("textbox"), "Et svar");

    rerender(
      <StageSurface {...props} presentation={atContent} inlineWidth="mobile" />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Et svar");
  });

  it("starts a fresh respondent when the author changes the display", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();
    const { rerender } = render(
      <StageSurface {...props} onAnswersChange={onAnswersChange} />,
    );
    await user.type(await screen.findByRole("textbox"), "A");
    expect(onAnswersChange).toHaveBeenLastCalledWith({ q1: "A" });

    rerender(
      <StageSurface
        {...props}
        presentation={atContent}
        onAnswersChange={onAnswersChange}
      />,
    );

    // The new widget has no answers, and the editor is told so.
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(onAnswersChange).toHaveBeenLastCalledWith({});
  });

  it("shows the questions the tags of the embed example show", async () => {
    const question = (id: string, key: string, value: string) => ({
      id,
      type: "text" as const,
      prompt: `Spørsmål for ${value}`,
      visibleIf: {
        field: "METADATA" as const,
        key,
        operator: "EQ" as const,
        value,
      },
    });
    const byTags: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "side",
          questions: [
            question("flate", "surface", "inline"),
            question("sted", "placement", "under-resultatlisten"),
            { id: "alltid", type: "text", prompt: "Noe mer?" },
          ],
        },
      ],
    };
    const { rerender } = render(
      <StageSurface {...props} document={byTags} presentation={atContent} />,
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(3);

    // The example for the floating panel sets no such tags.
    rerender(<StageSurface {...props} document={byTags} />);
    expect(
      await screen.findByRole("textbox", { name: /Noe mer\?/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("reports the page it shows the survey on, so the editor marks the questions the survey shows", async () => {
    const user = userEvent.setup();
    const shownBy = (key: string, value: string) => ({
      field: "METADATA" as const,
      key,
      operator: "EQ" as const,
      value,
    });
    const document: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "side",
          questions: [
            {
              id: "fant",
              type: "singleChoice",
              prompt: "Fant du det du lette etter?",
              options: [
                { value: "ja", label: "Ja" },
                { value: "nei", label: "Nei" },
              ],
              visibleIf: shownBy("placement", "under-resultatlisten"),
            },
            {
              id: "hva",
              type: "text",
              prompt: "Hva fant du?",
              visibleIf: { questionId: "fant", operator: "EQ", value: "ja" },
            },
            {
              id: "mobil",
              type: "text",
              prompt: "Hvordan var det på mobil?",
              visibleIf: shownBy("deviceType", "mobile"),
            },
            {
              id: "pc",
              type: "text",
              prompt: "Hvordan var det på PC?",
              visibleIf: shownBy("deviceType", "desktop"),
            },
          ],
        },
      ],
    };
    const prompts = Object.fromEntries(
      document.pages[0].questions.map((question) => [
        question.id,
        question.prompt,
      ]),
    );
    const onViewportChange = vi.fn();
    const onAnswersChange = vi.fn();
    const stage = (
      presentation: typeof atContent,
      inlineWidth: "full" | "mobile",
    ) => (
      <StageSurface
        {...props}
        document={document}
        presentation={presentation}
        inlineWidth={inlineWidth}
        onViewportChange={onViewportChange}
        onAnswersChange={onAnswersChange}
      />
    );
    // What the editor marks, next to what the real survey shows.
    const compare = (presentation: typeof atContent) => {
      const marked = computeLiveVisibility(
        document,
        onAnswersChange.mock.lastCall?.[0] ?? {},
        props.environmentTag,
        presentation,
        onViewportChange.mock.lastCall?.[0],
      );
      // The prompt of the first question is also the survey's heading.
      const shown = Object.fromEntries(
        Object.entries(prompts).map(([id, prompt]) => [
          id,
          screen.queryAllByText(prompt).length > 0,
        ]),
      );
      expect(Object.fromEntries(marked)).toEqual(shown);
      return shown;
    };

    const { container, rerender } = render(stage(atContent, "full"));
    resize(container.firstElementChild as HTMLElement, 1200, 700);
    expect(onViewportChange).toHaveBeenLastCalledWith({
      width: 1200,
      height: 700,
    });
    expect(compare(atContent)).toEqual({
      fant: true,
      hva: false,
      mobil: false,
      pc: true,
    });

    await user.click(screen.getByRole("radio", { name: "Ja" }));
    expect(compare(atContent)).toMatchObject({ hva: true });

    rerender(stage(atContent, "mobile"));
    expect(onViewportChange).toHaveBeenLastCalledWith({
      width: 360,
      height: 700,
    });
    expect(compare(atContent)).toMatchObject({ mobil: true, pc: false });

    // Another placement hides the first question. The survey keeps its
    // answer, and hides the question that follows it too.
    const elsewhere = { mode: "inline" as const, placementNote: "Øverst" };
    rerender(stage(elsewhere, "mobile"));
    expect(onAnswersChange).toHaveBeenLastCalledWith({ fant: "ja" });
    expect(compare(elsewhere)).toEqual({
      fant: false,
      hva: false,
      mobil: true,
      pc: false,
    });
  });

  it("reports the answers from the inline survey as it does from the panel", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();
    render(
      <StageSurface
        {...props}
        presentation={atContent}
        onAnswersChange={onAnswersChange}
      />,
    );

    await user.type(screen.getByRole("textbox"), "A");

    expect(onAnswersChange).toHaveBeenLastCalledWith({ q1: "A" });
  });

  it("reports an answer to a question with the id __proto__ as an answer", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();
    const protoDocument: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "side",
          questions: [
            { id: "__proto__", type: "text", prompt: "Hva tenker du?" },
          ],
        },
      ],
    };
    render(
      <StageSurface
        {...props}
        document={protoDocument}
        presentation={atContent}
        onAnswersChange={onAnswersChange}
      />,
    );

    await user.type(screen.getByRole("textbox"), "A");

    const answers = onAnswersChange.mock.lastCall?.[0];
    expect(Object.keys(answers)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(answers)).toBe(Object.prototype);
  });

  it("tells the editor that the answers are gone when a new survey id starts the inline survey over", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();
    const { rerender } = render(
      <StageSurface
        {...props}
        presentation={atContent}
        onAnswersChange={onAnswersChange}
      />,
    );
    await user.type(screen.getByRole("textbox"), "A");
    expect(onAnswersChange).toHaveBeenLastCalledWith({ q1: "A" });

    rerender(
      <StageSurface
        {...props}
        surveyId={`${props.surveyId}-ny`}
        presentation={atContent}
        onAnswersChange={onAnswersChange}
      />,
    );

    // A new surveyId is a new survey to LumiSurveyInline.
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(onAnswersChange).toHaveBeenLastCalledWith({});
  });

  it("keeps the answers of the floating panel when the survey id changes", async () => {
    const user = userEvent.setup();
    const onAnswersChange = vi.fn();
    const { rerender } = render(
      <StageSurface {...props} onAnswersChange={onAnswersChange} />,
    );
    await user.type(await screen.findByRole("textbox"), "A");

    rerender(
      <StageSurface
        {...props}
        surveyId={`${props.surveyId}-ny`}
        onAnswersChange={onAnswersChange}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("A");
    expect(onAnswersChange).toHaveBeenLastCalledWith({ q1: "A" });
  });
});
