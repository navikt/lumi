import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RatingMarker } from "~/types/api";
import { MarkerModal } from "../index";

const marker = {
  id: "marker-1",
  surveyId: "survey-1",
  markerDate: "2026-10-20",
  label: "Ny versjon",
  description: "",
  color: null,
} as unknown as RatingMarker;

function modal(props: Partial<Parameters<typeof MarkerModal>[0]>) {
  return (
    <MarkerModal
      isOpen
      mode="create"
      fromDate="2026-07-01"
      toDate="2026-10-25"
      onClose={vi.fn()}
      onSave={vi.fn()}
      {...props}
    />
  );
}

// The end of «Fra første svar» moves to the next day at midnight.
describe("MarkerModal when the period end moves", () => {
  it("keeps a new marker that is being written", async () => {
    const user = userEvent.setup();
    const { rerender } = render(modal({}));
    await user.type(
      screen.getByRole("textbox", { name: "Tittel" }),
      "Lansering",
    );

    rerender(modal({ toDate: "2026-10-26" }));

    expect(screen.getByRole("textbox", { name: "Tittel" })).toHaveValue(
      "Lansering",
    );
  });

  it("keeps changes to a marker that is being edited", async () => {
    const user = userEvent.setup();
    const { rerender } = render(modal({ mode: "edit", marker }));
    const title = screen.getByRole("textbox", { name: "Tittel" });
    await user.clear(title);
    await user.type(title, "Ny versjon 2");

    rerender(modal({ mode: "edit", marker, toDate: "2026-10-26" }));

    expect(screen.getByRole("textbox", { name: "Tittel" })).toHaveValue(
      "Ny versjon 2",
    );
  });
});
