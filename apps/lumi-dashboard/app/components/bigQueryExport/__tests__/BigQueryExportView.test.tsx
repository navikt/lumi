import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBigQueryExport,
  runBigQueryExport,
  saveBigQueryExport,
  stopBigQueryExport,
  verifyBigQueryExport,
} from "~/server/actions/bigQueryExport";
import type {
  BigQueryExportDestination,
  BigQueryExportStatus,
} from "~/types/bigQueryExport";
import { PUBLIC_DEMO_READ_ONLY_MESSAGE } from "~/utils/publicDemo";
import { BigQueryExportView } from "../BigQueryExportView";
import { formatClock } from "../format";

vi.mock("~/server/actions/bigQueryExport", () => ({
  getBigQueryExport: vi.fn(),
  verifyBigQueryExport: vi.fn(),
  saveBigQueryExport: vi.fn(),
  runBigQueryExport: vi.fn(),
  stopBigQueryExport: vi.fn(),
}));

const team = "team-esyfo";
const project = "team-esyfo-dev-1a2b";
const base: BigQueryExportStatus = {
  team,
  available: true,
  availability: "AVAILABLE",
  location: "europe-north1",
  serviceAccount: "lumi-api@nais-dev.iam.gserviceaccount.com",
  suggestedProjectId: project,
  freeTextAvailable: true,
  destination: null,
};
const destination: BigQueryExportDestination = {
  projectId: project,
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
};
const active: BigQueryExportStatus = { ...base, destination };

function withDestination(
  changes: Partial<BigQueryExportDestination>,
  status: Partial<BigQueryExportStatus> = {},
): BigQueryExportStatus {
  return { ...base, ...status, destination: { ...destination, ...changes } };
}

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <BigQueryExportView team={team} />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

/** The Process step with this title. The first match is the step title. */
function step(title: string) {
  return screen.getAllByText(title)[0].closest("li");
}

async function openSettings() {
  fireEvent.click(await screen.findByRole("button", { name: "Vis mer" }));
}

beforeEach(() => {
  vi.mocked(getBigQueryExport).mockReset();
  vi.mocked(verifyBigQueryExport).mockReset();
  vi.mocked(saveBigQueryExport).mockReset();
  vi.mocked(runBigQueryExport).mockReset();
  vi.mocked(stopBigQueryExport).mockReset();
});
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
      freeTextAvailable: false,
    });
    renderView();
    expect(
      await screen.findByText("BigQuery-eksport er i pilot"),
    ).toBeInTheDocument();
  });

  it("shows a retry when the first load fails", async () => {
    vi.mocked(getBigQueryExport)
      .mockRejectedValueOnce(new Error("nede"))
      .mockResolvedValue(active);
    renderView();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lumi fikk ikke hentet BigQuery-eksporten for teamet.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Prøv igjen" }));
    expect(
      await screen.findByRole("heading", { name: "Tabellene er oppdatert" }),
    ).toBeInTheDocument();
  });

  it("keeps the page when a background update fails", async () => {
    vi.mocked(getBigQueryExport)
      .mockResolvedValueOnce(active)
      .mockRejectedValueOnce(new Error("nede"))
      .mockResolvedValue(active);
    const { client } = renderView();
    expect(
      await screen.findByRole("heading", { name: "Tabellene er oppdatert" }),
    ).toBeInTheDocument();

    await act(() =>
      client.refetchQueries({ queryKey: ["bigquery-export", team] }),
    );

    const warning = await screen.findByText(
      "Lumi fikk ikke oppdatert statusen.",
    );
    expect(warning.closest("[aria-live='polite']")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Tabellene er oppdatert" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prøv igjen" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Lumi fikk ikke oppdatert statusen."),
      ).toBeNull(),
    );
  });

  it("prefills the team project and shows SQL with Lumi's service account", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    renderView();

    expect(
      await screen.findByRole("textbox", { name: /GCP-prosjekt/ }),
    ).toHaveValue(project);
    expect(
      screen.getByRole("figure", { name: "SQL for BigQuery" }),
    ).toHaveTextContent(
      'TO "serviceAccount:lumi-api@nais-dev.iam.gserviceaccount.com";',
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Sett opp eksporten" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Sett opp eksporten" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Les guiden før du starter åpnes i ny fane",
      }),
    ).toHaveAttribute(
      "href",
      "https://navikt.github.io/lumi/dashboard/bigquery#ansvar",
    );
  });

  it("explains why the SQL cannot be copied before the fields are filled", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue({
      ...base,
      suggestedProjectId: null,
    });
    renderView();

    expect(
      await screen.findByRole("button", { name: "Kopier SQL" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Fyll inn GCP-prosjekt og datasett for å kopiere SQL-en.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /GCP-prosjekt/ }), {
      target: { value: project },
    });
    expect(screen.getByRole("button", { name: "Kopier SQL" })).toBeEnabled();
    expect(
      screen.queryByText(
        "Fyll inn GCP-prosjekt og datasett for å kopiere SQL-en.",
      ),
    ).toBeNull();
  });

  it("checks a field when the user leaves it and focuses the first invalid field", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue({
      ...base,
      suggestedProjectId: null,
    });
    renderView();

    const projectField = await screen.findByRole("textbox", {
      name: /GCP-prosjekt/,
    });
    expect(
      screen.queryByText(
        "Skriv ID-en til GCP-prosjektet, for eksempel team-esyfo-prod-1a2b.",
      ),
    ).toBeNull();
    fireEvent.blur(projectField);
    expect(
      screen.getByText(
        "Skriv ID-en til GCP-prosjektet, for eksempel team-esyfo-prod-1a2b.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sjekk tilkoblingen" }));
    expect(projectField).toHaveFocus();
    expect(verifyBigQueryExport).not.toHaveBeenCalled();
  });

  it("shows what to fix and offers the SQL when the check finds an access problem", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    vi.mocked(verifyBigQueryExport).mockResolvedValue({
      ok: true,
      value: { ok: false, problems: [{ code: "DATASET_ACCESS_DENIED" }] },
    });
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Sjekk tilkoblingen" }),
    );

    const problem = await screen.findByText(
      "Lumi har ikke tilgang til datasettet",
    );
    expect(problem.closest("[aria-live='polite']")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Kopier SQL" })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole("button", { name: "Vis SQL-en" }),
    ).toBeInTheDocument();
    expect(verifyBigQueryExport).toHaveBeenCalledWith({
      data: { team, projectId: project, datasetId: "lumi" },
    });
  });

  it("moves the active step after the SQL is copied and the check succeeds", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    vi.mocked(verifyBigQueryExport).mockResolvedValue({
      ok: true,
      value: { ok: true, problems: [] },
    });
    renderView();

    await screen.findByRole("button", { name: "Kopier SQL" });
    expect(step("Opprett datasettet")).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "Kopier SQL" }));
    expect(step("Sjekk tilkoblingen")).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "Sjekk tilkoblingen" }));
    expect(
      await screen.findByText(
        "Datasettet er klart. Lumi kan lage tabeller i det.",
      ),
    ).toBeInTheDocument();
    expect(step("Velg innhold og start")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("does not call the API with an invalid dataset name", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    renderView();

    const dataset = await screen.findByRole("textbox", { name: /Datasett/ });
    fireEvent.change(dataset, { target: { value: "lumi-data" } });
    fireEvent.click(screen.getByRole("button", { name: "Start eksporten" }));

    expect(
      await screen.findByText(
        "Bruk bare bokstaver, tall og understrek, høyst 100 tegn.",
      ),
    ).toBeInTheDocument();
    expect(dataset).toHaveFocus();
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Demoen lagrer ikke endringer.",
    );
  });

  it("offers free text with a warning when the team may export it", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(base);
    renderView();

    const checkbox = await screen.findByRole("checkbox", {
      name: "Ta med fritekstsvar",
    });
    expect(screen.queryByText(/Oppdater teamets PVK/)).toBeNull();
    fireEvent.click(checkbox);

    const warning = screen.getByText(/Oppdater teamets PVK og behandlingen/);
    expect(warning.closest("[aria-live='polite']")).not.toBeNull();
  });

  it("hides free text when the team may not export it", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue({
      ...base,
      freeTextAvailable: false,
    });
    vi.mocked(saveBigQueryExport).mockResolvedValue({ ok: true, value: base });
    renderView();

    expect(
      await screen.findByText(/Fritekst kan ikke eksporteres for teamet ennå/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Ta med fritekstsvar" }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: /^#lumi/ })).toHaveAttribute(
      "href",
      "https://nav-it.slack.com/archives/C0AG2FKSSMD",
    );

    fireEvent.click(screen.getByRole("button", { name: "Start eksporten" }));
    await waitFor(() =>
      expect(saveBigQueryExport).toHaveBeenCalledWith({
        data: {
          team,
          projectId: project,
          datasetId: "lumi",
          includeFreeText: false,
        },
      }),
    );
  });

  it("moves focus to the status when the export starts", async () => {
    const started = withDestination({
      runState: "QUEUED",
      lastRun: null,
      lastSuccessAt: null,
      lastSuccessRows: null,
      nextScheduledRunAt: new Date(Date.now() + 1_000).toISOString(),
    });
    vi.mocked(getBigQueryExport)
      .mockResolvedValueOnce(base)
      .mockResolvedValue(started);
    vi.mocked(saveBigQueryExport).mockResolvedValue({
      ok: true,
      value: started,
    });
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Start eksporten" }),
    );

    const heading = await screen.findByRole("heading", {
      name: "Kjøringen starter om litt",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByRole("heading", { name: "Neste steg" })).toBeNull();
  });

  it("shows status, counts and next steps for an active export", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(active);
    renderView();

    expect(
      await screen.findByRole("heading", { name: "Tabellene er oppdatert" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(
      screen.getByText(/^1\s284 svar · 512 innsendinger$/u),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Del dataene på Datamarkedsplassen",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Åpne datasettet i BigQuery/ }),
    ).toHaveAttribute("target", "_blank");
  });

  it("explains a failed run and offers the SQL that fixes it", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(
      withDestination({
        lastRun: {
          status: "FAILED",
          startedAt: "2026-10-20T01:00:00Z",
          finishedAt: "2026-10-20T01:00:02Z",
          errorCode: "TABLE_WRITE_DENIED",
        },
      }),
    );
    renderView();

    expect(
      await screen.findByRole("heading", { name: "Siste kjøring feilet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lumi får ikke lage tabeller i datasettet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kopier SQL" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: "SQL for BigQuery" }),
    ).toHaveTextContent(`ON SCHEMA \`${project}.lumi\``);
  });

  it("queues a run and disables the button while it is busy", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(active);
    vi.mocked(runBigQueryExport).mockResolvedValue({
      ok: true,
      value: withDestination({
        runState: "QUEUED",
        nextScheduledRunAt: new Date(Date.now() + 1_000).toISOString(),
      }),
    });
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Oppdater tabellene nå" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Kjøringen starter om litt")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Oppdater tabellene nå" }),
    ).toBeDisabled();
  });

  it("says when a queued run waits for the previous one", async () => {
    const startsAt = new Date(Date.now() + 4 * 60_000).toISOString();
    vi.mocked(getBigQueryExport).mockResolvedValue(
      withDestination({ runState: "QUEUED", nextScheduledRunAt: startsAt }),
    );
    renderView();

    expect(
      await screen.findByRole("heading", {
        name: `I kø. Starter rundt kl. ${formatClock(startsAt)}.`,
      }),
    ).toBeInTheDocument();
  });

  it("confirms saved settings without resetting the form", async () => {
    const saved = withDestination({
      datasetId: "lumi_ny",
      runState: "QUEUED",
      nextScheduledRunAt: new Date(Date.now() + 1_000).toISOString(),
    });
    vi.mocked(getBigQueryExport)
      .mockResolvedValueOnce(active)
      .mockResolvedValue(saved);
    vi.mocked(saveBigQueryExport).mockResolvedValue({ ok: true, value: saved });
    renderView();
    await openSettings();

    fireEvent.change(screen.getByRole("textbox", { name: /Datasett/ }), {
      target: { value: "lumi_ny" },
    });
    expect(
      screen.getByText(/Når du lagrer, sletter Lumi tabellene i/),
    ).toHaveTextContent(`${project}.lumi`);
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    const confirmation = await screen.findByText(
      "Endringene er lagret. Lumi oppdaterer tabellene i løpet av noen minutter.",
    );
    expect(confirmation.closest("[aria-live='polite']")).not.toBeNull();
    await waitFor(() =>
      expect(confirmation.closest("[tabindex='-1']")).toHaveFocus(),
    );
    expect(screen.getByRole("textbox", { name: /Datasett/ })).toHaveValue(
      "lumi_ny",
    );
    expect(screen.queryByText(/Når du lagrer, sletter Lumi/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Lagre endringer" }),
    ).toBeDisabled();
    expect(saveBigQueryExport).toHaveBeenCalledWith({
      data: {
        team,
        projectId: project,
        datasetId: "lumi_ny",
        includeFreeText: false,
      },
    });
  });

  it("warns that saving deletes the fritekst table when free text is turned off", async () => {
    vi.mocked(getBigQueryExport).mockResolvedValue(
      withDestination({ includeFreeText: true }),
    );
    renderView();
    await openSettings();

    expect(screen.queryByText(/Når du lagrer/)).toBeNull();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Ta med fritekstsvar" }),
    );

    expect(
      screen.getByText("Når du lagrer, sletter Lumi tabellen fritekst."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lagre endringer" }),
    ).toHaveAccessibleDescription(/sletter Lumi tabellen fritekst/);
  });

  it("turns free text off when the team may no longer export it", async () => {
    const closed = withDestination(
      { includeFreeText: true },
      { freeTextAvailable: false },
    );
    vi.mocked(getBigQueryExport).mockResolvedValue(closed);
    vi.mocked(saveBigQueryExport).mockResolvedValue({
      ok: true,
      value: closed,
    });
    renderView();
    await openSettings();

    expect(screen.getByText("Bytt datasett.")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Ta med fritekstsvar" }),
    ).toBeNull();
    expect(
      screen.getByText(/Fritekst kan ikke eksporteres for teamet ennå/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Når du lagrer, sletter Lumi tabellen fritekst."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));
    await waitFor(() =>
      expect(saveBigQueryExport).toHaveBeenCalledWith({
        data: {
          team,
          projectId: project,
          datasetId: "lumi",
          includeFreeText: false,
        },
      }),
    );
  });

  it("moves focus to the notice after the export is stopped", async () => {
    vi.mocked(getBigQueryExport)
      .mockResolvedValueOnce(active)
      .mockResolvedValue(base);
    vi.mocked(stopBigQueryExport).mockResolvedValue({
      ok: true,
      value: { tablesRemoved: true },
    });
    renderView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Stopp eksporten" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "Ja, stopp eksporten og slett Lumis tabeller",
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Stopp eksporten" }),
    );

    const notice = await screen.findByText(
      "Eksporten er stoppet, og Lumis tabeller er slettet.",
    );
    await waitFor(() =>
      expect(notice.closest("[tabindex='-1']")).toHaveFocus(),
    );
    expect(
      screen.getByRole("button", { name: "Start eksporten" }),
    ).toBeInTheDocument();
  });
});
