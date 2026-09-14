import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAnalysisProduct,
  getAnalysisPreview,
  getAnalysisProduct,
  lockAnalysisRelease,
  saveAnalysisDraft,
} from "~/server/actions/analysisProducts";
import {
  type AnalysisProduct,
  analysisConfirmation,
} from "~/types/analysisProducts";
import { AnalysisEditor } from "../AnalysisEditor";
import {
  catalog,
  document,
  preview,
  product,
  productId,
  team,
} from "./fixtures";

vi.mock("~/server/actions/analysisProducts", () => ({
  createAnalysisProduct: vi.fn(),
  getAnalysisPreview: vi.fn(),
  getAnalysisProduct: vi.fn(),
  lockAnalysisRelease: vi.fn(),
  saveAnalysisDraft: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));

const clients: QueryClient[] = [];
function setup(initial: AnalysisProduct | null = product) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const onSaved = vi.fn(async () => {});
  const onLocked = vi.fn(async () => {});
  const view = render(
    <QueryClientProvider client={client}>
      <AnalysisEditor
        team={team}
        product={initial}
        catalog={catalog}
        onSaved={onSaved}
        onLocked={onLocked}
      />
    </QueryClientProvider>,
  );
  return { ...view, onSaved, onLocked };
}
function changeName(value = "Mine lokale endringer") {
  fireEvent.change(screen.getByRole("textbox", { name: "Navn" }), {
    target: { value },
  });
}
function fillNewDocument() {
  changeName(document.name);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Hva skal dere bruke dataene til?" }),
    { target: { value: document.purpose } },
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Dataeier" }), {
    target: { value: document.dataOwner },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Teknisk ansvarlig" }), {
    target: { value: document.technicalOwner },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Dato for ny vurdering" }),
    { target: { value: dayjs().add(1, "month").format("DD.MM.YYYY") } },
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Metabase" }));
}
async function openConfirmation() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Lås første release" }),
  );
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /Jeg har kontrollert datagrunnlaget/,
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  vi.clearAllMocks();
  for (const action of [
    createAnalysisProduct,
    getAnalysisPreview,
    getAnalysisProduct,
    lockAnalysisRelease,
    saveAnalysisDraft,
  ]) {
    vi.mocked(action).mockReset();
  }
  vi.mocked(getAnalysisPreview).mockResolvedValue(structuredClone(preview));
  vi.mocked(getAnalysisProduct).mockResolvedValue(structuredClone(product));
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("AnalysisEditor confirmation and recovery", () => {
  it.each([
    {
      selection: {
        sources: Array.from({ length: 101 }, (_, index) => ({
          app: "app-a",
          surveyId: `survey-${index}`,
          fieldIds: [],
        })),
      },
      message: /Velg høyst 100 surveys og 500 svarfelt per survey/,
    },
    {
      selection: {
        sources: [
          {
            app: "app-a",
            surveyId: "survey-a",
            fieldIds: Array.from(
              { length: 501 },
              (_, index) => `field-${index}`,
            ),
          },
        ],
      },
      message: /Velg høyst 100 surveys og 500 svarfelt per survey/,
    },
    {
      selection: { dimensionKeys: ["invalid dimension"] },
      message: /Velg høyst 50 dimensjoner/,
    },
  ])("explains invalid data selection without sending a save ($selection)", async ({
    selection,
    message,
  }) => {
    if (!product.draft) throw new Error("Expected draft fixture");
    setup({
      ...product,
      draft: { ...product.draft, document: { ...document, ...selection } },
    });
    changeName();
    fireEvent.click(screen.getByRole("button", { name: "Lagre utkast" }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(saveAnalysisDraft).not.toHaveBeenCalled();
  });

  it("hides the saved preview immediately when the document becomes dirty", async () => {
    setup();
    expect(
      await screen.findByRole("button", { name: "Lås første release" }),
    ).toBeEnabled();
    changeName();
    expect(
      screen.queryByRole("button", { name: "Lås første release" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Kontroller tabellene" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Ulagrede endringer")).toBeInTheDocument();
    expect(lockAnalysisRelease).not.toHaveBeenCalled();
  });

  it("offers a working reload when preview belongs to another draft revision", async () => {
    vi.mocked(getAnalysisPreview).mockResolvedValueOnce({
      ...preview,
      draftRevision: 2,
    });
    setup();
    const reload = await screen.findByRole("button", {
      name: "Hent lagret utkast / produktstatus",
    });
    expect(
      screen.queryByRole("button", { name: "Lås første release" }),
    ).not.toBeInTheDocument();
    fireEvent.click(reload);
    expect(
      await screen.findByRole("button", { name: "Lås første release" }),
    ).toBeEnabled();
    expect(getAnalysisProduct).toHaveBeenCalledWith({
      data: { team, productId },
    });
  });

  it("preserves edits after conflict and only discards them after explicit confirmation", async () => {
    vi.mocked(saveAnalysisDraft).mockResolvedValue({
      ok: false,
      reason: "conflict",
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    setup();
    await screen.findByRole("button", { name: "Lås første release" });
    changeName();
    fireEvent.click(screen.getByRole("button", { name: "Lagre utkast" }));
    await screen.findByText(/Dine lokale valg er beholdt/);
    expect(screen.getByRole("textbox", { name: "Navn" })).toHaveValue(
      "Mine lokale endringer",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Hent lagret utkast / produktstatus",
      }),
    );
    expect(confirm).toHaveBeenCalled();
    expect(getAnalysisProduct).not.toHaveBeenCalled();
    expect(lockAnalysisRelease).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Hent lagret utkast / produktstatus",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Navn" })).toHaveValue(
        document.name,
      ),
    );
  });

  it("blocks duplicate creation after an ambiguous network result", async () => {
    vi.mocked(createAnalysisProduct).mockRejectedValue(
      new Error("connection lost"),
    );
    setup(null);
    fillNewDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lagre utkast" }));
    await screen.findByText(/Uklart om produktet ble opprettet/);
    expect(screen.getByRole("button", { name: "Lagre utkast" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Navn" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lagre utkast" }));
    expect(createAnalysisProduct).toHaveBeenCalledTimes(1);
  });

  it.each([
    "invalid-input",
    "too-large",
  ] as const)("keeps the new form editable after definitive %s rejection", async (reason) => {
    vi.mocked(createAnalysisProduct).mockResolvedValue({ ok: false, reason });
    setup(null);
    fillNewDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lagre utkast" }));
    await screen.findByText(/Ingenting ble lagret/);
    expect(screen.getByRole("textbox", { name: "Navn" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Lagre utkast" })).toBeEnabled();
    expect(
      screen.queryByText(/Uklart om produktet ble opprettet/),
    ).not.toBeInTheDocument();
  });

  it("retries the exact canonical confirmation after an unknown release result", async () => {
    const release = {
      id: "33333333-3333-4333-8333-333333333333",
      productId,
      releaseNumber: 1,
      sourceDocument: document,
      publishedAt: "2026-09-09T12:00:00Z",
    };
    vi.mocked(lockAnalysisRelease)
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ ok: true, value: release });
    const { onLocked } = setup();
    await openConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Lås release" }));
    const retry = await screen.findByRole("button", {
      name: "Prøv samme bekreftelse igjen",
    });
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeDisabled();
    expect(getAnalysisPreview).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(onLocked).toHaveBeenCalledWith(release));
    const expected = {
      data: { team, productId, confirmation: analysisConfirmation(preview) },
    };
    expect(lockAnalysisRelease).toHaveBeenNthCalledWith(1, expected);
    expect(lockAnalysisRelease).toHaveBeenNthCalledWith(2, expected);
  });

  it("does not invoke navigation callbacks for a save resolving after unmount", async () => {
    let resolve!: (value: { ok: true; value: AnalysisProduct }) => void;
    vi.mocked(saveAnalysisDraft).mockReturnValue(
      new Promise((complete) => {
        resolve = complete;
      }),
    );
    const { unmount, onSaved, onLocked } = setup();
    await screen.findByRole("button", { name: "Lås første release" });
    changeName();
    fireEvent.click(screen.getByRole("button", { name: "Lagre utkast" }));
    await waitFor(() => expect(saveAnalysisDraft).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      resolve({ ok: true, value: product });
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onLocked).not.toHaveBeenCalled();
  });
});
