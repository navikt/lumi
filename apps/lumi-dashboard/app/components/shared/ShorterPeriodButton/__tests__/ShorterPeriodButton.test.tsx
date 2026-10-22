import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShorterPeriodButton } from "../index";

const search = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  setParams: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: search.params,
    setParams: search.setParams,
  }),
}));

describe("ShorterPeriodButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T10:00:00"));
    search.setParams.mockReset();
    search.setParams.mockResolvedValue(undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("offers the last 30 days for a longer period", () => {
    search.params = { fromDate: "2026-07-25", toDate: "2026-10-22" };
    render(<ShorterPeriodButton />);

    expect(
      screen.getByRole("button", { name: "Vis de siste 30 dagene i perioden" }),
    ).toBeInTheDocument();
  });

  it("offers the last 7 days when 30 days is already too much", () => {
    search.params = { fromDate: "2026-09-23", toDate: "2026-10-22" };
    render(<ShorterPeriodButton />);

    expect(
      screen.getByRole("button", { name: "Vis de siste 7 dagene i perioden" }),
    ).toBeInTheDocument();
  });

  it("offers nothing for a week or less, also when the period has no end", () => {
    search.params = { fromDate: "2026-10-16", toDate: "2026-10-22" };
    const { container, rerender } = render(<ShorterPeriodButton />);
    expect(container).toBeEmptyDOMElement();

    search.params = { fromDate: "2026-10-20" };
    rerender(<ShorterPeriodButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the new period inside a period that ended before today", async () => {
    search.params = {
      dateMode: "auto",
      fromDate: "2026-06-01",
      toDate: "2026-08-15",
    };
    const user = userEvent.setup();
    render(<ShorterPeriodButton />);
    await user.click(
      screen.getByRole("button", { name: "Vis de siste 30 dagene i perioden" }),
    );

    expect(search.setParams).toHaveBeenCalledWith({
      dateMode: "fixed",
      fromDate: "2026-07-17",
      toDate: "2026-08-15",
      periodPreset: undefined,
      page: "1",
    });
  });

  it("chooses the last days up to today and moves focus to the period", async () => {
    search.params = {
      dateMode: "fixed",
      fromDate: "2026-07-25",
      toDate: "2026-10-22",
      periodPreset: "custom",
      page: "3",
    };
    const hiddenTrigger = document.createElement("button");
    hiddenTrigger.setAttribute("data-period-trigger", "");
    const visibleTrigger = document.createElement("button");
    visibleTrigger.setAttribute("data-period-trigger", "");
    vi.spyOn(visibleTrigger, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 100, 32),
    ] as unknown as DOMRectList);
    document.body.append(hiddenTrigger, visibleTrigger);

    const user = userEvent.setup();
    render(<ShorterPeriodButton />);
    await user.click(
      screen.getByRole("button", { name: "Vis de siste 30 dagene i perioden" }),
    );

    expect(search.setParams).toHaveBeenCalledWith({
      dateMode: "fixed",
      fromDate: "2026-09-23",
      toDate: "2026-10-22",
      periodPreset: undefined,
      page: "1",
    });
    expect(visibleTrigger).toHaveFocus();
  });
});
