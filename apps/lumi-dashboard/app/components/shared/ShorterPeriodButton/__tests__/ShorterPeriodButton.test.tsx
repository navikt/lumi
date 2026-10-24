import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShorterPeriodButton } from "../index";

const search = vi.hoisted(() => ({
  setParams: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: {},
    setParams: search.setParams,
  }),
}));

function periodTrigger({ visible }: { visible: boolean }) {
  const trigger = document.createElement("button");
  trigger.setAttribute("data-period-trigger", "");
  if (visible) {
    vi.spyOn(trigger, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 100, 32),
    ] as unknown as DOMRectList);
  }
  return trigger;
}

describe("ShorterPeriodButton", () => {
  beforeEach(() => {
    search.setParams.mockReset();
    search.setParams.mockResolvedValue(undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("names the period with its dates", () => {
    const { rerender } = render(
      <ShorterPeriodButton
        period={{ fromDate: "2026-06-01", toDate: "2026-06-30" }}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Vis perioden 01.06.2026–30.06.2026",
      }),
    ).toBeInTheDocument();

    rerender(
      <ShorterPeriodButton
        period={{ fromDate: "2025-12-15", toDate: "2026-01-13" }}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Vis perioden 15.12.2025–13.01.2026",
      }),
    ).toBeInTheDocument();
  });

  it("shows the period from the first page and moves focus to the visible period button", async () => {
    const hiddenTrigger = periodTrigger({ visible: false });
    const visibleTrigger = periodTrigger({ visible: true });
    document.body.append(hiddenTrigger, visibleTrigger);
    const user = userEvent.setup();
    render(
      <ShorterPeriodButton
        period={{ fromDate: "2026-09-23", toDate: "2026-10-22" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Vis perioden/ }));

    expect(search.setParams).toHaveBeenCalledTimes(1);
    const [next] = search.setParams.mock.calls[0];
    expect(next).toEqual({
      dateMode: "fixed",
      fromDate: "2026-09-23",
      toDate: "2026-10-22",
      page: "1",
    });
    expect(next).toHaveProperty("periodPreset", undefined);
    expect(visibleTrigger).toHaveFocus();
  });

  it("moves focus to the page heading while the filter bar has no period button", async () => {
    const main = document.createElement("main");
    const heading = document.createElement("h1");
    heading.textContent = "Dashboard";
    main.append(heading);
    document.body.append(main, periodTrigger({ visible: false }));
    const user = userEvent.setup();
    render(
      <ShorterPeriodButton
        period={{ fromDate: "2026-09-23", toDate: "2026-10-22" }}
      />,
    );
    // The new period removes the alert, and the focus with it.
    search.setParams.mockImplementation(async () => {
      (document.activeElement as HTMLElement).blur();
    });

    await user.click(screen.getByRole("button", { name: /^Vis perioden/ }));

    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus to the page heading before the button it is on goes away", async () => {
    const main = document.createElement("main");
    const heading = document.createElement("h1");
    heading.textContent = "Tilbakemeldinger";
    main.append(heading);
    document.body.append(main, periodTrigger({ visible: false }));
    const user = userEvent.setup();
    const { unmount } = render(
      <ShorterPeriodButton
        period={{ fromDate: "2026-09-23", toDate: "2026-10-22" }}
      />,
    );
    const button = screen.getByRole("button", { name: /^Vis perioden/ });

    // The previous answers stay on screen while the new ones load, and the
    // button keeps the focus until then.
    await user.click(button);
    expect(heading).toHaveFocus();

    unmount();
    expect(heading).toHaveFocus();
  });

  it("leaves the focus where the user has moved it", async () => {
    const main = document.createElement("main");
    const heading = document.createElement("h1");
    main.append(heading);
    const otherButton = document.createElement("button");
    const visibleTrigger = periodTrigger({ visible: true });
    document.body.append(main, otherButton, visibleTrigger);
    const user = userEvent.setup();
    render(
      <ShorterPeriodButton
        period={{ fromDate: "2026-09-23", toDate: "2026-10-22" }}
      />,
    );
    search.setParams.mockImplementation(async () => otherButton.focus());

    await user.click(screen.getByRole("button", { name: /^Vis perioden/ }));

    expect(otherButton).toHaveFocus();
    expect(visibleTrigger).not.toHaveFocus();
    expect(heading).not.toHaveAttribute("tabindex");
  });
});
