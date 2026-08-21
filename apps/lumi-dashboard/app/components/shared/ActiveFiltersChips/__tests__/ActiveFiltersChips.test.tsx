import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChoiceFilter } from "~/hooks/useChoiceFilter";
import { usePhraseFilter } from "~/hooks/usePhraseFilter";
import { useRatingFilter } from "~/hooks/useRatingFilter";
import type { SearchParams } from "~/hooks/useSearchParams";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useStats } from "~/hooks/useStats";
import { useThemes } from "~/hooks/useThemes";
import { ActiveFiltersChips } from "..";

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("~/hooks/useSegmentFilter", () => ({
  useSegmentFilter: vi.fn(),
}));

vi.mock("~/hooks/useChoiceFilter", () => ({
  useChoiceFilter: vi.fn(),
}));

vi.mock("~/hooks/useRatingFilter", () => ({
  useRatingFilter: vi.fn(),
}));

vi.mock("~/hooks/usePhraseFilter", () => ({
  usePhraseFilter: vi.fn(),
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: vi.fn(),
}));

vi.mock("~/hooks/useThemes", () => ({
  useThemes: vi.fn(),
}));

vi.mock("@navikt/ds-react", async () => {
  interface SimpleProps {
    children?: ReactNode;
    className?: string;
  }

  function HStack({ children, className }: SimpleProps) {
    return <div className={className}>{children}</div>;
  }

  function Tag({ children, className }: SimpleProps) {
    return <div className={className}>{children}</div>;
  }

  return {
    HStack,
    Tag,
  };
});

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseSegmentFilter = vi.mocked(useSegmentFilter);
const mockUseChoiceFilter = vi.mocked(useChoiceFilter);
const mockUseRatingFilter = vi.mocked(useRatingFilter);
const mockUsePhraseFilter = vi.mocked(usePhraseFilter);
const mockUseStats = vi.mocked(useStats);
const mockUseThemes = vi.mocked(useThemes);

const removeSegment = vi.fn();
const removeChoice = vi.fn();
const removeRating = vi.fn();
const removePhrase = vi.fn();
const setParams = vi.fn();

const stats = {
  fieldStats: [
    {
      fieldId: "role",
      fieldType: "SINGLE_CHOICE",
      label: "Rolle",
      stats: {
        type: "choice",
        distribution: {
          Privatperson: { label: "Privatperson", count: 7, percentage: 70 },
          Arbeidsgiver: { label: "Arbeidsgiver", count: 3, percentage: 30 },
        },
      },
    },
    {
      fieldId: "help",
      fieldType: "RATING",
      label: "Fikk du hjelp?",
      stats: {
        type: "rating",
        average: 1.8,
        distribution: { "1": 2, "2": 8 },
      },
    },
    {
      fieldId: "comment",
      fieldType: "TEXT",
      label: "Legg gjerne til en begrunnelse",
      stats: {
        type: "text",
        responseCount: 42,
        responseRate: 70,
        topKeywords: [],
        recentResponses: [],
      },
    },
  ],
};

function renderActiveFiltersChips(params: Partial<SearchParams> = {}) {
  mockUseSearchParams.mockReturnValue({
    params: params as SearchParams,
    setParam: vi.fn(),
    setParams,
    resetParams: vi.fn(),
  });

  return render(<ActiveFiltersChips />);
}

beforeEach(() => {
  vi.clearAllMocks();

  mockUseSegmentFilter.mockReturnValue({
    activeFilters: {},
    activeSegments: [],
    hasFilters: false,
    addSegment: vi.fn(),
    removeSegment,
    clearSegments: vi.fn(),
    isActive: vi.fn(),
  } as never);

  mockUseChoiceFilter.mockReturnValue({
    activeFilters: {},
    hasFilters: false,
    toggleChoice: vi.fn(),
    removeChoice,
    clearChoices: vi.fn(),
    isActive: vi.fn(),
  } as never);

  mockUseRatingFilter.mockReturnValue({
    activeFilters: {},
    hasFilters: false,
    toggleRating: vi.fn(),
    removeRating,
    clearRatings: vi.fn(),
    isActive: vi.fn(),
  } as never);

  mockUsePhraseFilter.mockReturnValue({
    activeFilter: null,
    setPhrase: vi.fn(),
    removePhrase,
  } as never);

  mockUseStats.mockReturnValue({
    data: stats,
    isPending: false,
  } as never);

  mockUseThemes.mockReturnValue({
    themes: [{ id: "theme-1", name: "Navigasjon" }],
    isLoading: false,
    error: null,
    createTheme: vi.fn(),
    isCreating: false,
    updateTheme: vi.fn(),
    isUpdating: false,
    deleteTheme: vi.fn(),
    isDeleting: false,
  } as never);
});

describe("ActiveFiltersChips", () => {
  it("renders no chips when there are no active filters", () => {
    const { container } = renderActiveFiltersChips();

    expect(container.firstChild).toBeNull();
  });

  it("renders a choice filter chip with the resolved label and value", () => {
    renderActiveFiltersChips({
      choice: "role:Arbeidsgiver",
    });

    expect(screen.getByText("Rolle: Arbeidsgiver")).toBeInTheDocument();
  });

  it('renders a thumbs rating filter chip with "Ja" as the value', () => {
    renderActiveFiltersChips({
      rating: "help:2",
    });

    expect(screen.getByText("Fikk du hjelp?: Ja")).toBeInTheDocument();
  });

  it('renders a thumbs rating filter chip with "Nei" as the value', () => {
    renderActiveFiltersChips({
      rating: "help:1",
    });

    expect(screen.getByText("Fikk du hjelp?: Nei")).toBeInTheDocument();
  });

  it("renders a theme filter chip", () => {
    renderActiveFiltersChips({
      theme: "theme-1",
    });

    expect(screen.getByText("Tema: Navigasjon")).toBeInTheDocument();
  });

  it("renders a task filter chip", () => {
    renderActiveFiltersChips({
      task: "Søknad",
    });

    expect(screen.getByText("Oppgave: Søknad")).toBeInTheDocument();
  });

  it("renders a segment filter chip", () => {
    mockUseSegmentFilter.mockReturnValue({
      activeFilters: { userType: "Arbeidsgiver" },
      activeSegments: ["userType:Arbeidsgiver"],
      hasFilters: true,
      addSegment: vi.fn(),
      removeSegment,
      clearSegments: vi.fn(),
      isActive: vi.fn(),
    } as never);

    renderActiveFiltersChips();

    expect(screen.getByText("User Type: Arbeidsgiver")).toBeInTheDocument();
  });

  it("clicking the remove button removes a choice filter", async () => {
    const user = userEvent.setup();
    renderActiveFiltersChips({
      choice: "role:Arbeidsgiver",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Fjern filter Rolle: Arbeidsgiver",
      }),
    );

    expect(removeChoice).toHaveBeenCalledWith("role");
  });

  it("clicking the remove button removes a rating filter", async () => {
    const user = userEvent.setup();
    renderActiveFiltersChips({
      rating: "help:2",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Fjern filter Fikk du hjelp?: Ja",
      }),
    );

    expect(removeRating).toHaveBeenCalledWith("help");
  });

  it("clicking the remove button removes a theme filter", async () => {
    const user = userEvent.setup();
    renderActiveFiltersChips({
      theme: "theme-1",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Fjern filter Tema: Navigasjon",
      }),
    );

    expect(setParams).toHaveBeenCalledWith({
      theme: undefined,
      page: "1",
    });
  });

  it("uses an accessible aria-label on remove buttons", () => {
    renderActiveFiltersChips({
      choice: "role:Arbeidsgiver",
    });

    expect(
      screen.getByRole("button", {
        name: "Fjern filter Rolle: Arbeidsgiver",
      }),
    ).toBeInTheDocument();
  });

  it("renders multiple active filter chips at the same time", () => {
    mockUseSegmentFilter.mockReturnValue({
      activeFilters: { userType: "Arbeidsgiver" },
      activeSegments: ["userType:Arbeidsgiver"],
      hasFilters: true,
      addSegment: vi.fn(),
      removeSegment,
      clearSegments: vi.fn(),
      isActive: vi.fn(),
    } as never);

    renderActiveFiltersChips({
      task: "Søknad",
      theme: "theme-1",
      choice: "role:Arbeidsgiver",
      rating: "help:2",
    });

    expect(screen.getByText("Oppgave: Søknad")).toBeInTheDocument();
    expect(screen.getByText("Tema: Navigasjon")).toBeInTheDocument();
    expect(screen.getByText("Rolle: Arbeidsgiver")).toBeInTheDocument();
    expect(screen.getByText("Fikk du hjelp?: Ja")).toBeInTheDocument();
    expect(screen.getByText("User Type: Arbeidsgiver")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("renders a phrase filter chip with field label and quoted surface", () => {
    mockUsePhraseFilter.mockReturnValue({
      activeFilter: { fieldId: "comment", surface: "vanskelig forstå" },
      setPhrase: vi.fn(),
      removePhrase,
    } as never);

    renderActiveFiltersChips({
      phrase: "comment:vanskelig forstå",
    });

    expect(
      screen.getByText("Legg gjerne til en begrunnelse: «vanskelig forstå»"),
    ).toBeInTheDocument();
  });

  it("phrase chip falls back to 'Uttrykk' when field not found in stats", () => {
    mockUsePhraseFilter.mockReturnValue({
      activeFilter: { fieldId: "unknown-field", surface: "test phrase" },
      setPhrase: vi.fn(),
      removePhrase,
    } as never);

    renderActiveFiltersChips({
      phrase: "unknown-field:test phrase",
    });

    expect(screen.getByText("Uttrykk: «test phrase»")).toBeInTheDocument();
  });

  it("clicking the remove button on phrase chip calls removePhrase", async () => {
    const user = userEvent.setup();
    mockUsePhraseFilter.mockReturnValue({
      activeFilter: { fieldId: "comment", surface: "vanskelig forstå" },
      setPhrase: vi.fn(),
      removePhrase,
    } as never);

    renderActiveFiltersChips({
      phrase: "comment:vanskelig forstå",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Fjern filter Legg gjerne til en begrunnelse: «vanskelig forstå»",
      }),
    );

    expect(removePhrase).toHaveBeenCalled();
  });
});
