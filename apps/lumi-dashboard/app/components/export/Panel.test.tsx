import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPanel } from "~/components/export/Panel";
import { exportServerFn } from "~/server/actions";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  ANALYSIS_BUDGET_TITLE,
  FILTER_BUDGET_DESCRIPTION,
} from "~/utils/analysisBudget";

const search = vi.hoisted(() => ({
  params: { team: "flex" } as Record<string, string>,
}));

vi.mock("~/server/actions", () => ({ exportServerFn: vi.fn() }));
vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: search.params }),
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

function budgetError() {
  return new ApiErrorException({
    status: 400,
    type: ErrorType.ANALYSIS_BUDGET_EXCEEDED,
    message: "Too much feedback data for in-memory analysis",
    timestamp: "2026-10-22T00:00:00Z",
  });
}

function exportResult(counts: { total: number | null; count: number | null }) {
  return {
    data: btoa("id\n"),
    filename: "lumi-export-2026-10-14.csv",
    contentType: "text/csv; charset=utf-8",
    ...counts,
  };
}

describe("ExportPanel", () => {
  beforeEach(() => {
    search.params = { team: "flex" };
    exportMock.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:lumi-export");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("announces a warning when the export is truncated", async () => {
    exportMock.mockResolvedValue(
      exportResult({ total: 12_345, count: 10_000 }),
    );
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(
      /Eksporten har de 10\s000 nyeste svarene av 12\s345\. Del opp perioden og eksporter hver del for seg for å få med alle\./,
    );
  });

  it("removes the truncation warning when the filters change", async () => {
    exportMock.mockResolvedValue(
      exportResult({ total: 12_345, count: 10_000 }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    search.params = { team: "flex", fromDate: "2026-09-01" };
    rerender(<ExportPanel />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("explains the analysis budget without a retry and clears it when the filters change", async () => {
    const consoleError = vi.spyOn(console, "error");
    search.params = { team: "flex", surveyId: "survey-top-tasks", task: "a" };
    exportMock.mockRejectedValue(budgetError());
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_TITLE);
    expect(alert).toHaveTextContent(FILTER_BUDGET_DESCRIPTION);
    expect(alert).not.toHaveTextContent("Too much feedback data");
    expect(
      screen.queryByRole("button", { name: "Prøv igjen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vis de siste 30 dagene i perioden" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last ned CSV" })).toBeEnabled();
    expect(consoleError).not.toHaveBeenCalled();

    search.params = {
      team: "flex",
      surveyId: "survey-top-tasks",
      task: "a",
      dateMode: "fixed",
      fromDate: "2026-09-23",
      toDate: "2026-10-22",
    };
    rerender(<ExportPanel />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops a refused export whose filters have changed", async () => {
    let rejectExport: (reason: unknown) => void = () => undefined;
    exportMock.mockReturnValue(
      new Promise((_, reject) => {
        rejectExport = reject;
      }) as never,
    );
    search.params = { team: "flex", surveyId: "survey-top-tasks", task: "a" };
    const user = userEvent.setup();
    const { rerender } = render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));
    search.params = { team: "flex", surveyId: "survey-top-tasks" };
    rerender(<ExportPanel />);
    await act(async () => rejectExport(budgetError()));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filtrene ble endret før eksporten var ferdig, så filen ble ikke lastet ned. Last ned på nytt.",
    );
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filtrene ble endret før eksporten var ferdig",
    );

    search.params = { team: "flex", fromDate: "2026-10-01" };
    rerender(<ExportPanel />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not warn when the API sends no counts", async () => {
    exportMock.mockResolvedValue(exportResult({ total: null, count: null }));
    const user = userEvent.setup();
    render(<ExportPanel />);

    await user.click(screen.getByRole("button", { name: "Last ned CSV" }));

    expect(
      await screen.findByText("Eksport fullført! Filen er lastet ned."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
