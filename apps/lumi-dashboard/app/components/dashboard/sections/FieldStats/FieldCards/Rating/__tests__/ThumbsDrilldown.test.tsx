import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ThumbsDrilldown } from "../ThumbsDrilldown";

vi.mock("recharts", () => {
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="recharts-responsive">{children}</div>
    ),
    PieChart: ({ children }: { children: ReactNode }) => (
      <svg data-testid="recharts-piechart" aria-hidden="true">
        <title>Mock chart</title>
        {children}
      </svg>
    ),
    Tooltip: () => null,
    Pie: ({ children }: { children: ReactNode }) => (
      <g data-testid="recharts-pie">{children}</g>
    ),
    Sector: () => null,
  };
});

describe("ThumbsDrilldown", () => {
  it("calls onSelect for 👍 Ja and 👎 Nei", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <ThumbsDrilldown
        fieldId="f1"
        distribution={{ "2": 7, "1": 3 }}
        fieldTotalResponses={10}
        activeRatingValue={undefined}
        isFilteringThisField={false}
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByTestId("thumbs-drilldown-f1-2"));
    expect(onSelect).toHaveBeenCalledWith("2");

    await user.click(screen.getByTestId("thumbs-drilldown-f1-1"));
    expect(onSelect).toHaveBeenCalledWith("1");

    expect(onClear).not.toHaveBeenCalled();
  });

  it("shows aria-pressed state and clear button when filtering", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <ThumbsDrilldown
        fieldId="f1"
        distribution={{ "2": 1, "1": 0 }}
        fieldTotalResponses={1}
        activeRatingValue="2"
        isFilteringThisField
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    expect(screen.getByTestId("thumbs-drilldown-f1-2")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("thumbs-drilldown-f1-1")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Nullstill" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
