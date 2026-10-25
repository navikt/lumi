import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYSIS_BUDGET_TITLE,
  describeAnalysisBudget,
  FILTER_BUDGET_DESCRIPTION,
} from "~/utils/analysisBudget";
import { AnalysisBudgetAlert } from "../index";

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  setParams: vi.fn(),
  bootstrap: undefined as unknown,
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: state.params,
    setParams: state.setParams,
  }),
}));

vi.mock("~/hooks/useFilterBootstrap", () => ({
  useCachedFilterBootstrap: () => ({ data: state.bootstrap }),
}));

const SUBJECT = describeAnalysisBudget("Top Tasks-analysen");

function givenAnswers(firstSubmissionAt: string, lastSubmissionAt: string) {
  state.bootstrap = {
    surveyMeta: {
      "survey-top-tasks": {
        archivedAt: null,
        firstSubmissionAt,
        lastSubmissionAt,
      },
    },
  };
}

describe("AnalysisBudgetAlert", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
    state.params = {
      surveyId: "survey-top-tasks",
      dateMode: "fixed",
      fromDate: "2026-01-01",
      toDate: "2026-10-22",
    };
    state.bootstrap = undefined;
    state.setParams.mockReset();
    state.setParams.mockResolvedValue(undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("offers the last 30 days with answers in the period", () => {
    givenAnswers("2026-01-05T09:00:00Z", "2026-06-30T09:00:00Z");

    render(<AnalysisBudgetAlert description={SUBJECT} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_TITLE);
    expect(alert).toHaveTextContent(
      "Top Tasks-analysen kan ikke regnes ut for så mange svar. Velg en kortere periode.",
    );
    expect(
      screen.getByRole("button", {
        name: "Vis perioden 01.06.2026–30.06.2026",
      }),
    ).toBeInTheDocument();
    expect(alert).toHaveAttribute("tabindex", "-1");
  });

  it("offers the last 7 days when the answers start less than 30 days before", () => {
    givenAnswers("2026-10-03T09:00:00Z", "2026-10-22T08:00:00Z");
    state.params = {
      surveyId: "survey-top-tasks",
      dateMode: "fixed",
      fromDate: "2026-07-25",
      toDate: "2026-10-22",
    };

    render(<AnalysisBudgetAlert description={SUBJECT} />);

    expect(
      screen.getByRole("button", {
        name: "Vis perioden 16.10.2026–22.10.2026",
      }),
    ).toBeInTheDocument();
  });

  it("uses the selected period until the bootstrap has answer dates", () => {
    state.params = {
      surveyId: "survey-top-tasks",
      dateMode: "fixed",
      fromDate: "2026-07-25",
      toDate: "2026-10-22",
    };

    render(<AnalysisBudgetAlert description={SUBJECT} />);

    expect(
      screen.getByRole("button", {
        name: "Vis perioden 23.09.2026–22.10.2026",
      }),
    ).toBeInTheDocument();
  });

  it("suggests a device filter when no shorter period has answers", () => {
    givenAnswers("2026-10-20T09:00:00Z", "2026-10-22T08:00:00Z");

    render(<AnalysisBudgetAlert description={SUBJECT} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Top Tasks-analysen kan ikke regnes ut for så mange svar. Et filter på enhet kan hjelpe.",
    );
    expect(alert).not.toHaveTextContent("kortere periode");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("only explains the limit when a device filter is already set", () => {
    givenAnswers("2026-10-20T09:00:00Z", "2026-10-22T08:00:00Z");
    state.params = { ...state.params, deviceType: "mobile" };

    render(<AnalysisBudgetAlert description={SUBJECT} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Top Tasks-analysen kan ikke regnes ut for så mange svar\.$/,
    );
  });

  it("names a shorter period without a button where the button cannot be reached", () => {
    render(
      <AnalysisBudgetAlert description={SUBJECT} offerShorterPeriod={false} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Velg en kortere periode.",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers to remove a task filter and moves focus to the page heading", async () => {
    const main = document.createElement("main");
    const heading = document.createElement("h1");
    main.append(heading);
    document.body.append(main);
    state.params = { ...state.params, task: "soke", page: "3" };
    state.setParams.mockImplementation(async () => {
      (document.activeElement as HTMLElement).blur();
    });
    const user = userEvent.setup();
    render(
      <AnalysisBudgetAlert
        description={FILTER_BUDGET_DESCRIPTION}
        offerRemoveFilter
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Lumi kan ikke filtrere så mange svar på oppgave, tema eller uttrykk. Velg en kortere periode, eller fjern filteret på oppgave.",
    );
    await user.click(
      screen.getByRole("button", { name: "Fjern filteret på oppgave" }),
    );

    const [next] = state.setParams.mock.calls[0];
    expect(next).toEqual({ page: "1" });
    expect(next).toHaveProperty("task", undefined);
    expect(next).toHaveProperty("theme", undefined);
    expect(next).toHaveProperty("phrase", undefined);
    expect(heading).toHaveFocus();
  });

  it("moves focus to the page heading while the button still has it", async () => {
    const main = document.createElement("main");
    const heading = document.createElement("h1");
    main.append(heading);
    document.body.append(main);
    state.params = { ...state.params, task: "soke" };
    const user = userEvent.setup();
    render(
      <AnalysisBudgetAlert
        description={FILTER_BUDGET_DESCRIPTION}
        offerRemoveFilter
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Fjern filteret på oppgave" }),
    );

    expect(heading).toHaveFocus();
  });

  it("speaks of the filters in plural when more than one is set", () => {
    state.params = { ...state.params, task: "soke", phrase: "tekst:to ord" };

    render(
      <AnalysisBudgetAlert
        description={FILTER_BUDGET_DESCRIPTION}
        offerRemoveFilter
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Velg en kortere periode, eller fjern filtrene på oppgave og uttrykk.",
    );
    expect(
      screen.getByRole("button", {
        name: "Fjern filtrene på oppgave og uttrykk",
      }),
    ).toBeInTheDocument();
  });

  it("asks only to remove the filter when no shorter period has answers", () => {
    givenAnswers("2026-10-20T09:00:00Z", "2026-10-22T08:00:00Z");
    state.params = { ...state.params, theme: "uncategorized" };

    render(
      <AnalysisBudgetAlert
        description={FILTER_BUDGET_DESCRIPTION}
        offerRemoveFilter
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Lumi kan ikke filtrere så mange svar på oppgave, tema eller uttrykk. Fjern filteret på tema.",
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
