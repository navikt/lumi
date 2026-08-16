import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EditorTopbar,
  type SaveState,
} from "~/components/surveyverksted/EditorTopbar";

function renderTopbar(saveState: SaveState) {
  const noop = () => {};
  return render(
    <EditorTopbar
      name="Testutkast"
      surveyId="test-v1"
      team="team-esyfo"
      saveState={saveState}
      previewHref={null}
      onRename={noop}
      onBack={noop}
      onOpenSettings={noop}
      onOpenShare={noop}
    />,
  );
}

function rerenderTopbar(
  rerender: (ui: React.ReactElement) => void,
  saveState: SaveState,
) {
  const noop = () => {};
  rerender(
    <EditorTopbar
      name="Testutkast"
      surveyId="test-v1"
      team="team-esyfo"
      saveState={saveState}
      previewHref={null}
      onRename={noop}
      onBack={noop}
      onOpenSettings={noop}
      onOpenShare={noop}
    />,
  );
}

describe("EditorTopbar save announcements", () => {
  it("announces the first successful autosave", () => {
    const { rerender } = renderTopbar("saved");
    expect(screen.getByRole("status")).toHaveTextContent("");
    rerenderTopbar(rerender, "saving");
    rerenderTopbar(rerender, "saved");
    expect(screen.getByRole("status")).toHaveTextContent("Lagret");
  });

  it("announces errors and the recovery save", () => {
    const { rerender } = renderTopbar("saved");
    rerenderTopbar(rerender, "error");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Utkastet ble ikke lagret",
    );
    rerenderTopbar(rerender, "saving");
    rerenderTopbar(rerender, "saved");
    expect(screen.getByRole("status")).toHaveTextContent("Lagret");
  });
});
