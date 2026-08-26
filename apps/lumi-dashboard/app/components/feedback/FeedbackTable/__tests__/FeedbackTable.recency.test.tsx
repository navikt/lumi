import { render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { FeedbackTable } from "../index";

const DAY_MS = 24 * 60 * 60 * 1000;
const originalTimeZone = process.env.TZ;

const { mockParams, mockBootstrap } = vi.hoisted(() => ({
  mockParams: {
    team: "team-test",
    surveyId: "survey-1" as string | undefined,
    page: "1" as string | undefined,
    showArchived: undefined as string | undefined,
  },
  mockBootstrap: {
    data: undefined as unknown,
    isPending: false,
  },
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: mockParams,
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  }),
}));

vi.mock("~/hooks/useFeedback", () => ({
  useFeedback: () => ({
    data: { content: [], totalPages: 1, totalElements: 0, size: 10 },
    error: null,
    isPending: false,
  }),
}));

vi.mock("~/hooks/useFilterBootstrap", () => ({
  useFilterBootstrap: () => mockBootstrap,
}));

vi.mock("~/hooks/useDeleteFeedback", () => ({
  useDeleteFeedback: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("~/hooks/useDeleteSurvey", () => ({
  useDeleteSurvey: () => ({
    mutateAsync: vi.fn(),
    isError: false,
    isPending: false,
  }),
}));

vi.mock("~/hooks/useSurveyTotalCount", () => ({
  useSurveyTotalCount: () => ({
    data: 0,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("~/hooks/useArchiveSurvey", () => ({
  useArchiveSurvey: () => ({
    archiveMutation: {
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isError: false,
      isPending: false,
    },
    restoreMutation: {
      mutate: vi.fn(),
      isError: false,
      isPending: false,
    },
  }),
}));

function bootstrapWith(
  surveyMeta: Record<string, unknown>,
  retentionWarnings: Array<{
    surveyId: string;
    lastActivityAt: string;
    scheduledFor: string;
  }> = [],
) {
  return {
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    apps: ["app-test"],
    surveysByApp: { "app-test": ["survey-1"] },
    tags: [],
    surveyMeta,
    retentionWarnings,
  };
}

describe("FeedbackTable recency and badge", () => {
  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
    mockParams.surveyId = "survey-1";
    mockBootstrap.isPending = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows relative last-submission time for the selected survey", () => {
    mockBootstrap.data = bootstrapWith({
      "survey-1": {
        archivedAt: null,
        lastSubmissionAt: new Date(
          Date.now() - 26 * 60 * 60 * 1000,
        ).toISOString(),
      },
    });

    render(<FeedbackTable />);

    expect(screen.getByText(/Sist svar i går/)).toBeInTheDocument();
  });

  it("shows the still-receiving badge for an archived survey with newer submissions", () => {
    const archivedAt = new Date(Date.now() - 10 * DAY_MS).toISOString();
    mockBootstrap.data = bootstrapWith({
      "survey-1": {
        archivedAt,
        lastSubmissionAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
      },
    });

    render(<FeedbackTable />);

    expect(
      screen.getByText("Mottar fortsatt innsendinger"),
    ).toBeInTheDocument();
  });

  it("does not show the badge when the archived survey has no newer submissions", () => {
    const archivedAt = new Date(Date.now() - 2 * DAY_MS).toISOString();
    mockBootstrap.data = bootstrapWith({
      "survey-1": {
        archivedAt,
        lastSubmissionAt: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      },
    });

    render(<FeedbackTable />);

    expect(
      screen.queryByText("Mottar fortsatt innsendinger"),
    ).not.toBeInTheDocument();
  });

  it("shows an informational warning for inactive survey definitions", () => {
    mockBootstrap.data = bootstrapWith({}, [
      {
        surveyId: "survey-inactive",
        lastActivityAt: "2025-02-01T00:00:00Z",
        scheduledFor: "2026-08-31T22:30:00Z",
      },
    ]);

    render(<FeedbackTable />);

    expect(
      screen.getByText("En inaktiv survey nærmer seg automatisk opprydding"),
    ).toBeInTheDocument();
    expect(screen.getByText("survey-inactive")).toBeInTheDocument();
    expect(screen.getByText(/1. september 2026/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /behold|slett nå/i }),
    ).not.toBeInTheDocument();
  });
});
