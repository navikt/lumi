import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackTable } from "../index";

const {
  mockParams,
  mockBootstrap,
  mockFeedback,
  mockSetParam,
  mockSetParams,
  mockResetParams,
} = vi.hoisted(() => ({
  mockParams: {
    team: "team-test",
    surveyId: undefined as string | undefined,
    app: undefined as string | undefined,
    query: undefined as string | undefined,
    dateMode: "auto" as "auto" | "fixed" | undefined,
    fromDate: "2026-07-24" as string | undefined,
    toDate: "2026-08-22" as string | undefined,
    page: "1" as string | undefined,
    showArchived: undefined as string | undefined,
  },
  mockBootstrap: {
    data: undefined as unknown,
    isPending: false,
  },
  mockFeedback: {
    data: {
      content: [] as Array<Record<string, unknown>>,
      totalPages: 1,
      totalElements: 0,
      size: 10,
    },
    error: null as Error | null,
    isPending: false,
  },
  mockSetParam: vi.fn(),
  mockSetParams: vi.fn(),
  mockResetParams: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: mockParams,
    setParam: mockSetParam,
    setParams: mockSetParams,
    resetParams: mockResetParams,
  }),
}));

vi.mock("~/hooks/useFeedback", () => ({
  useFeedback: () => mockFeedback,
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

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

function bootstrapWithData() {
  return {
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    apps: ["app-test"],
    surveysByApp: { "app-test": ["survey-1"] },
    tags: [],
    surveyMeta: {
      "survey-1": {
        archivedAt: null,
        firstSubmissionAt: "2026-01-10T09:00:00Z",
        lastSubmissionAt: "2026-06-05T12:00:00Z",
      },
    },
  };
}

function bootstrapWithoutData() {
  return {
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    apps: [],
    surveysByApp: {},
    tags: [],
    surveyMeta: {},
  };
}

describe("FeedbackTable empty states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.surveyId = undefined;
    mockParams.app = undefined;
    mockParams.query = undefined;
    mockParams.dateMode = "auto";
    mockParams.fromDate = "2026-07-24";
    mockParams.toDate = "2026-08-22";
    mockParams.page = "1";
    mockParams.showArchived = undefined;
    mockBootstrap.isPending = false;
    mockFeedback.data = {
      content: [],
      totalPages: 1,
      totalElements: 0,
      size: 10,
    };
    mockFeedback.error = null;
    mockFeedback.isPending = false;
  });

  it("shows onboarding guidance when the team has no data at all", () => {
    mockBootstrap.data = bootstrapWithoutData();

    render(<FeedbackTable />);

    expect(screen.getByText("Ingen tilbakemeldinger ennå")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /kom i gang/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /surveyverksted/i }),
    ).toBeInTheDocument();
  });

  it("offers a reset action when active filters exclude everything", () => {
    mockBootstrap.data = bootstrapWithData();
    mockParams.query = "finnesikke";

    render(<FeedbackTable />);

    expect(
      screen.getByText("Ingen treff med gjeldende filtre"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nullstill filtre/i }));
    expect(mockResetParams).toHaveBeenCalled();
  });

  it("shows the period and offers the full survey period when no filters are active", () => {
    mockBootstrap.data = bootstrapWithData();

    render(<FeedbackTable />);

    expect(
      screen.getByText(/Ingen tilbakemeldinger i perioden/),
    ).toBeInTheDocument();
    expect(screen.getByText(/24\.07\.2026.*22\.08\.2026/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /vis hele svarperioden/i }),
    );
    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({
        dateMode: "fixed",
        fromDate: "2026-01-10",
        toDate: "2026-06-05",
        page: "1",
      }),
    );
  });

  it("explains a fixed period miss instead of calling the period a filter", () => {
    mockBootstrap.data = bootstrapWithData();
    mockParams.dateMode = "fixed";
    mockParams.fromDate = "2026-07-01";
    mockParams.toDate = "2026-07-31";

    render(<FeedbackTable />);

    expect(
      screen.getByText(/Ingen tilbakemeldinger i perioden/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Ingen treff med gjeldende filtre"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /vis hele svarperioden/i }),
    ).toBeInTheDocument();
  });

  it.each([
    {
      fromDate: "2026-07-01",
      toDate: undefined,
      expected: "Ingen tilbakemeldinger fra og med 01.07.2026.",
    },
    {
      fromDate: undefined,
      toDate: "2026-07-31",
      expected: "Ingen tilbakemeldinger til og med 31.07.2026.",
    },
  ])("explains a one-sided bookmarked period", ({
    fromDate,
    toDate,
    expected,
  }) => {
    mockBootstrap.data = bootstrapWithData();
    mockParams.dateMode = "fixed";
    mockParams.fromDate = fromDate;
    mockParams.toDate = toDate;

    render(<FeedbackTable />);

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /vis hele svarperioden/i }),
    ).toBeInTheDocument();
  });

  it("does not offer an archived-only period while archived surveys are hidden", () => {
    const bootstrap = bootstrapWithData();
    mockBootstrap.data = {
      ...bootstrap,
      surveyMeta: {
        "survey-1": {
          ...bootstrap.surveyMeta["survey-1"],
          archivedAt: "2026-06-06T12:00:00Z",
        },
      },
    };

    render(<FeedbackTable />);

    expect(
      screen.queryByRole("button", { name: /vis hele svarperioden/i }),
    ).not.toBeInTheDocument();
  });

  it("returns to the last page when the current page no longer exists", async () => {
    mockBootstrap.data = bootstrapWithData();
    mockParams.page = "3";
    mockFeedback.data = {
      content: [],
      totalPages: 2,
      totalElements: 21,
      size: 10,
    };

    render(<FeedbackTable />);

    await waitFor(() => {
      expect(mockSetParam).toHaveBeenCalledWith("page", "2");
    });
    expect(
      screen.queryByText(/Ingen tilbakemeldinger|Ingen treff/),
    ).not.toBeInTheDocument();
  });

  it("keeps the generic message while bootstrap is unavailable", () => {
    mockBootstrap.data = undefined;

    render(<FeedbackTable />);

    expect(
      screen.getByText("Ingen tilbakemeldinger funnet"),
    ).toBeInTheDocument();
  });
});
