import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SurveyPresentation } from "~/types/surveyAuthoring";
import {
  changePresentation,
  fitPlacementNote,
  type InlinePreviewWidth,
  PresentationControls,
} from "../PresentationControls";

function renderControls(
  initial: SurveyPresentation,
  options: { readOnly?: boolean } = {},
) {
  const onChange = vi.fn<(presentation: SurveyPresentation) => void>();
  const onInlineWidthChange = vi.fn<(width: InlinePreviewWidth) => void>();
  // biome-ignore lint/correctness/noComponentHookFactories: Created once per test, outside React rendering, to isolate its state.
  function Controlled() {
    const [presentation, setPresentation] = useState(initial);
    const [width, setWidth] = useState<InlinePreviewWidth>("full");
    return (
      <PresentationControls
        presentation={presentation}
        onChange={
          options.readOnly
            ? undefined
            : (next) => {
                onChange(next);
                setPresentation(next);
              }
        }
        inlineWidth={width}
        onInlineWidthChange={(next) => {
          onInlineWidthChange(next);
          setWidth(next);
        }}
      />
    );
  }
  render(<Controlled />);
  return { onChange, onInlineWidthChange };
}

describe("fitPlacementNote", () => {
  it("leaves an edit within the limit as it is, with the caret after it", () => {
    expect(fitPlacementNote("Under listen", "Under resultatlisten")).toEqual({
      note: "Under resultatlisten",
      caret: 14,
    });
    expect(fitPlacementNote("Under listen", "Under")).toEqual({
      note: "Under",
      caret: 5,
    });
  });

  it("cuts what was put in, wherever it was put", () => {
    const full = "a".repeat(200);
    expect(fitPlacementNote(full, `ny ${full}`)).toEqual({
      note: full,
      caret: 0,
    });
    expect(
      fitPlacementNote(`${"a".repeat(198)}bb`, `${"a".repeat(198)}XYbb`).note,
    ).toBe(`${"a".repeat(198)}bb`);
    // A selection replaced by a longer text keeps the room the selection had.
    expect(
      fitPlacementNote(
        `${"a".repeat(100)}${"b".repeat(100)}`,
        `${"a".repeat(98)}XYZ${"b".repeat(100)}`,
      ),
    ).toEqual({ note: `${"a".repeat(98)}XY${"b".repeat(100)}`, caret: 100 });
  });

  it("never splits an emoji, which is one character", () => {
    // Another emoji replaces one: they share the first of their two UTF-16
    // units.
    expect(fitPlacementNote("a😀b", "a😁b")).toEqual({
      note: "a😁b",
      caret: 3,
    });
    // An emoji after an emoji in a full note does not fit.
    const full = `${"a".repeat(198)}😀b`;
    expect(fitPlacementNote(full, `${"a".repeat(198)}😀😀b`).note).toBe(full);
    // Room for one character more takes the whole emoji.
    const almost = `${"a".repeat(198)}b`;
    expect(fitPlacementNote(almost, `${"a".repeat(198)}😀😀b`)).toEqual({
      note: `${"a".repeat(198)}😀b`,
      caret: 200,
    });
  });

  it("puts what was pasted on one line", () => {
    expect(fitPlacementNote("Under ", "Under listen\r\nfor søk")).toEqual({
      note: "Under listen for søk",
      caret: 20,
    });
  });

  it("cuts what replaced the selection, also when it begins and ends like the text it replaced", () => {
    // "ABC" is selected and "AXYBC" is pasted. Compared as text, "A" and
    // "BC" look kept and nothing fits between them. The selection says what
    // was replaced, and three characters of the paste fit.
    const previous = `${"X".repeat(197)}ABC`;
    const edited = `${"X".repeat(197)}AXYBC`;
    expect(fitPlacementNote(previous, edited).note).toBe(previous);
    expect(
      fitPlacementNote(previous, edited, { start: 197, end: 200 }),
    ).toEqual({ note: `${"X".repeat(197)}AXY`, caret: 200 });
  });

  it("compares the text when the selection does not fit the edit", () => {
    // Backspace removes the character before a collapsed selection.
    expect(
      fitPlacementNote("Under listen", "Under liste", { start: 12, end: 12 }),
    ).toEqual({ note: "Under liste", caret: 11 });
    // Undo brings back text in the middle, away from the caret at the end.
    expect(
      fitPlacementNote("Under listen", "Under resultatlisten", {
        start: 12,
        end: 12,
      }),
    ).toEqual({ note: "Under resultatlisten", caret: 14 });
  });
});

describe("changePresentation", () => {
  const atTheContent = {
    mode: "inline" as const,
    placementNote: "Under resultatlisten",
  };
  const asPanel = { mode: "dock" as const, placementNote: null };

  it("takes the note out when the author chooses the floating panel, and remembers it", () => {
    // The controls pass the note along when only the mode changes.
    expect(
      changePresentation(atTheContent, { ...atTheContent, mode: "dock" }, null),
    ).toEqual({
      presentation: asPanel,
      noteAtTheContent: "Under resultatlisten",
    });
  });

  it("puts the note back when the author chooses the content again", () => {
    expect(
      changePresentation(
        asPanel,
        { mode: "inline", placementNote: null },
        "Under resultatlisten",
      ),
    ).toEqual({
      presentation: atTheContent,
      noteAtTheContent: "Under resultatlisten",
    });
  });

  it("follows the note while the author writes it, also when it is emptied", () => {
    expect(
      changePresentation(
        atTheContent,
        { mode: "inline", placementNote: "Under listen" },
        "Under resultatlisten",
      ),
    ).toEqual({
      presentation: { mode: "inline", placementNote: "Under listen" },
      noteAtTheContent: "Under listen",
    });
    expect(
      changePresentation(
        atTheContent,
        { mode: "inline", placementNote: null },
        "Under resultatlisten",
      ),
    ).toEqual({
      presentation: { mode: "inline", placementNote: null },
      noteAtTheContent: null,
    });
  });

  it("keeps what it remembers while the floating panel stays chosen", () => {
    expect(
      changePresentation(asPanel, asPanel, "Under resultatlisten"),
    ).toEqual({
      presentation: asPanel,
      noteAtTheContent: "Under resultatlisten",
    });
  });
});

describe("PresentationControls", () => {
  it("offers the two display modes as one named choice", () => {
    renderControls({ mode: "dock", placementNote: null });

    const choice = screen.getByRole("radiogroup", { name: "Visning" });
    expect(choice).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Flytende panel" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Ved innholdet" }),
    ).not.toBeChecked();
    // The placement and the width only apply at the content.
    expect(screen.queryByLabelText(/Plassering i appen/)).toBeNull();
    expect(
      screen.queryByRole("radiogroup", { name: "Bredde i forhåndsvisningen" }),
    ).toBeNull();
  });

  it("switches to the content and back with the keyboard, keeping the note", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({
      mode: "dock",
      placementNote: "Under resultatlisten",
    });

    await user.tab();
    expect(screen.getByRole("radio", { name: "Flytende panel" })).toHaveFocus();
    // The arrow keys move between the two, and Enter or Space chooses.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Ved innholdet" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: "Under resultatlisten",
    });
    expect(screen.getByLabelText(/Plassering i appen/)).toHaveValue(
      "Under resultatlisten",
    );

    await user.keyboard("{ArrowLeft}");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "dock",
      placementNote: "Under resultatlisten",
    });
  });

  it("saves the placement note as the author types, and no note when it is emptied", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: null,
    });
    const note = screen.getByLabelText(/Plassering i appen/);
    // The browser's maxlength counts UTF-16 units, not characters.
    expect(note).not.toHaveAttribute("maxlength");
    expect(note).toHaveAccessibleDescription(/Høyst 200 tegn/);

    await user.type(note, "Under");
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: "Under",
    });

    await user.clear(note);
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: null,
    });
  });

  it("counts the note in characters, as the API and the database do", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: null,
    });
    const note = screen.getByLabelText(/Plassering i appen/);

    // 200 characters, of which two emoji are four UTF-16 units.
    const valid = `${"a".repeat(198)}😀😀`;
    await user.click(note);
    await user.paste(valid);
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: valid,
    });
    expect(note).toHaveValue(valid);

    // More than that is cut at 200 characters, also inside a pasted text.
    await user.clear(note);
    await user.paste(`${"b".repeat(199)}😀😀😀`);
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: `${"b".repeat(199)}😀`,
    });
  });

  it("keeps the end of a full note when the author types at its start", async () => {
    const user = userEvent.setup();
    const full = `${"a".repeat(193)} på rad`;
    expect(full).toHaveLength(200);
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: full,
    });
    const note = screen.getByLabelText(
      /Plassering i appen/,
    ) as HTMLInputElement;

    await user.type(note, "ny ", {
      initialSelectionStart: 0,
      initialSelectionEnd: 0,
    });

    // As the browser's own limit does, the limit stops what is typed. The
    // note is as it was, so nothing is changed.
    expect(note).toHaveValue(full);
    expect(note.selectionStart).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cuts what is pasted into a note at the limit, and keeps the text after it", async () => {
    const user = userEvent.setup();
    const before = "a".repeat(95);
    const after = "b".repeat(95);
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: before + after,
    });
    const note = screen.getByLabelText(
      /Plassering i appen/,
    ) as HTMLInputElement;

    await user.click(note);
    note.setSelectionRange(95, 95);
    await user.paste("X".repeat(15));

    // Room for 10 characters, and the caret after them.
    const expected = `${before}${"X".repeat(10)}${after}`;
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: expected,
    });
    expect(note).toHaveValue(expected);
    expect(note.selectionStart).toBe(105);
  });

  it("cuts a paste that replaces a selection at the limit, and keeps what fits", async () => {
    const user = userEvent.setup();
    const full = `${"X".repeat(197)}ABC`;
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: full,
    });
    const note = screen.getByLabelText(
      /Plassering i appen/,
    ) as HTMLInputElement;

    await user.click(note);
    note.setSelectionRange(197, 200);
    await user.paste("AXYBC");

    const expected = `${"X".repeat(197)}AXY`;
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: expected,
    });
    expect(note).toHaveValue(expected);
    expect(note.selectionStart).toBe(200);
  });

  it("lets an input method finish composing at the limit, and cuts the result", () => {
    const full = `${"a".repeat(199)}`;
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: full,
    });
    const note = screen.getByLabelText(
      /Plassering i appen/,
    ) as HTMLInputElement;
    note.focus();
    note.setSelectionRange(199, 199);

    // Pinyin shows the letters while the author picks a character.
    fireEvent.compositionStart(note);
    fireEvent.input(note, { target: { value: `${full}n` } });
    fireEvent.input(note, { target: { value: `${full}ni` } });
    expect(note).toHaveValue(`${full}ni`);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.input(note, { target: { value: `${full}你` } });
    fireEvent.compositionEnd(note);
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: `${full}你`,
    });
    expect(note).toHaveValue(`${full}你`);

    // A composition that does not fit is cut when it ends, not before.
    note.setSelectionRange(200, 200);
    fireEvent.compositionStart(note);
    fireEvent.input(note, { target: { value: `${full}你好` } });
    expect(note).toHaveValue(`${full}你好`);
    fireEvent.compositionEnd(note);
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: `${full}你`,
    });
    expect(note).toHaveValue(`${full}你`);
  });

  it("keeps a pasted note on one line", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({
      mode: "inline",
      placementNote: null,
    });

    await user.click(screen.getByLabelText(/Plassering i appen/));
    // A cell copied from a spreadsheet, and a line separator from a document.
    await user.paste("Under\tresultatlisten\u2028på Min side");

    expect(onChange).toHaveBeenLastCalledWith({
      mode: "inline",
      placementNote: "Under resultatlisten på Min side",
    });
    expect(screen.getByLabelText(/Plassering i appen/)).toHaveValue(
      "Under resultatlisten på Min side",
    );
  });

  it("lets the author try the survey in a narrow column and at phone width", async () => {
    const user = userEvent.setup();
    const { onInlineWidthChange, onChange } = renderControls({
      mode: "inline",
      placementNote: null,
    });

    await user.click(screen.getByRole("radio", { name: "Smal kolonne" }));
    expect(onInlineWidthChange).toHaveBeenLastCalledWith("column");
    await user.click(screen.getByRole("radio", { name: "Mobil" }));
    expect(onInlineWidthChange).toHaveBeenLastCalledWith("mobile");
    // The width is a way to look at the survey. It is not saved.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("only offers the width where the presentation is frozen", () => {
    renderControls(
      { mode: "inline", placementNote: "Under resultatlisten" },
      { readOnly: true },
    );

    expect(screen.queryByRole("radiogroup", { name: "Visning" })).toBeNull();
    expect(screen.queryByLabelText(/Plassering i appen/)).toBeNull();
    expect(
      screen.getByRole("radiogroup", { name: "Bredde i forhåndsvisningen" }),
    ).toBeInTheDocument();
  });

  it("offers no choice when the API did not say which display the draft has", () => {
    render(
      <PresentationControls
        presentation={{ mode: "dock", placementNote: null }}
        onChange={() => {}}
        unknown
        inlineWidth="full"
        onInlineWidthChange={() => {}}
      />,
    );

    // A choice made here would replace one that nobody has seen.
    expect(screen.queryByRole("radiogroup", { name: "Visning" })).toBeNull();
    expect(screen.queryByLabelText(/Plassering i appen/)).toBeNull();
    expect(
      screen.getByText(
        /Visningsvalget kunne ikke hentes, så forhåndsvisningen viser flytende panel\. Last siden på nytt/,
      ),
    ).toBeInTheDocument();
  });

  it("shows nothing for a frozen floating panel", () => {
    const { container } = render(
      <PresentationControls
        presentation={{ mode: "dock", placementNote: null }}
        inlineWidth="full"
        onInlineWidthChange={() => {}}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
