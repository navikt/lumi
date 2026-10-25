import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeriodSelector } from ".";

const { mockParams, mockSetParams, mockBreakpoint, mockAnswerSpan } =
  vi.hoisted(() => ({
    mockParams: {
      dateMode: undefined as "auto" | "fixed" | "relative" | undefined,
      periodPreset: undefined as string | undefined,
      surveyId: undefined as string | undefined,
      fromDate: undefined as string | undefined,
      toDate: undefined as string | undefined,
    },
    mockSetParams: vi.fn(),
    mockBreakpoint: { isMobile: false },
    mockAnswerSpan: {
      value: undefined as { fromDate: string; toDate: string } | undefined,
    },
  }));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: mockParams,
    setParams: mockSetParams,
  }),
}));

vi.mock("~/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
}));

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => mockAnswerSpan.value,
  useAnswerSpanState: () => ({ span: mockAnswerSpan.value, isLoaded: true }),
}));

describe("PeriodSelector", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    mockParams.dateMode = undefined;
    mockParams.periodPreset = undefined;
    mockParams.surveyId = undefined;
    mockParams.fromDate = undefined;
    mockParams.toDate = undefined;
    mockSetParams.mockClear();
    mockBreakpoint.isMobile = false;
    mockAnswerSpan.value = undefined;
  });

  it.each([false, true])(
    "does not expose automatic mode in the period editor (completed days: %s)",
    async (completeDays) => {
      const user = userEvent.setup();
      mockParams.dateMode = "fixed";
      mockParams.surveyId = "survey-historisk";
      mockParams.fromDate = "2024-02-01";
      mockParams.toDate = "2024-02-18";
      render(<PeriodSelector completeDays={completeDays} />);

      await user.click(
        screen.getByRole("button", {
          name: "Periode: 01.02.2024 - 18.02.2024",
        }),
      );
      expect(
        screen.queryByRole("button", { name: /automatisk periode/i }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole("textbox", { name: "Fra" })[0]).toHaveValue(
        "01.02.2024",
      );
      expect(screen.getAllByRole("textbox", { name: "Til" })[0]).toHaveValue(
        "18.02.2024",
      );
      expect(mockSetParams).not.toHaveBeenCalled();
    },
  );

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
    // A fixed period is not «Fra første svar» any more.
    expect(mockSetParams.mock.lastCall?.[0]).toHaveProperty(
      "periodPreset",
      undefined,
    );
  });

  it.each([false, true])(
    "offers «Fra første svar» last among the quick picks (completed days: %s)",
    (completeDays) => {
      vi.useFakeTimers();
      // 00:30 on 26 October in Oslo, after the clocks went back.
      vi.setSystemTime(new Date("2026-10-25T23:30:00Z"));
      render(<PeriodSelector completeDays={completeDays} />);
      fireEvent.click(
        screen.getByRole("button", { name: "Periode: Velg periode" }),
      );
      const dialog = screen.getByRole("dialog", { name: "Velg periode" });
      const buttons = within(dialog).getAllByRole("button");
      const yearToDate = buttons.findIndex((button) =>
        /Hittil i år/.test(button.textContent ?? ""),
      );
      expect(buttons[yearToDate + 1]).toHaveTextContent("Fra første svar");

      fireEvent.click(
        within(dialog).getAllByRole("button", { name: "Fra første svar" })[0],
      );

      // Today in Oslo, also when the browser is still on the day before.
      expect(mockSetParams).toHaveBeenCalledWith({
        dateMode: "relative",
        periodPreset: "sinceFirst",
        toDate: "2026-10-26",
        page: "1",
      });
      expect(mockSetParams.mock.lastCall?.[0]).toHaveProperty(
        "fromDate",
        undefined,
      );
    },
  );

  it("says that answers are deleted after twelve months", () => {
    const { unmount } = render(<PeriodSelector />);
    fireEvent.click(
      screen.getByRole("button", { name: "Periode: Velg periode" }),
    );
    expect(
      screen.getAllByText("Svar slettes etter tolv måneder.")[0],
    ).toBeInTheDocument();
    unmount();

    render(<PeriodSelector completeDays />);
    fireEvent.click(
      screen.getByRole("button", { name: "Periode: Velg periode" }),
    );
    expect(
      screen.getByText(
        "Hele dager til og med i går, unntatt «I dag» og «Fra første svar». Svar slettes etter tolv måneder.",
      ),
    ).toBeInTheDocument();
  });

  describe("with «Fra første svar»", () => {
    beforeEach(() => {
      mockParams.dateMode = "relative";
      mockParams.periodPreset = "sinceFirst";
      mockParams.toDate = "2026-10-25";
    });

    it("names the period with the first answer", () => {
      mockAnswerSpan.value = { fromDate: "2025-12-29", toDate: "2026-10-24" };
      render(<PeriodSelector />);

      expect(
        screen.getByRole("button", {
          name: "Periode: Fra første svar (29.12.2025)",
        }),
      ).toHaveTextContent("Fra første svar (29.12.2025)");
    });

    it("leaves the date out until the first answer is known, and in the filter bar on small screens", () => {
      const { unmount } = render(<PeriodSelector />);
      expect(
        screen.getByRole("button", { name: "Periode: Fra første svar" }),
      ).toBeInTheDocument();
      unmount();

      mockBreakpoint.isMobile = true;
      mockAnswerSpan.value = { fromDate: "2025-12-29", toDate: "2026-10-24" };
      const { unmount: unmountFilterBar } = render(<PeriodSelector />);
      expect(
        screen.getByRole("button", { name: "Periode: Fra første svar" }),
      ).toBeInTheDocument();
      unmountFilterBar();

      // Next to the comparison, the button takes the full width.
      render(<PeriodSelector completeDays />);
      expect(
        screen.getByRole("button", {
          name: "Periode: Fra første svar (29.12.2025)",
        }),
      ).toBeInTheDocument();
    });

    it("fills in the first answer as the start of a custom period", async () => {
      const user = userEvent.setup();
      mockAnswerSpan.value = { fromDate: "2025-12-29", toDate: "2026-10-24" };
      render(<PeriodSelector completeDays />);

      await user.click(
        screen.getByRole("button", {
          name: "Periode: Fra første svar (29.12.2025)",
        }),
      );

      expect(screen.getAllByRole("textbox", { name: "Fra" })[0]).toHaveValue(
        "29.12.2025",
      );
      expect(screen.getAllByRole("textbox", { name: "Til" })[0]).toHaveValue(
        "25.10.2026",
      );
    });
  });

  it("uses completed Oslo days and preserves the explicit comparison choice", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T22:30:00Z"));
    render(<PeriodSelector completeDays />);
    fireEvent.click(
      screen.getByRole("button", { name: "Periode: Velg periode" }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Siste 7 hele dager" })[0],
    );
    expect(mockSetParams).toHaveBeenCalledWith({
      dateMode: "fixed",
      fromDate: "2026-08-31",
      toDate: "2026-09-06",
      periodPreset: "rolling",
      page: "1",
    });
  });

  it("does not offer completed year-to-date on January 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z"));
    render(<PeriodSelector completeDays />);
    fireEvent.click(
      screen.getByRole("button", { name: "Periode: Velg periode" }),
    );
    expect(
      screen.queryByRole("button", { name: "Hittil i år (t.o.m. i går)" }),
    ).not.toBeInTheDocument();
  });

  it("prefills the selected dates and explains a reversed interval", async () => {
    const user = userEvent.setup();
    mockParams.fromDate = "2024-02-10";
    mockParams.toDate = "2024-02-18";
    render(<PeriodSelector completeDays />);
    await user.click(
      screen.getByRole("button", { name: "Periode: 10.02.2024 - 18.02.2024" }),
    );
    const from = screen.getAllByRole("textbox", { name: "Fra" })[0];
    const to = screen.getAllByRole("textbox", { name: "Til" })[0];
    expect(from).toHaveValue("10.02.2024");
    expect(to).toHaveValue("18.02.2024");
    await user.clear(to);
    await user.type(to, "09.02.2024");
    expect(
      screen.getAllByRole("button", { name: "Velg periode" })[0],
    ).toBeDisabled();
    expect(
      screen.getByText("Til-dato må være samme dag som eller etter fra-dato."),
    ).toBeInTheDocument();
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
    expect(mockSetParams.mock.lastCall?.[0]).toHaveProperty(
      "periodPreset",
      undefined,
    );
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
