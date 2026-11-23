import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAppProbeSubmission } from "~/server/releaseVerificationAppToken.server";
import { Route } from "../release-verification";

const api = vi.hoisted(() => ({
  fetchReleaseVerificationConfigServerFn: vi.fn(),
  fetchReleaseVerificationRunServerFn: vi.fn(),
  submitAppTokenProbeServerFn: vi.fn(),
  submitReleaseVerificationServerFn: vi.fn(),
}));
vi.mock("~/server/actions", () => api);
vi.mock("~/components/shared/Header", () => ({ Header: () => null }));

const surveyId = "lumi-release-verification-20261123-8a0dc3b1";
const initialReceiptId = "4682b146-1e38-4ca1-ae68-09b3427143c5";
const closingReceiptId = "d961ea06-759b-4fad-97d4-ce33ff4b7ca9";
const appReceiptId = "86775a2f-6b5d-425d-811b-fc40f721a9c9";
const started = "2026-11-23T10:00:00.000Z";
const ended = "2026-11-23T10:16:00.000Z";
const initial = {
  phase: "initial",
  status: "verified",
  receiptId: initialReceiptId,
  storedAt: started,
  duplicate: null,
  mismatches: [],
};
const closing = {
  ...initial,
  phase: "closing",
  receiptId: closingReceiptId,
  storedAt: ended,
};
const appToken = { ...initial, phase: "app-token", receiptId: appReceiptId };

async function openRun(receipts: Record<string, string> = {}) {
  const root = createRootRoute();
  const page = createRoute({
    getParentRoute: () => root,
    path: "/release-verification",
    component: Route.options.component,
    validateSearch: Route.options.validateSearch,
  });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({
      initialEntries: [
        "/release-verification?" +
          new URLSearchParams({ surveyId, ...receipts }),
      ],
    }),
  });
  await router.load();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.fetchReleaseVerificationConfigServerFn.mockResolvedValue({
    enabled: true,
    surveyId,
    dashboardTeam: "team-esyfo",
    dashboardApp: "lumi-dashboard",
    authMode: "azure-obo",
    profile: "dev-authenticated-roundtrip",
    environment: "dev-gcp",
    holdDurationMs: 900000,
    preflight: {
      status: "passed",
      checkedAt: started,
      team: "team-esyfo",
      app: "lumi-dashboard",
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

it("stops the run instructions when only the app receipt mismatches", async () => {
  api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
    observedAt: ended,
    initial,
    closing,
    appToken: {
      ...appToken,
      status: "mismatch",
      mismatches: ["context-channel"],
    },
  });
  await openRun({ initialReceiptId, closingReceiptId, appReceiptId });
  expect(
    await screen.findByRole("heading", { name: "Kjøringen er stoppet" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Start- og sluttproben er bestått/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(
      "Innsending med app-token: Readback feilet: context-channel",
    ),
  ).toBeVisible();
});

it.each([false, true])(
  "hides the widget after a missing app receipt (start receipt present: %s)",
  async (hasStart) => {
    api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
      observedAt: ended,
      initial: hasStart ? initial : null,
      closing: null,
      appToken: {
        ...appToken,
        status: "not-found",
        storedAt: null,
        mismatches: ["receipt-not-found"],
      },
    });
    await openRun(
      hasStart ? { initialReceiptId, appReceiptId } : { appReceiptId },
    );
    expect(
      await screen.findByRole("heading", { name: "Kjøringen er stoppet" }),
    ).toBeVisible();
    expect(screen.queryByRole("radio", { name: "4. Bra" })).toBeNull();
    expect(screen.queryByText(/Åpne widgeten|Holdetiden er ferdig/)).toBeNull();
  },
);

it.each([
  ["start", { initialReceiptId }],
  ["app", { appReceiptId }],
])(
  "keeps the widget closed while a shared %s receipt is loading or cannot be read",
  async (_phase, receipts) => {
    let failRead!: (error: Error) => void;
    api.fetchReleaseVerificationRunServerFn.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failRead = reject;
        }),
    );
    await openRun(receipts);
    expect(
      await screen.findByText("Leser receipts fra databasen …", {
        selector: "p",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("radio", { name: "4. Bra" })).toBeNull();
    await act(async () => failRead(new Error("Utilgjengelig")));
    expect(
      await screen.findByText(
        "Kunne ikke rekonstruere rapporten fra receipts.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("radio", { name: "4. Bra" })).toBeNull();
  },
);

it("hides the app-token button once the run has stopped", async () => {
  api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
    observedAt: started,
    initial: { ...initial, status: "mismatch", mismatches: ["survey-id"] },
    closing: null,
    appToken: null,
  });
  await openRun({ initialReceiptId });
  expect(
    await screen.findByRole("heading", { name: "Kjøringen er stoppet" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Send med app-token" }),
  ).toBeNull();
});

it("replaces an early closing receipt with the resubmitted one before the next read", async () => {
  const resubmitted = {
    ...closing,
    receiptId: "0b7f3a52-6f0e-4c58-9d0a-3c1e5b7a9f10",
  };
  api.fetchReleaseVerificationRunServerFn
    .mockResolvedValueOnce({
      observedAt: ended,
      initial,
      closing: { ...closing, storedAt: "2026-11-23T10:14:00.000Z" },
      appToken: null,
    })
    .mockImplementationOnce(() => new Promise(() => {}));
  api.submitReleaseVerificationServerFn.mockResolvedValueOnce(resubmitted);
  const router = await openRun({ initialReceiptId, closingReceiptId });
  fireEvent.click(await screen.findByRole("radio", { name: "4. Bra" }));
  fireEvent.click(screen.getByRole("radio", { name: /Kontrollkode RV-/ }));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(
    await screen.findByText(/Start- og sluttproben er bestått/),
  ).toBeVisible();
  expect(router.state.location.search).toMatchObject({
    initialReceiptId,
    closingReceiptId: resubmitted.receiptId,
  });
});

it("retains a reloaded start receipt throughout app submission and readback", async () => {
  const held = { observedAt: started, initial, closing: null, appToken: null };
  let finishRead!: (value: unknown) => void;
  api.fetchReleaseVerificationRunServerFn
    .mockResolvedValueOnce(held)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
  api.submitAppTokenProbeServerFn.mockResolvedValue(appToken);
  const router = await openRun({ initialReceiptId });
  expect(await screen.findByText(/Startproben er bevist/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Send med app-token" }));
  await waitFor(() =>
    expect(api.fetchReleaseVerificationRunServerFn).toHaveBeenCalledTimes(2),
  );
  expect(router.state.location.search).toMatchObject({
    initialReceiptId,
    appReceiptId,
  });
  expect(screen.getByText(/Startproben er bevist/)).toBeVisible();
  expect(screen.queryByRole("radio", { name: "4. Bra" })).toBeNull();
  await act(async () => finishRead({ ...held, appToken }));
  expect(screen.getByText(/Startproben er bevist/)).toBeVisible();
});

it("reads the same receipt again after team access is restored", async () => {
  const run = { observedAt: ended, initial, closing, appToken };
  api.fetchReleaseVerificationRunServerFn
    .mockResolvedValueOnce({
      ...run,
      appToken: {
        ...appToken,
        status: "unavailable",
        storedAt: null,
        mismatches: ["readback-access"],
      },
    })
    .mockResolvedValueOnce(run);
  await openRun({ initialReceiptId, closingReceiptId, appReceiptId });
  expect(
    await screen.findByText(/Kontroller innlogging og teamtilgang/),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Kjøringen pågår" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Prøv readback igjen" }));
  expect(
    await screen.findByRole("heading", {
      name: "Kontrollert dev-kjede bestått",
    }),
  ).toBeVisible();
  expect(api.fetchReleaseVerificationRunServerFn.mock.calls[1]).toEqual(
    api.fetchReleaseVerificationRunServerFn.mock.calls[0],
  );
  expect(api.submitAppTokenProbeServerFn).not.toHaveBeenCalled();
});

it("does not poll while read access is missing", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
    observedAt: started,
    initial,
    closing: null,
    appToken: {
      ...appToken,
      status: "unavailable",
      storedAt: null,
      mismatches: ["readback-access"],
    },
  });
  await openRun({ initialReceiptId, appReceiptId });
  await screen.findByText(/Kontroller innlogging og teamtilgang/);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(api.fetchReleaseVerificationRunServerFn).toHaveBeenCalledTimes(1);
});

it("dates an unread run from the preflight check and not the browser clock", async () => {
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    now: new Date("2026-11-23T12:00:00.000Z"),
  });
  await openRun();
  await screen.findByRole("button", { name: "Send med app-token" });
  expect(
    JSON.parse(document.querySelector("pre")?.textContent ?? ""),
  ).toMatchObject({ generatedAt: started, startedAt: started });
});

it("dates the report from the new app receipt while the next read is pending", async () => {
  const later = "2026-11-23T10:19:00.000Z";
  api.fetchReleaseVerificationRunServerFn
    .mockResolvedValueOnce({
      observedAt: ended,
      initial,
      closing,
      appToken: null,
    })
    .mockImplementationOnce(() => new Promise(() => {}));
  api.submitAppTokenProbeServerFn.mockResolvedValue({
    ...appToken,
    storedAt: later,
  });
  await openRun({ initialReceiptId, closingReceiptId });
  await screen.findByText(/Start- og sluttproben er bestått/);
  fireEvent.click(screen.getByRole("button", { name: "Send med app-token" }));
  await screen.findByRole("heading", { name: "Kontrollert dev-kjede bestått" });
  expect(
    JSON.parse(document.querySelector("pre")?.textContent ?? ""),
  ).toMatchObject({
    outcome: "passed",
    generatedAt: later,
    finishedAt: later,
  });
});

it("keeps a failed app attempt out of the shareable report and allows retry", async () => {
  api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
    observedAt: ended,
    initial,
    closing,
    appToken: null,
  });
  api.submitAppTokenProbeServerFn
    .mockRejectedValueOnce(new Error("Texas svarte ikke"))
    .mockResolvedValueOnce(appToken);
  const router = await openRun({ initialReceiptId, closingReceiptId });
  await screen.findByText(/Start- og sluttproben er bestått/);
  fireEvent.click(screen.getByRole("button", { name: "Send med app-token" }));
  expect(await screen.findByText("Texas svarte ikke")).toBeVisible();
  const json = document.querySelector("pre")?.textContent ?? "";
  expect(json).not.toContain("Texas svarte ikke");
  expect(JSON.parse(json)).toMatchObject({
    outcome: "pending",
    finishedAt: null,
    coverage: { appTokenRoundTrip: "pending" },
  });
  api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
    observedAt: ended,
    initial,
    closing,
    appToken,
  });
  fireEvent.click(screen.getByRole("button", { name: "Send med app-token" }));
  expect(
    await screen.findByRole("heading", {
      name: "Kontrollert dev-kjede bestått",
    }),
  ).toBeVisible();
  expect(router.state.location.search).toMatchObject({
    initialReceiptId,
    closingReceiptId,
    appReceiptId,
  });
});

it("discards a late app receipt after navigating to a different run", async () => {
  let finishSubmit!: (value: unknown) => void;
  api.submitAppTokenProbeServerFn.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishSubmit = resolve;
      }),
  );
  const router = await openRun();
  fireEvent.click(
    await screen.findByRole("button", { name: "Send med app-token" }),
  );
  const otherSurvey = "lumi-release-verification-20261123-abcdef12";
  await act(async () => {
    await router.navigate({
      to: "/release-verification",
      search: { surveyId: otherSurvey },
    });
  });
  await act(async () => finishSubmit(appToken));
  expect(router.state.location.search).toEqual({ surveyId: otherSurvey });
});

it("sends the same definition from the widget and the app probe", async () => {
  api.submitReleaseVerificationServerFn.mockResolvedValueOnce(initial);
  api.fetchReleaseVerificationRunServerFn.mockResolvedValue({
    observedAt: started,
    initial,
    closing: null,
    appToken: null,
  });
  await openRun();
  fireEvent.click(await screen.findByRole("radio", { name: "4. Bra" }));
  fireEvent.click(screen.getByRole("radio", { name: /Kontrollkode RV-/ }));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(api.submitReleaseVerificationServerFn).toHaveBeenCalledTimes(1),
  );
  const widget = api.submitReleaseVerificationServerFn.mock.calls[0][0].data;
  expect(widget.surveyId).toBe(surveyId);
  expect(createAppProbeSubmission(surveyId).definition).toEqual(
    widget.definition,
  );
});
