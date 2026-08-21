import { createMemoryHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import type { FieldStat, TextStats } from "~/types/api";
import { TextFieldCard } from "../TextFieldCard";

async function renderWithRouter(ui: React.ReactElement) {
  const rootRoute = createRootRoute({ component: () => ui });
  const feedbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/feedback",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([feedbackRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  const result = render(createElement(RouterProvider, { router }));
  return result;
}

const mockTextStatsWithPhrases: TextStats = {
  type: "text",
  responseCount: 82,
  responseRate: 68,
  topKeywords: [
    { word: "vanskelig", count: 8 },
    { word: "forstå", count: 6 },
  ],
  topPhrases: [
    { text: "vanskelig forstå", count: 8 },
    { text: "digitale tjenester", count: 6 },
    { text: "god dialog", count: 5 },
    { text: "litt tungvint", count: 4 },
    { text: "svare mobilen", count: 3 },
    { text: "neste gang", count: 2 },
  ],
  recentResponses: [
    { text: "Vanskelig å forstå", submittedAt: "2024-01-15T10:00:00Z" },
  ],
};

const mockTextStatsKeywordsOnly: TextStats = {
  type: "text",
  responseCount: 12,
  responseRate: 40,
  topKeywords: [
    { word: "bra", count: 3 },
    { word: "enkel", count: 2 },
  ],
  recentResponses: [],
};

function mockField(stats: TextStats): FieldStat {
  return {
    fieldId: "comment-field",
    fieldType: "TEXT",
    label: "Hva synes du?",
    stats,
  };
}

describe("TextFieldCard", () => {
  it("rendrer topp 5 fraser som klikkbare lenker", async () => {
    await renderWithRouter(
      <TextFieldCard
        field={mockField(mockTextStatsWithPhrases)}
        totalCount={120}
      />,
    );

    expect(screen.getByText("Uttrykk som går igjen")).toBeInTheDocument();

    // First 5 phrases should be visible
    expect(screen.getByText("vanskelig forstå")).toBeInTheDocument();
    expect(screen.getByText("digitale tjenester")).toBeInTheDocument();
    expect(screen.getByText("god dialog")).toBeInTheDocument();
    expect(screen.getByText("litt tungvint")).toBeInTheDocument();
    expect(screen.getByText("svare mobilen")).toBeInTheDocument();

    // 6th phrase should NOT be visible (max 5)
    expect(screen.queryByText("neste gang")).not.toBeInTheDocument();

    // All 5 phrases should be links
    const phraseLinks = screen.getAllByRole("link");
    expect(phraseLinks).toHaveLength(5);
  });

  it("frase-lenker bruker phrase-param i stedet for query", async () => {
    await renderWithRouter(
      <TextFieldCard
        field={mockField(mockTextStatsWithPhrases)}
        totalCount={120}
      />,
    );

    const link = screen.getByRole("link", {
      name: /vanskelig forstå/,
    });

    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/feedback");
    // Should use phrase param with fieldId:surface format
    expect(href).toMatch(/phrase=comment-field/);
    expect(href).toMatch(/vanskelig/);
    // Should NOT have query param (mutual exclusion)
    expect(href).not.toMatch(/query=/);
    // Should have hasText and page
    expect(href).toMatch(/hasText=(%22|"|)true(%22|"|)/);
    expect(href).toMatch(/page=(%22|"|)1(%22|"|)/);
  });

  it("faller tilbake til keyword-tags når topPhrases mangler", async () => {
    await renderWithRouter(
      <TextFieldCard
        field={mockField(mockTextStatsKeywordsOnly)}
        totalCount={30}
      />,
    );

    expect(screen.getByText("Hyppigste ord")).toBeInTheDocument();
    expect(screen.getByText(/bra/)).toBeInTheDocument();
    expect(screen.getByText(/enkel/)).toBeInTheDocument();

    // Should NOT have an ordered list (phrases use <ol>)
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    // Should NOT show phrase heading
    expect(screen.queryByText("Uttrykk som går igjen")).not.toBeInTheDocument();
  });

  it("viser tom tilstand uten data", async () => {
    const emptyStats: TextStats = {
      type: "text",
      responseCount: 0,
      responseRate: 0,
      topKeywords: [],
      recentResponses: [],
    };

    await renderWithRouter(
      <TextFieldCard field={mockField(emptyStats)} totalCount={30} />,
    );

    expect(screen.getByText("Ingen tekstsvar ennå")).toBeInTheDocument();
  });

  it("fraser har korrekte aria-labels med «»-format", async () => {
    await renderWithRouter(
      <TextFieldCard
        field={mockField(mockTextStatsWithPhrases)}
        totalCount={120}
      />,
    );

    const link = screen.getByRole("link", {
      name: /8.*vanskelig forstå|vanskelig forstå.*8/,
    });
    expect(link).toBeInTheDocument();

    // Verify all phrase links have descriptive aria-labels
    const allLinks = screen.getAllByRole("link");
    for (const phraseLink of allLinks) {
      expect(phraseLink).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/Vis \d+ tilbakemeldinger med uttrykket/),
      );
    }
  });

  it("viser maks 3 siste svar selv om backend leverer flere", async () => {
    const statsWithManyResponses: TextStats = {
      type: "text",
      responseCount: 50,
      responseRate: 80,
      topKeywords: [],
      recentResponses: [
        { text: "Svar 1", submittedAt: "2024-01-15T10:00:00Z" },
        { text: "Svar 2", submittedAt: "2024-01-14T10:00:00Z" },
        { text: "Svar 3", submittedAt: "2024-01-13T10:00:00Z" },
        { text: "Svar 4", submittedAt: "2024-01-12T10:00:00Z" },
        { text: "Svar 5", submittedAt: "2024-01-11T10:00:00Z" },
      ],
    };

    await renderWithRouter(
      <TextFieldCard
        field={mockField(statsWithManyResponses)}
        totalCount={60}
      />,
    );

    expect(screen.getByText('"Svar 1"')).toBeInTheDocument();
    expect(screen.getByText('"Svar 2"')).toBeInTheDocument();
    expect(screen.getByText('"Svar 3"')).toBeInTheDocument();
    expect(screen.queryByText('"Svar 4"')).not.toBeInTheDocument();
    expect(screen.queryByText('"Svar 5"')).not.toBeInTheDocument();
  });
});
