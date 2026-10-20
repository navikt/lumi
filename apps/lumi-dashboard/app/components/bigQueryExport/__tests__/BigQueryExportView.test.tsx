import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBigQueryExport,
  runBigQueryExport,
  saveBigQueryExport,
  verifyBigQueryExport,
} from "~/server/actions/bigQueryExport";
import type { BigQueryExportStatus } from "~/types/bigQueryExport";
import { PUBLIC_DEMO_READ_ONLY_MESSAGE } from "~/utils/publicDemo";
import { BigQueryExportView } from "../BigQueryExportView";

vi.mock("~/server/actions/bigQueryExport", () => ({
  getBigQueryExport: vi.fn(),
  verifyBigQueryExport: vi.fn(),
  saveBigQueryExport: vi.fn(),
  runBigQueryExport: vi.fn(),
  stopBigQueryExport: vi.fn(),
}));

const team = "team-esyfo";
const base: BigQueryExportStatus = {
  team,
  available: true,
  availability: "AVAILABLE",
  location: "europe-north1",
  serviceAccount: "lumi-api@nais-dev.iam.gserviceaccount.com",
  suggestedProjectId: "team-esyfo-dev-1a2b",
  destination: null,
};
const active: BigQueryExportStatus = {
  ...base,
  destination: {
    projectId: "team-esyfo-dev-1a2b",
    datasetId: "lumi",
    includeFreeText: false,
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-20T10:00:00Z",
    runState: "IDLE",
    lastRun: {
      status: "SUCCEEDED",
      startedAt: "2026-10-19T23:00:00Z",
      finishedAt: "2026-10-19T23:00:05Z",
    },
    lastSuccessAt: "2026-10-19T23:00:00Z",
    lastSuccessRows: { svar: 1284, innsendinger: 512, fritekst: null },
    nextScheduledRunAt: "2099-01-01T00:00:00Z",
  },
};

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BigQueryExportView team={team} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.mocked(getBigQueryExport).mockReset());
afterEach(cleanup);

describe("BigQueryExportView", () => {
  it("says when the export is not turned on", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue({
      ...base,
      available: false,
      availability: "DISABLED",
    });
    renderView();
    expect(
      await screen.findByText(
        "BigQuery-eksport er ikke slått på i dette miljøet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start eksporten" }),
    ).toBeNull();
  });

  it("explains the pilot to teams outside it", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue({
      ...base,
      available: false,
      availability: "PILOT_ONLY",
    });
    renderView();
    expect(
      await screen.findByText("BigQuery-eksport er i pilot"),
    ).toBeInTheDocument();
  });

  it("prefills the team project and shows SQL with Lumi's service account", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    renderView();

    expect(
      await screen.findByRole("textbox", { name: /GCP-prosjekt/ }),
    ).toHaveValue("team-esyfo-dev-1a2b");
    expect(
      screen.getByLabelText("SQL for å opprette datasettet"),
    ).toHaveTextContent(
      'TO "serviceAccount:lumi-api@nais-dev.iam.gserviceaccount.com";',
    );
  });

  it("shows what to fix when the connection check finds problems", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    vi.mocked(verifyBigQueryExport).mockResolvedValue({
      ok: true,
      value: { ok: false, problems: [{ code: "DATASET_ACCESS_DENIED" }] },
    });
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Sjekk tilkoblingen" }),
    );

    expect(
      await screen.findByText("Lumi har ikke tilgang til datasettet"),
    ).toBeInTheDocument();
    expect(verifyBigQueryExport).toHaveBeenCalledWith({
      data: { team, projectId: "team-esyfo-dev-1a2b", datasetId: "lumi" },
    });
  });

  it("does not call the API with an invalid dataset name", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    vi.mocked(saveBigQueryExport).mockReset();
    renderView();

    fireEvent.change(await screen.findByRole("textbox", { name: /Datasett/ }), {
      target: { value: "lumi-data" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start eksporten" }));

    expect(
      await screen.findByText(
        "Bruk bare bokstaver, tall og understrek, høyst 100 tegn.",
      ),
    ).toBeInTheDocument();
    expect(saveBigQueryExport).not.toHaveBeenCalled();
  });

  it("shows the demo refusal when saving in the public demo", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    vi.mocked(saveBigQueryExport).mockRejectedValue(
      new Error(PUBLIC_DEMO_READ_ONLY_MESSAGE),
    );
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Start eksporten" }),
    );

    expect(
      await screen.findByText("Demoen lagrer ikke endringer."),
    ).toBeInTheDocument();
  });

  it("shows status, counts and next steps for an active export", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(active);
    renderView();

    expect(
      await screen.findByText("Tabellene er oppdatert"),
    ).toBeInTheDocument();
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(
      screen.getByText(/^1\s284 svar · 512 innsendinger$/u),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Registrer dataproduktet" }),
    ).toBeInTheDocument();
  });

  it("explains a failed run with the team's next action", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue({
      ...active,
      destination: {
        ...(active.destination as NonNullable<
          BigQueryExportStatus["destination"]
        >),
        lastRun: {
          status: "FAILED",
          startedAt: "2026-10-20T01:00:00Z",
          finishedAt: "2026-10-20T01:00:02Z",
          errorCode: "TABLE_WRITE_DENIED",
        },
      },
    });
    renderView();

    expect(await screen.findByText("Siste kjøring feilet")).toBeInTheDocument();
    expect(
      screen.getByText("Lumi får ikke lage tabeller i datasettet"),
    ).toBeInTheDocument();
  });

  it("queues a run and disables the button while it is busy", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(active);
    vi.mocked(runBigQueryExport).mockResolvedValue({
      ok: true,
      value: {
        ...active,
        destination: {
          ...(active.destination as NonNullable<
            BigQueryExportStatus["destination"]
          >),
          runState: "QUEUED",
        },
      },
    });
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Oppdater nå" }));

    await waitFor(() =>
      expect(screen.getByText("Kjøringen starter om litt")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Oppdater nå" })).toBeDisabled();
  });
});
