import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "../index";

const { mockParams, mockSetParams, mockBootstrap } = vi.hoisted(() => ({
  mockParams: {
    team: "team-test",
    app: undefined as string | undefined,
    surveyId: "survey-archived" as string | undefined,
    showArchived: undefined as string | undefined,
  },
  mockSetParams: vi.fn(),
  mockBootstrap: {
    data: undefined as unknown,
    isPending: false,
  },
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: mockParams,
    setParam: vi.fn(),
    setParams: mockSetParams,
    resetParams: vi.fn(),
  }),
}));

vi.mock("~/hooks/useFilterBootstrap", () => ({
  useFilterBootstrap: () => mockBootstrap,
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
      "survey-archived": { archivedAt: "2026-08-01T10:00:00Z" },
      "survey-only-archived": { archivedAt: "2026-08-02T10:00:00Z" },
    },
  };
}

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({ data: undefined, isPending: false }),
}));

vi.mock("~/hooks/useThemes", () => ({
  useThemes: () => ({ themes: [] }),
}));

describe("FilterBar archive state", () => {
  beforeEach(() => {
    mockParams.app = undefined;
    mockParams.surveyId = "survey-archived";
    mockParams.showArchived = undefined;
    mockBootstrap.data = loadedBootstrapData();
    mockBootstrap.isPending = false;
    mockSetParams.mockClear();
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

  it("clears the app when its final visible survey is archived", async () => {
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
        page: "1",
      }),
    );
  });
});
