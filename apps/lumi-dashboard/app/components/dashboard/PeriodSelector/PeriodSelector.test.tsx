import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeriodSelector } from ".";

const { mockParams, mockSetParams } = vi.hoisted(() => ({
  mockParams: {
    dateMode: undefined as "auto" | "fixed" | undefined,
    surveyId: undefined as string | undefined,
    fromDate: undefined as string | undefined,
    toDate: undefined as string | undefined,
  },
  mockSetParams: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: mockParams,
    setParams: mockSetParams,
  }),
}));

vi.mock("~/hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

describe("PeriodSelector", () => {
  beforeEach(() => {
    mockParams.dateMode = undefined;
    mockParams.surveyId = undefined;
    mockParams.fromDate = undefined;
    mockParams.toDate = undefined;
    mockSetParams.mockClear();
  });

  it("lets a fixed survey period return to automatic mode without clearing the survey", async () => {
    const user = userEvent.setup();
    mockParams.dateMode = "fixed";
    mockParams.surveyId = "survey-historisk";
    mockParams.fromDate = "2024-02-01";
    mockParams.toDate = "2024-02-18";
    render(<PeriodSelector />);

    await user.click(
      screen.getByRole("button", {
        name: "Periode: 01.02.2024 - 18.02.2024",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Automatisk periode" }),
    );

    expect(mockSetParams).toHaveBeenCalledWith({
      dateMode: "auto",
      page: "1",
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Periode: 01.02.2024 - 18.02.2024",
        }),
      ).toHaveFocus(),
    );
  });

  it("labels a partial fixed period that only has a start date", () => {
    mockParams.dateMode = "fixed";
    mockParams.fromDate = "2024-02-01";

    render(<PeriodSelector />);

    expect(
      screen.getByRole("button", { name: "Periode: Fra 01.02.2024" }),
    ).toBeInTheDocument();
  });

  it("labels a partial fixed period that only has an end date", () => {
    mockParams.dateMode = "fixed";
    mockParams.toDate = "2024-02-18";

    render(<PeriodSelector />);

    expect(
      screen.getByRole("button", { name: "Periode: Til 18.02.2024" }),
    ).toBeInTheDocument();
  });

  it("marks a manually selected preset as fixed", async () => {
    const user = userEvent.setup();
    render(<PeriodSelector />);

    await user.click(
      screen.getByRole("button", { name: "Periode: Velg periode" }),
    );
    await user.click(screen.getByRole("button", { name: "Siste 7 dager" }));

    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({ dateMode: "fixed", page: "1" }),
    );
  });

  it("marks a custom date range as fixed", async () => {
    const user = userEvent.setup();
    render(<PeriodSelector />);

    await user.click(
      screen.getByRole("button", { name: "Periode: Velg periode" }),
    );
    await user.type(
      screen.getAllByRole("textbox", { name: "Fra" })[0],
      "01.02.2024",
    );
    await user.type(
      screen.getAllByRole("textbox", { name: "Til" })[0],
      "18.02.2024",
    );

    const applyButton = within(
      screen.getByRole("dialog", { name: "Velg periode" }),
    )
      .getAllByRole("button", { name: "Velg periode" })
      .find((button) => !button.hasAttribute("disabled"));

    expect(applyButton).toBeDefined();
    await user.click(applyButton as HTMLButtonElement);

    expect(mockSetParams).toHaveBeenCalledWith({
      dateMode: "fixed",
      fromDate: "2024-02-01",
      toDate: "2024-02-18",
      page: "1",
    });
  });

  it("exposes dialog state and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<PeriodSelector />);

    const trigger = screen.getByRole("button", {
      name: "Periode: Velg periode",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Velg periode" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);

    screen.getByRole("button", { name: "Siste 7 dager" }).focus();
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves the period selector open when Escape comes from a nested dialog", async () => {
    const user = userEvent.setup();
    render(<PeriodSelector />);

    const trigger = screen.getByRole("button", {
      name: "Periode: Velg periode",
    });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Velg periode" });
    await user.click(screen.getAllByTitle("Åpne datovelger")[0]);
    const nestedDialog = screen
      .getAllByRole("dialog")
      .find((candidate) => candidate !== dialog);
    expect(nestedDialog).toBeDefined();

    within(nestedDialog as HTMLElement)
      .getByRole("button", { name: "Lukk" })
      .focus();
    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toBeInTheDocument();
  });

  it("does not steal focus when an outside click closes the popover", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PeriodSelector />
        <button type="button">Utenfor</button>
      </>,
    );

    const trigger = screen.getByRole("button", {
      name: "Periode: Velg periode",
    });
    const outsideButton = screen.getByRole("button", { name: "Utenfor" });

    await user.click(trigger);
    await user.click(outsideButton);

    expect(outsideButton).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
