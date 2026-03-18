import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ChoiceStats } from "~/types/api";
import { ChoiceFieldCard } from "../ChoiceFieldCard";

describe("ChoiceFieldCard", () => {
  it("shows unique respondent count and total selections for multi choice fields", () => {
    render(
      <ChoiceFieldCard
        totalCount={26}
        field={{
          fieldId: "hindringer",
          fieldType: "MULTI_CHOICE",
          label: "Hva er de største hindringene?",
          stats: {
            type: "choice",
            responseCount: 26,
            responseRate: 1,
            totalSelections: 62,
            distribution: {
              time: { label: "Tid", count: 18, percentage: 69 },
              rules: { label: "Regelverk", count: 12, percentage: 46 },
            },
          },
        }}
      />,
    );

    expect(screen.getByText("26 av 26 har svart (100%)")).toBeInTheDocument();
    expect(screen.getByText("62 valg totalt")).toBeInTheDocument();
    expect(screen.getByText("18 (69%)")).toBeInTheDocument();
    expect(screen.getByText("12 (46%)")).toBeInTheDocument();
  });

  it("falls back safely while the dashboard still receives the legacy choice payload", () => {
    const legacyStats: ChoiceStats = JSON.parse(`{
      "type": "choice",
      "distribution": {
        "time": { "label": "Tid", "count": 40, "percentage": 65 },
        "rules": { "label": "Regelverk", "count": 22, "percentage": 35 }
      }
    }`);

    render(
      <ChoiceFieldCard
        totalCount={26}
        field={{
          fieldId: "hindringer",
          fieldType: "MULTI_CHOICE",
          label: "Hva er de største hindringene?",
          stats: legacyStats,
        }}
      />,
    );

    expect(screen.getByText("26 av 26 har svart (100%)")).toBeInTheDocument();
    expect(screen.queryByText("62 valg totalt")).not.toBeInTheDocument();
  });
});
