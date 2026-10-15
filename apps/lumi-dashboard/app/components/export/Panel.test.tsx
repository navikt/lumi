import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPanel } from "~/components/export/Panel";
import { exportServerFn } from "~/server/actions";

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
