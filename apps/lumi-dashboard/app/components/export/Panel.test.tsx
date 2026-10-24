import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPanel } from "~/components/export/Panel";
import { analysisBudgetError } from "~/mock/analysisBudget";
import { exportServerFn } from "~/server/actions";
import {
  ANALYSIS_BUDGET_TITLE,
  FILTER_BUDGET_DESCRIPTION,
} from "~/utils/analysisBudget";

const search = vi.hoisted(() => ({
  params: { team: "flex" } as Record<string, string>,
  setParams: vi.fn(),
}));

vi.mock("~/server/actions", () => ({ exportServerFn: vi.fn() }));
vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: search.params,
    setParams: search.setParams,
  }),
}));
vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => undefined,
}));
vi.mock("~/components/export/ActiveFilters", () => ({
  ActiveFilters: () => null,
}));
vi.mock("~/components/dashboard", () => ({
  DashboardCard: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  DashboardGrid: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const exportMock = vi.mocked(exportServerFn);

const TASK_FILTER = { team: "flex", surveyId: "survey-top-tasks", task: "a" };
const FILTERS_CHANGED =
  "Filtrene ble endret før eksporten var ferdig. Ingen fil ble lastet ned. Last ned på nytt.";

function exportResult(counts: { total: number | null; count: number | null }) {
  return {
    data: btoa("id\n"),
    filename: "lumi-export-2026-10-14.csv",
    contentType: "text/csv; charset=utf-8",
    ...counts,
  };
}

/** An export that only ends when its request is aborted. */
function exportUntilAborted() {
  exportMock.mockImplementation(
    (options) =>
      new Promise((_, reject) => {
        const signal = options?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason));
      }),
  );
}

function exportSignal(): AbortSignal | undefined {
  return exportMock.mock.calls[0]?.[0]?.signal;
}

describe("ExportPanel", () => {
  beforeEach(() => {
    search.params = { team: "flex" };
    search.setParams.mockReset();
    exportMock.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:lumi-export");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("announces a warning when the export is truncated", async () => {
    exportMock.mockResolvedValue(
      exportResult({ total: 12_345, count: 10_000 }),
    );
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /Eksporten har de 10\s000 nyeste svarene av 12\s345\. Del opp perioden og eksporter hver del for seg for å få med alle\./,
    );
  });

  it("removes the outcome when the filters change, also when they change back", async () => {
    exportMock.mockResolvedValue(
      exportResult({ total: 12_345, count: 10_000 }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    expect(
      await screen.findByText("Eksport fullført! Filen er lastet ned."),
    ).toBeInTheDocument();

    search.params = { team: "flex", fromDate: "2026-09-01" };
    rerender(<ExportPanel />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    search.params = { team: "flex" };
    rerender(<ExportPanel />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps the success message until the next action", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    exportMock.mockResolvedValue(exportResult({ total: 42, count: 42 }));
    render(<ExportPanel />);

    await act(async () => {
      screen.getByRole("button", { name: "Last ned CSV" }).click();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Eksport fullført! Filen er lastet ned.",
    );
  });

  it("explains the analysis budget without a retry and clears it when the filters change", async () => {
    const consoleError = vi.spyOn(console, "error");
    search.params = TASK_FILTER;
    exportMock.mockRejectedValue(analysisBudgetError());
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_TITLE);
    expect(alert).toHaveTextContent(
      `${FILTER_BUDGET_DESCRIPTION} Velg en kortere periode, eller fjern filteret på oppgave.`,
    );
    expect(alert).not.toHaveTextContent("Too much feedback data");
    expect(
      screen.queryByRole("button", { name: "Prøv igjen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Vis perioden / }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fjern filteret på oppgave" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last ned CSV" })).toBeEnabled();
    expect(consoleError).not.toHaveBeenCalled();

    search.params = {
      ...TASK_FILTER,
      dateMode: "fixed",
      fromDate: "2026-09-23",
      toDate: "2026-10-22",
    };
    rerender(<ExportPanel />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("moves focus to the alert when the same filters are downloaded again", async () => {
    search.params = TASK_FILTER;
    exportMock.mockRejectedValue(analysisBudgetError());
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("radio", { name: /^Excel \(XLSX\)/ }));
    await user.click(screen.getByRole("button", { name: "Last ned Excel" }));

    expect(exportMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  describe("when the disabled button has lost focus", () => {
    // Aksel disables the button while the export loads, and the browser then
    // moves focus to the page.
    function blurAndThen<T>(answer: () => T) {
      return async () => {
        (document.activeElement as HTMLElement | null)?.blur();
        return answer();
      };
    }

    it("moves focus to the alert when the export is refused", async () => {
      search.params = TASK_FILTER;
      exportMock.mockImplementation(
        blurAndThen(() => {
          throw analysisBudgetError();
        }),
      );
      const user = userEvent.setup();
      render(<ExportPanel />);

      await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

      expect(await screen.findByRole("alert")).toHaveFocus();
    });

    it("moves focus to the error when the export fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      exportMock.mockImplementation(
        blurAndThen(() => {
          throw new Error("Eksporten feilet");
        }),
      );
      const user = userEvent.setup();
      render(<ExportPanel />);

      await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Eksporten feilet");
      expect(alert).toHaveFocus();
    });

    it("moves focus back to the button after a download", async () => {
      exportMock.mockImplementation(
        blurAndThen(() => exportResult({ total: 1, count: 1 })),
      );
      const user = userEvent.setup();
      render(<ExportPanel />);

      await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

      await screen.findByText("Eksport fullført! Filen er lastet ned.");
      expect(
        screen.getByRole("button", { name: "Last ned CSV" }),
      ).toHaveFocus();
    });
  });

  it("moves focus to the download button when the error is closed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    exportMock.mockRejectedValue(new Error("Eksporten feilet"));
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: /lukk/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last ned CSV" })).toHaveFocus();
  });

  it("moves focus to the download button when the filter is removed", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    search.params = TASK_FILTER;
    search.setParams.mockResolvedValue(undefined);
    exportMock.mockRejectedValue(analysisBudgetError());
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    await user.click(
      await screen.findByRole("button", { name: "Fjern filteret på oppgave" }),
    );

    expect(search.setParams.mock.calls[0]?.[0]).toHaveProperty(
      "task",
      undefined,
    );
    expect(screen.getByRole("button", { name: "Last ned CSV" })).toHaveFocus();
  });

  it("leaves the focus where the user moved it while the filter was removed", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    search.params = TASK_FILTER;
    exportMock.mockRejectedValue(analysisBudgetError());
    const user = userEvent.setup();
    render(<ExportPanel />);
    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    const excel = screen.getByRole("radio", { name: /^Excel/ });
    search.setParams.mockImplementation(async () => excel.focus());

    await user.click(
      await screen.findByRole("button", { name: "Fjern filteret på oppgave" }),
    );

    expect(excel).toHaveFocus();
  });

  it("drops a refused export whose filters have changed", async () => {
    let rejectExport: (reason: unknown) => void = () => undefined;
    exportMock.mockReturnValue(
      new Promise((_, reject) => {
        rejectExport = reject;
      }) as never,
    );
    search.params = TASK_FILTER;
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    search.params = { team: "flex", surveyId: "survey-top-tasks" };
    rerender(<ExportPanel />);
    await act(async () => rejectExport(analysisBudgetError()));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(FILTERS_CHANGED);
    expect(screen.getByRole("button", { name: "Last ned CSV" })).toBeEnabled();
  });

  it("does not download a file for filters that have changed", async () => {
    let resolveExport: (value: unknown) => void = () => undefined;
    exportMock.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }) as never,
    );
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    search.params = { team: "flex", fromDate: "2026-09-23" };
    rerender(<ExportPanel />);
    await act(async () =>
      resolveExport(exportResult({ total: 12_345, count: 10_000 })),
    );

    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Eksport fullført! Filen er lastet ned."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/nyeste svarene av/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(FILTERS_CHANGED);

    search.params = { team: "flex", fromDate: "2026-10-01" };
    rerender(<ExportPanel />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("aborts the export when the filters change, and says so", async () => {
    exportUntilAborted();
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    expect(exportSignal()?.aborted).toBe(false);
    search.params = { team: "flex", fromDate: "2026-09-23" };
    rerender(<ExportPanel />);

    expect(exportSignal()?.aborted).toBe(true);
    expect(await screen.findByText(FILTERS_CHANGED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last ned CSV" })).toBeEnabled();
  });

  it("aborts the export when the page closes", async () => {
    const consoleError = vi.spyOn(console, "error");
    exportUntilAborted();
    const user = userEvent.setup();
    const { unmount } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    unmount();
    await act(async () => undefined);

    expect(exportSignal()?.aborted).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("keeps the retry for other errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    exportMock.mockRejectedValue(new Error("Nettverksfeil"));
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    expect(
      await screen.findByRole("button", { name: "Prøv igjen" }),
    ).toBeVisible();
    expect(screen.getByText("Nettverksfeil")).toBeVisible();
  });

  it("does not warn when every matching response is included", async () => {
    exportMock.mockResolvedValue(exportResult({ total: 42, count: 42 }));
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    expect(
      await screen.findByText("Eksport fullført! Filen er lastet ned."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nyeste svarene av/)).not.toBeInTheDocument();
  });

  it("does not warn when the API sends no counts", async () => {
    exportMock.mockResolvedValue(exportResult({ total: null, count: null }));
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    expect(
      await screen.findByText("Eksport fullført! Filen er lastet ned."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nyeste svarene av/)).not.toBeInTheDocument();
  });

  it("recommends Excel (XLSX) for Excel and uses plain format names", async () => {
    exportMock.mockResolvedValue(exportResult({ total: 1, count: 1 }));
    const user = userEvent.setup();
    render(<ExportPanel />);

    expect(
      screen.getByText("Regneark som åpnes direkte i Excel"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kommaseparert fil for videre behandling i skript og andre verktøy",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^Excel \(XLSX\)/ }));
    await user.click(screen.getByRole("button", { name: "Last ned Excel" }));

    expect(exportMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ format: "excel", team: "flex" }),
      signal: expect.any(AbortSignal),
    });
  });

  it("describes the columns in CSV and Excel without promising device or page", () => {
    render(<ExportPanel />);

    const description = screen.getByText(/CSV og Excel har én rad per/);
    expect(description).toHaveTextContent(
      "første vurdering, første fritekstsvar, skjermstørrelse og om tekst er maskert",
    );
    expect(description).toHaveTextContent(
      "JSON har alle svarene og konteksten fra appen, blant annet enhet og side.",
    );
  });
});
