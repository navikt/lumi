import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChoiceFilter } from "~/hooks/useChoiceFilter";
import { useRatingFilter } from "~/hooks/useRatingFilter";
import type { SearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { FilterMenu } from "../FilterMenu";

vi.mock("~/components/dashboard/ContextTagsFilter", () => ({
  ContextTagsFilter: () => <div>Context-tags</div>,
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: vi.fn(),
}));

vi.mock("~/hooks/useChoiceFilter", () => ({
  useChoiceFilter: vi.fn(),
}));

vi.mock("~/hooks/useRatingFilter", () => ({
  useRatingFilter: vi.fn(),
}));

vi.mock("@navikt/ds-react", async () => {
  const React = await import("react");

  interface SimpleProps {
    children?: React.ReactNode;
    className?: string;
  }

  interface ActionMenuGroupProps {
    label: string;
    children?: React.ReactNode;
  }

  interface CheckboxItemProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    children?: React.ReactNode;
  }

  interface RadioGroupProps {
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    children?: React.ReactNode;
  }

  interface RadioItemProps {
    value: string;
    children?: React.ReactNode;
    name?: string;
    checked?: boolean;
    onValueChange?: (value: string) => void;
  }

  interface ChipProps {
    children?: React.ReactNode;
    onDelete?: () => void;
  }

  interface ChipToggleProps {
    children?: React.ReactNode;
    selected?: boolean;
    onClick?: () => void;
  }

  function SimpleDiv({ children, className }: SimpleProps) {
    return <div className={className}>{children}</div>;
  }

  function Button({ children }: SimpleProps) {
    return <button type="button">{children}</button>;
  }

  function BodyShort({ children }: SimpleProps) {
    return <span>{children}</span>;
  }

  function Label({ children }: SimpleProps) {
    return <span>{children}</span>;
  }

  function Tag({ children }: SimpleProps) {
    return <span>{children}</span>;
  }

  function ActionMenuRoot({ children }: SimpleProps) {
    return <div>{children}</div>;
  }

  function ActionMenuTrigger({ children }: SimpleProps) {
    return <div>{children}</div>;
  }

  function ActionMenuContent({ children, className }: SimpleProps) {
    return <div className={className}>{children}</div>;
  }

  function ActionMenuGroup({ label, children }: ActionMenuGroupProps) {
    return (
      <fieldset>
        <legend>{label}</legend>
        {children}
      </fieldset>
    );
  }

  function ActionMenuCheckboxItem({
    checked,
    onCheckedChange,
    children,
  }: CheckboxItemProps) {
    return (
      <label>
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
        {children}
      </label>
    );
  }

  function ActionMenuRadioItem({
    value,
    children,
    name,
    checked,
    onValueChange,
  }: RadioItemProps) {
    return (
      <label>
        <input
          type="radio"
          name={name}
          value={value}
          checked={Boolean(checked)}
          onChange={() => onValueChange?.(value)}
        />
        {children}
      </label>
    );
  }

  function ActionMenuRadioGroup({
    label,
    value,
    onValueChange,
    children,
  }: RadioGroupProps) {
    return (
      <fieldset>
        <legend>{label}</legend>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement<RadioItemProps>(child)) {
            return child;
          }

          return React.cloneElement(child, {
            name: `radio-${label}`,
            checked: child.props.value === value,
            onValueChange,
          });
        })}
      </fieldset>
    );
  }

  function ChipsRoot({ children }: SimpleProps) {
    return <div>{children}</div>;
  }

  function ChipsRemovable({ children, onDelete }: ChipProps) {
    return (
      <button type="button" onClick={onDelete}>
        {children}
      </button>
    );
  }

  function ChipsToggle({ children, selected, onClick }: ChipToggleProps) {
    return (
      <button type="button" aria-pressed={Boolean(selected)} onClick={onClick}>
        {children}
      </button>
    );
  }

  const ActionMenu = Object.assign(ActionMenuRoot, {
    Trigger: ActionMenuTrigger,
    Content: ActionMenuContent,
    Group: ActionMenuGroup,
    CheckboxItem: ActionMenuCheckboxItem,
    RadioGroup: ActionMenuRadioGroup,
    RadioItem: ActionMenuRadioItem,
  });

  const Chips = Object.assign(ChipsRoot, {
    Removable: ChipsRemovable,
    Toggle: ChipsToggle,
  });

  return {
    ActionMenu,
    BodyShort,
    Box: SimpleDiv,
    Button,
    Chips,
    HGrid: SimpleDiv,
    HStack: SimpleDiv,
    Label,
    Tag,
    VStack: SimpleDiv,
  };
});

const mockUseStats = vi.mocked(useStats);
const mockUseChoiceFilter = vi.mocked(useChoiceFilter);
const mockUseRatingFilter = vi.mocked(useRatingFilter);

const toggleChoice = vi.fn();
const removeChoice = vi.fn();
const toggleRating = vi.fn();
const removeRating = vi.fn();
const setParams = vi.fn();

const features = {
  showDeviceFilter: false,
  showTextFilter: false,
  showRatingFilter: false,
  showTagsFilter: false,
};

const stats = {
  fieldStats: [
    {
      fieldId: "choice-1",
      fieldType: "SINGLE_CHOICE",
      label: "Kanal",
      stats: {
        type: "choice",
        distribution: {
          chat: { label: "Chat", count: 5, percentage: 50 },
          phone: { label: "Telefon", count: 3, percentage: 30 },
        },
      },
    },
    {
      fieldId: "rating-1",
      fieldType: "RATING",
      label: "Fikk du hjelp?",
      stats: {
        type: "rating",
        average: 1.8,
        distribution: { "1": 2, "2": 8 },
      },
    },
    {
      fieldId: "rating-2",
      fieldType: "RATING",
      label: "Hvor sannsynlig er det at du anbefaler oss?",
      stats: {
        type: "rating",
        average: 7.4,
        distribution: { "0": 1, "7": 2, "10": 3 },
      },
    },
  ],
};

function renderFilterMenu(params: Partial<SearchParams> = {}) {
  return render(
    <FilterMenu
      params={params as SearchParams}
      setParams={setParams}
      features={features}
      allTags={[]}
      selectedTags={[]}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  mockUseStats.mockReturnValue({
    data: stats,
    isPending: false,
  } as never);

  mockUseChoiceFilter.mockReturnValue({
    activeFilters: {},
    toggleChoice,
    removeChoice,
  } as never);

  mockUseRatingFilter.mockReturnValue({
    activeFilters: {},
    toggleRating,
    removeRating,
  } as never);
});

describe("FilterMenu", () => {
  it("shows answer filters only when a survey is selected", () => {
    renderFilterMenu();

    expect(screen.queryByText("Svar-filtre")).not.toBeInTheDocument();
  });

  it("renders answer filters and active chart filters with the correct options", () => {
    mockUseChoiceFilter.mockReturnValue({
      activeFilters: { "choice-1": "chat" },
      toggleChoice,
      removeChoice,
    } as never);

    mockUseRatingFilter.mockReturnValue({
      activeFilters: { "rating-1": "2" },
      toggleRating,
      removeRating,
    } as never);

    renderFilterMenu({
      surveyId: "survey-1",
      theme: "uncategorized",
      task: "Søknad",
    });

    expect(screen.getByText("Svar-filtre")).toBeInTheDocument();
    expect(screen.queryByText("Valgt fra grafer")).not.toBeInTheDocument();
    expect(screen.getByText("Aktive grafer-filtre")).toBeInTheDocument();

    // Choice chips
    expect(
      screen.getByRole("button", { name: "Chat", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Telefon", pressed: false }),
    ).toBeInTheDocument();

    // Rating chips (thumbs variant inferred: Ja/Nei)
    expect(
      screen.getByRole("button", { name: "Ja", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nei", pressed: false }),
    ).toBeInTheDocument();

    // NPS rating chips
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();

    // Chart filters
    expect(screen.getByText("Tema: Annet")).toBeInTheDocument();
    expect(screen.getByText("Oppgave: Søknad")).toBeInTheDocument();
  });

  it("updates choice and rating filters from the answer filter section", async () => {
    const user = userEvent.setup();

    mockUseRatingFilter.mockReturnValue({
      activeFilters: { "rating-1": "2" },
      toggleRating,
      removeRating,
    } as never);

    renderFilterMenu({ surveyId: "survey-1" });

    // Click an unselected choice chip → toggleChoice
    await user.click(screen.getByRole("button", { name: "Telefon" }));
    expect(toggleChoice).toHaveBeenCalledWith("choice-1", "phone");

    // Click the already-selected rating chip → removeRating (deselect)
    await user.click(screen.getByRole("button", { name: "Ja", pressed: true }));
    expect(removeRating).toHaveBeenCalledWith("rating-1");

    // Click an NPS rating chip → toggleRating
    await user.click(screen.getByRole("button", { name: "10" }));
    expect(toggleRating).toHaveBeenCalledWith("rating-2", "10");
  });
});
