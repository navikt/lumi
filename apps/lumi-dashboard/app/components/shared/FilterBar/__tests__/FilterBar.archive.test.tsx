import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDashboardPeriod } from "~/utils/dashboardPeriod";
import { FilterBar } from "../index";

const { mockParams, mockSetParams, mockResetParams, mockBootstrap, mockStats } =
  vi.hoisted(() => ({
    mockParams: {
      team: "team-test",
      app: undefined as string | undefined,
      surveyId: "survey-archived" as string | undefined,
      showArchived: undefined as string | undefined,
      dateMode: "auto" as "auto" | "fixed" | undefined,
      fromDate: "2026-07-23" as string | undefined,
      toDate: "2026-08-21" as string | undefined,
      query: undefined as string | undefined,
    },
    mockSetParams: vi.fn(),
    mockResetParams: vi.fn(),
    mockBootstrap: {
      data: undefined as unknown,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    mockStats: {
      data: undefined as unknown,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    },
  }));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: mockParams,
    setParam: vi.fn(),
    setParams: mockSetParams,
    resetParams: mockResetParams,
  }),
}));

vi.mock("~/hooks/useFilterBootstrap", () => ({
  useFilterBootstrap: () => mockBootstrap,
}));

vi.mock("~/components/shared/RefreshSurveyOverview", () => ({
  RefreshSurveyOverview: () => (
    <button type="button">Oppdater surveyoversikt</button>
  ),
}));

function loadedBootstrapData() {
  return {
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    apps: ["app-test", "app-archived"],
    surveysByApp: {
      "app-test": ["survey-active", "survey-archived"],
      "app-archived": ["survey-only-archived"],
    },
    tags: [],
    surveyMeta: {
      "survey-active": {
        archivedAt: null,
        firstSubmissionAt: "2024-01-01T12:00:00Z",
        lastSubmissionAt: "2024-02-18T12:00:00Z",
      },
      "survey-archived": { archivedAt: "2026-08-01T10:00:00Z" },
      "survey-only-archived": { archivedAt: "2026-08-02T10:00:00Z" },
    },
  };
}

function sharedSurveyBootstrapData() {
  return {
    ...loadedBootstrapData(),
    apps: ["app-a", "app-b"],
    surveysByApp: {
      "app-a": ["shared-survey"],
      "app-b": ["shared-survey"],
    },
    surveyMeta: {
      "shared-survey": {
        archivedAt: null,
        firstSubmissionAt: "2024-05-01T12:00:00Z",
        lastSubmissionAt: "2024-05-30T12:00:00Z",
      },
    },
    surveyMetaByApp: {
      "app-a": {
        "shared-survey": {
          archivedAt: null,
          firstSubmissionAt: "2024-01-01T12:00:00Z",
          lastSubmissionAt: "2024-02-18T12:00:00Z",
        },
      },
      "app-b": {
        "shared-survey": {
          archivedAt: null,
          firstSubmissionAt: "2024-05-01T12:00:00Z",
          lastSubmissionAt: "2024-05-30T12:00:00Z",
        },
      },
    },
  };
}

vi.mock("~/hooks/useStats", () => ({
  useStats: () => mockStats,
}));

vi.mock("~/hooks/useThemes", () => ({
  useThemes: () => ({ themes: [] }),
}));

describe("FilterBar archive state", () => {
  beforeEach(() => {
    mockParams.app = undefined;
    mockParams.surveyId = "survey-archived";
    mockParams.showArchived = undefined;
    mockParams.dateMode = "auto";
    mockParams.fromDate = "2026-07-23";
    mockParams.toDate = "2026-08-21";
    mockParams.query = undefined;
    mockBootstrap.data = loadedBootstrapData();
    mockBootstrap.isPending = false;
    mockBootstrap.isError = false;
    mockBootstrap.isFetching = false;
    mockStats.isError = false;
    mockStats.isFetching = false;
    mockSetParams.mockClear();
    mockResetParams.mockClear();
    mockBootstrap.refetch.mockClear();
    mockStats.refetch.mockClear();
  });

  it("shows an explicit error instead of empty filters and retries the failed query", () => {
    mockBootstrap.isError = true;
    mockBootstrap.refetch.mockImplementationOnce(
      () => new Promise<never>(() => undefined),
    );

    render(<FilterBar />);

    expect(screen.getByText("Kunne ikke hente filtre")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "App" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Oppdater surveyoversikt" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prøv igjen" }));

    expect(mockBootstrap.refetch).toHaveBeenCalledOnce();
    expect(mockStats.refetch).not.toHaveBeenCalled();
    expect(mockSetParams).not.toHaveBeenCalled();
  });

  it("keeps recovery filters available when only dashboard stats fail", () => {
    mockStats.isError = true;

    render(<FilterBar />);

    expect(
      screen.getAllByRole("combobox", { name: "Survey" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Kunne ikke hente filtre"),
    ).not.toBeInTheDocument();
  });

  it("does not clear an app filter while bootstrap is still loading", () => {
    mockParams.app = "app-test";
    mockParams.surveyId = "survey-active";
    mockBootstrap.data = undefined;
    mockBootstrap.isPending = true;

    render(<FilterBar />);

    expect(mockSetParams).not.toHaveBeenCalled();
  });

  it("hides and clears a selected archived survey while the toggle is off", async () => {
    const automaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
    render(<FilterBar />);

    expect(
      screen.queryByRole("option", { name: "survey-archived" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        surveyId: undefined,
        choice: undefined,
        rating: undefined,
        phrase: undefined,
        dateMode: "auto",
        fromDate: automaticPeriod.fromDate,
        toDate: automaticPeriod.toDate,
        page: "1",
      }),
    );
  });

  it("persists archive visibility in the URL and reveals archive-only apps", () => {
    mockParams.surveyId = undefined;
    mockParams.showArchived = "true";
    render(<FilterBar />);

    expect(
      screen.getAllByRole("option", { name: "app-archived" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("option", { name: "survey-only-archived" }),
    ).toHaveLength(2);
    const archiveSwitches = screen.getAllByRole("checkbox", {
      name: "Arkiverte (2)",
    });
    expect(archiveSwitches[0]).toBeChecked();

    fireEvent.click(archiveSwitches[0]);
    expect(mockSetParams).toHaveBeenCalledWith({ showArchived: undefined });
  });

  it("writes archive visibility to the URL when the switch is enabled", () => {
    mockParams.surveyId = undefined;
    render(<FilterBar />);

    const archiveSwitches = screen.getAllByRole("checkbox", {
      name: "Arkiverte (2)",
    });
    expect(archiveSwitches[0]).not.toBeChecked();

    fireEvent.click(archiveSwitches[0]);
    expect(mockSetParams).toHaveBeenCalledWith({ showArchived: "true" });
  });

  it("moves an automatic period to the selected survey's newest responses", () => {
    mockParams.surveyId = undefined;
    render(<FilterBar />);

    fireEvent.change(screen.getAllByRole("combobox", { name: "Survey" })[0], {
      target: { value: "survey-active" },
    });

    expect(mockSetParams).toHaveBeenCalledWith({
      surveyId: "survey-active",
      choice: undefined,
      rating: undefined,
      phrase: undefined,
      dateMode: "auto",
      fromDate: "2024-01-20",
      toDate: "2024-02-18",
      page: "1",
    });
  });

  it("preserves a fixed period when switching survey", () => {
    mockParams.surveyId = undefined;
    mockParams.dateMode = "fixed";
    render(<FilterBar />);

    fireEvent.change(screen.getAllByRole("combobox", { name: "Survey" })[0], {
      target: { value: "survey-active" },
    });

    expect(mockSetParams).toHaveBeenCalledWith({
      surveyId: "survey-active",
      choice: undefined,
      rating: undefined,
      phrase: undefined,
      page: "1",
    });
  });

  it("offers the survey response period when a fixed period does not overlap", () => {
    mockParams.surveyId = "survey-active";
    mockParams.dateMode = "fixed";
    mockParams.fromDate = "2026-08-01";
    mockParams.toDate = "2026-08-21";

    render(<FilterBar />);

    expect(
      screen.getByText(
        "Surveyen har registrerte svar fra 01.01.2024 til 18.02.2024.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Vis hele svarperioden" }),
    );

    expect(mockSetParams).toHaveBeenCalledWith({
      dateMode: "fixed",
      fromDate: "2024-01-01",
      toDate: "2024-02-18",
      page: "1",
    });
  });

  it("resolves an automatic period for a survey opened from a direct URL", async () => {
    mockParams.surveyId = "survey-active";
    render(<FilterBar />);

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        dateMode: "auto",
        fromDate: "2024-01-20",
        toDate: "2024-02-18",
        page: "1",
      }),
    );
  });

  it("clears the app when its final visible survey is archived", async () => {
    const automaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
    mockParams.app = "app-archived";
    mockParams.surveyId = "survey-only-archived";
    render(<FilterBar />);

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        app: undefined,
        surveyId: undefined,
        choice: undefined,
        rating: undefined,
        phrase: undefined,
        dateMode: "auto",
        fromDate: automaticPeriod.fromDate,
        toDate: automaticPeriod.toDate,
        page: "1",
      }),
    );
  });

  it("returns to a rolling automatic period when an app change clears the survey", () => {
    const automaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
    mockParams.app = "app-test";
    mockParams.surveyId = "survey-active";
    mockBootstrap.data = {
      ...loadedBootstrapData(),
      apps: ["app-test", "app-other"],
      surveysByApp: {
        ...loadedBootstrapData().surveysByApp,
        "app-other": ["survey-other"],
      },
      surveyMeta: {
        ...loadedBootstrapData().surveyMeta,
        "survey-other": { archivedAt: null },
      },
    };

    render(<FilterBar />);
    mockSetParams.mockClear();

    fireEvent.change(screen.getAllByRole("combobox", { name: "App" })[0], {
      target: { value: "app-other" },
    });

    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({
        app: "app-other",
        surveyId: undefined,
        dateMode: "auto",
        fromDate: automaticPeriod.fromDate,
        toDate: automaticPeriod.toDate,
      }),
    );
  });

  it("returns to a rolling automatic period when a team change clears the survey", () => {
    const automaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
    mockParams.surveyId = "survey-active";
    mockBootstrap.data = {
      ...loadedBootstrapData(),
      availableTeams: ["team-test", "team-other"],
    };

    render(<FilterBar />);
    mockSetParams.mockClear();

    fireEvent.change(screen.getAllByRole("combobox", { name: "Team" })[0], {
      target: { value: "team-other" },
    });

    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({
        team: "team-other",
        surveyId: undefined,
        dateMode: "auto",
        fromDate: automaticPeriod.fromDate,
        toDate: automaticPeriod.toDate,
      }),
    );
  });

  it("resets all filters in one navigation to a bounded automatic period", () => {
    const automaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
    mockParams.surveyId = undefined;
    mockParams.query = "søketekst";

    render(<FilterBar />);

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Nullstill alle filtre til standard (siste 30 dager)",
      })[0],
    );

    expect(mockResetParams).toHaveBeenCalledWith({
      team: "team-test",
      dateMode: "auto",
      fromDate: automaticPeriod.fromDate,
      toDate: automaticPeriod.toDate,
      page: "1",
    });
    expect(mockSetParams).not.toHaveBeenCalled();
  });

  it("offers reset when the only active filter is a fixed period", () => {
    mockParams.surveyId = undefined;
    mockParams.dateMode = "fixed";
    mockParams.fromDate = "2024-02-01";
    mockParams.toDate = "2024-02-18";

    render(<FilterBar />);

    expect(
      screen.getAllByRole("button", {
        name: "Nullstill alle filtre til standard (siste 30 dager)",
      }),
    ).toHaveLength(2);
  });

  it("anchors a shared survey to the selected app's response period", async () => {
    mockParams.app = "app-a";
    mockParams.surveyId = "shared-survey";
    mockBootstrap.data = sharedSurveyBootstrapData();

    render(<FilterBar />);

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        dateMode: "auto",
        fromDate: "2024-01-20",
        toDate: "2024-02-18",
        page: "1",
      }),
    );
  });

  it("shows the selected app's response period for a fixed shared survey", () => {
    mockParams.app = "app-a";
    mockParams.surveyId = "shared-survey";
    mockParams.dateMode = "fixed";
    mockParams.fromDate = "2026-08-01";
    mockParams.toDate = "2026-08-21";
    mockBootstrap.data = sharedSurveyBootstrapData();

    render(<FilterBar />);

    expect(
      screen.getByText(
        "Surveyen har registrerte svar fra 01.01.2024 til 18.02.2024.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Surveyen har registrerte svar fra 01.05.2024 til 30.05.2024.",
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to global survey metadata for an older bootstrap response", async () => {
    mockParams.app = "app-test";
    mockParams.surveyId = "survey-active";
    mockBootstrap.data = loadedBootstrapData();

    render(<FilterBar />);

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        dateMode: "auto",
        fromDate: "2024-01-20",
        toDate: "2024-02-18",
        page: "1",
      }),
    );
  });

  it("falls back to global metadata when the selected app has no survey entry", async () => {
    const bootstrap = sharedSurveyBootstrapData();
    mockParams.app = "app-a";
    mockParams.surveyId = "shared-survey";
    mockBootstrap.data = {
      ...bootstrap,
      surveyMetaByApp: {
        ...bootstrap.surveyMetaByApp,
        "app-a": {},
      },
    };

    render(<FilterBar />);

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        dateMode: "auto",
        fromDate: "2024-05-01",
        toDate: "2024-05-30",
        page: "1",
      }),
    );
  });

  it("reanchors a shared survey when switching to another app", async () => {
    mockParams.app = "app-a";
    mockParams.surveyId = "shared-survey";
    mockParams.fromDate = "2024-01-20";
    mockParams.toDate = "2024-02-18";
    mockBootstrap.data = sharedSurveyBootstrapData();

    const { rerender } = render(<FilterBar />);
    expect(mockSetParams).not.toHaveBeenCalled();

    fireEvent.change(screen.getAllByRole("combobox", { name: "App" })[0], {
      target: { value: "app-b" },
    });
    expect(mockSetParams).toHaveBeenCalledWith({
      app: "app-b",
      page: "1",
      phrase: undefined,
      choice: undefined,
      rating: undefined,
    });

    mockSetParams.mockClear();
    mockParams.app = "app-b";
    rerender(<FilterBar />);

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        dateMode: "auto",
        fromDate: "2024-05-01",
        toDate: "2024-05-30",
        page: "1",
      }),
    );
  });
});
