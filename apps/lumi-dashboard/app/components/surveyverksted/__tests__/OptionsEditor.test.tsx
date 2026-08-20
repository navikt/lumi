import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OptionsEditor } from "~/components/surveyverksted/OptionsEditor";

const options = [
  { value: "soke", label: "Søke" },
  { value: "sjekke-status", label: "Sjekke status" },
];

function renderEditor(
  overrides?: Partial<Parameters<typeof OptionsEditor>[0]>,
) {
  const handlers = {
    onAdd: vi.fn(),
    onUpdateLabel: vi.fn(),
    onCommitLabel: vi.fn(),
    onUpdateValue: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
  };
  render(
    <OptionsEditor
      questionId="choice-1"
      options={options}
      onAdd={handlers.onAdd}
      onUpdateLabel={handlers.onUpdateLabel}
      onCommitLabel={handlers.onCommitLabel}
      onUpdateValue={handlers.onUpdateValue}
      onRemove={handlers.onRemove}
      onMove={handlers.onMove}
      {...overrides}
    />,
  );
  return handlers;
}

describe("OptionsEditor", () => {
  it("renders one label field per option with the stable value visible", () => {
    renderEditor();
    expect(screen.getByDisplayValue("Søke")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sjekke status")).toBeInTheDocument();
    expect(screen.getByText("soke")).toBeInTheDocument();
    expect(screen.getByText("sjekke-status")).toBeInTheDocument();
  });

  it("adds a new option when Enter is pressed in the last row", async () => {
    const handlers = renderEditor();
    const last = screen.getByDisplayValue("Sjekke status");
    await userEvent.click(last);
    await userEvent.keyboard("{Enter}");
    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
  });

  it("removes an empty option when Backspace is pressed in it", async () => {
    const handlers = renderEditor({
      options: [...options, { value: "alternativ-3", label: "" }],
    });
    const empty = screen.getAllByLabelText(/alternativ \d/i)[2];
    await userEvent.click(empty);
    await userEvent.keyboard("{Backspace}");
    expect(handlers.onRemove).toHaveBeenCalledWith(2);
  });

  it("keeps the required minimum for a task-priority list", async () => {
    const handlers = renderEditor({ minOptions: 2 });
    expect(
      screen.getByRole("button", { name: /fjern alternativ 1/i }),
    ).toBeDisabled();
    const second = screen.getByDisplayValue("Sjekke status");
    await userEvent.clear(second);
    await userEvent.keyboard("{Backspace}");
    expect(handlers.onRemove).not.toHaveBeenCalled();
  });

  it("reports label edits without touching the value", async () => {
    const handlers = renderEditor();
    const first = screen.getByDisplayValue("Søke");
    await userEvent.type(first, "r");
    expect(handlers.onUpdateLabel).toHaveBeenCalledWith(0, "Søker");
    expect(handlers.onUpdateValue).not.toHaveBeenCalled();
  });

  it("commits a label on blur so templates can replace their placeholder id", async () => {
    const handlers = renderEditor();
    const first = screen.getByDisplayValue("Søke");
    await userEvent.click(first);
    await userEvent.tab();
    expect(handlers.onCommitLabel).toHaveBeenCalledWith(0, "Søke");
  });

  it("keeps analytics answer identities and structure fixed", async () => {
    const handlers = renderEditor({ lockValues: true, lockStructure: true });
    expect(
      screen.queryByRole("button", { name: /endre verdi/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /legg til alternativ/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/svarene brukes i analysen/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /fjern alternativ 1/i }),
    ).toBeDisabled();
    await userEvent.click(screen.getByDisplayValue("Sjekke status"));
    await userEvent.keyboard("{Enter}");
    expect(handlers.onAdd).not.toHaveBeenCalled();
  });

  it("commits value edits to the draft on every keystroke", async () => {
    // Controlled contract: the parent feeds committed values back in,
    // exactly like the editor's draft does.
    function Harness() {
      const [current, setCurrent] = useState(options);
      return (
        <OptionsEditor
          questionId="choice-1"
          options={current}
          onAdd={() => {}}
          onUpdateLabel={() => {}}
          onCommitLabel={() => {}}
          onUpdateValue={(index, value) =>
            setCurrent((previous) =>
              previous.map((option, candidate) =>
                candidate === index ? { ...option, value } : option,
              ),
            )
          }
          onRemove={() => {}}
          onMove={() => {}}
        />
      );
    }
    render(<Harness />);
    await userEvent.click(
      screen.getByRole("button", { name: /endre verdi for alternativ 1/i }),
    );
    // The field selects its content on focus; typing replaces it.
    await userEvent.keyboard("sok-om-stotte{Enter}");
    expect(
      screen.getByRole("button", { name: /endre verdi for alternativ 1/i }),
    ).toHaveTextContent("sok-om-stotte");
  });

  it("marks duplicate values as errors", () => {
    renderEditor({
      options: [
        { value: "ja", label: "Ja" },
        { value: "ja", label: "Ja igjen" },
      ],
    });
    expect(
      screen.getAllByText(/verdien er i bruk flere ganger/i).length,
    ).toBeGreaterThan(0);
  });
});
