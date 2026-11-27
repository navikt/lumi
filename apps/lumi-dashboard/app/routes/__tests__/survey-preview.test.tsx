import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSurveyAuthoringProjectServerFn } from "~/server/actions";
import { ApiErrorException, ErrorType } from "~/types/errors";
import type { SurveyAuthoringProject } from "~/types/surveyAuthoring";
import { fetchKeepingStatus, ServerFnHttpError } from "~/utils/serverFnFetch";
import { Route as SurveyPreviewRoute } from "../survey-preview";

vi.mock("~/server/actions", () => ({
  fetchSurveyAuthoringProjectServerFn: vi.fn(),
}));

const question = "Hvordan gikk det?";
const projectId = "6f1d3c2a-7b4e-4f5a-9c8d-1e2f3a4b5c6d";

const draft: SurveyAuthoringProject = {
  id: projectId,
  team: "team-a",
  name: "Utkast",
  surveyId: "survey-1",
  document: {
    authoringSchemaVersion: 1,
    pages: [
      {
        id: "page-1",
        questions: [{ id: "rating", type: "rating", prompt: question }],
      },
    ],
  },
  presentation: { mode: "inline", placementNote: null },
  draftVersion: 2,
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
};

function apiError(status: number, type: ErrorType) {
  return new ApiErrorException({
    status,
    type,
    message: "Survey project not found",
    timestamp: "2026-11-01T10:00:00Z",
  });
}

async function renderPreview() {
  vi.mocked(fetchSurveyAuthoringProjectServerFn).mockResolvedValueOnce(draft);
  const rootRoute = createRootRoute();
  const previewRoute = SurveyPreviewRoute.update({
    id: "/survey-preview",
    path: "/survey-preview",
    getParentRoute: () => rootRoute,
  } as never);
  const router = createRouter({
    routeTree: rootRoute.addChildren([previewRoute]),
    history: createMemoryHistory({
      initialEntries: [
        `/survey-preview?team=team-a&projectId=${projectId}&version=2`,
      ],
    }),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await router.load();
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findAllByText(question);
  return client;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Draft preview in its own tab", () => {
  it.each([
    [401, ErrorType.AUTHENTICATION_ERROR],
    [403, ErrorType.AUTHORIZATION_ERROR],
    [404, ErrorType.NOT_FOUND],
  ])(
    "stops showing the draft when a new fetch gets %i",
    async (status, type) => {
      const client = await renderPreview();

      vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
        apiError(status, type),
      );
      await act(() => client.refetchQueries());

      expect(
        await screen.findByText(
          "Utkastet er slettet, eller du har ikke lenger tilgang til det.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryAllByText(question)).toHaveLength(0);
      expect(screen.queryByText(/viser det som ble hentet sist/)).toBeNull();
    },
  );

  it("stops showing the draft when the login to the dashboard has ended", async () => {
    const client = await renderPreview();

    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
      new Error("Unauthorized: Invalid token"),
    );
    await act(() => client.refetchQueries());

    expect(
      await screen.findByText(
        "Utkastet er slettet, eller du har ikke lenger tilgang til det.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(question)).toHaveLength(0);
  });

  it("does not show the draft again when a fetch after a refusal fails for another reason", async () => {
    const client = await renderPreview();
    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
      apiError(403, ErrorType.AUTHORIZATION_ERROR),
    );
    await act(() => client.refetchQueries());
    await screen.findByText(
      "Utkastet er slettet, eller du har ikke lenger tilgang til det.",
    );

    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
      new Error("Backend request failed: 502 Bad Gateway"),
    );
    await act(() => client.refetchQueries());
    // React Query tells the component about the result on the next tick.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(
      screen.getByText(
        "Utkastet er slettet, eller du har ikke lenger tilgang til det.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(question)).toHaveLength(0);
  });

  it("shows the draft again after a refusal when a new fetch gets it", async () => {
    const client = await renderPreview();
    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
      apiError(403, ErrorType.AUTHORIZATION_ERROR),
    );
    await act(() => client.refetchQueries());
    await screen.findByText(
      "Utkastet er slettet, eller du har ikke lenger tilgang til det.",
    );

    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockResolvedValueOnce(draft);
    await act(() => client.refetchQueries());

    expect((await screen.findAllByText(question)).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "Utkastet er slettet, eller du har ikke lenger tilgang til det.",
      ),
    ).toBeNull();
  });

  it("stops showing the draft when the dashboard refuses a new fetch, also after a later failure that can pass", async () => {
    const client = await renderPreview();
    // The CSRF check in start.ts answers with plain text.
    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
      new ServerFnHttpError(403, "Forbidden"),
    );
    await act(() => client.refetchQueries());

    expect(
      await screen.findByText("Kunne ikke hente det lagrede utkastet."),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(question)).toHaveLength(0);

    vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
      new Error("Backend request failed: 502 Bad Gateway"),
    );
    await act(() => client.refetchQueries());
    // React Query tells the component about the result on the next tick.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(
      screen.getByText("Kunne ikke hente det lagrede utkastet."),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(question)).toHaveLength(0);
  });

  it.each([
    ["a server function", new Error("Backend request failed: 502 Bad Gateway")],
    ["an error page", new ServerFnHttpError(500, "Feil")],
  ])(
    "keeps the last draft when a new fetch gets a server error from %s",
    async (_case, error) => {
      const client = await renderPreview();

      vi.mocked(fetchSurveyAuthoringProjectServerFn).mockRejectedValueOnce(
        error,
      );
      await act(() => client.refetchQueries());

      expect(
        await screen.findByText(/viser det som ble hentet sist/),
      ).toBeInTheDocument();
      expect(screen.getAllByText(question).length).toBeGreaterThan(0);
      // Start keeps only the text of an error page. This fetch keeps its status.
      expect(fetchSurveyAuthoringProjectServerFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ fetch: fetchKeepingStatus }),
      );
    },
  );
});
