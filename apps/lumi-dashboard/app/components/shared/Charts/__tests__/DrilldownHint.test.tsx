import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrilldownHint } from "../timeSeriesParts";

function canHover(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

describe("DrilldownHint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks for a click where the pointer can hover", () => {
    canHover(true);
    render(<DrilldownHint />);

    expect(
      screen.getByText("Klikk for å åpne tilbakemeldinger"),
    ).toBeInTheDocument();
  });

  it("points to the table on a touch screen, where a tap only shows the tooltip", () => {
    canHover(false);
    render(<DrilldownHint />);

    expect(
      screen.getByText("Velg Vis som tabell for å åpne svarene"),
    ).toBeInTheDocument();
  });
});
