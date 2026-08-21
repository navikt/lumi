import { createMemoryHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TextAnalysis, type TextAnalysisProps } from ".";

const themeState = vi.hoisted(() => ({
  themes: [] as Array<{
    id: string;
    team: string;
    name: string;
    keywords: string[];
    analysisContext: "GENERAL_FEEDBACK" | "BLOCKER";
  }>,
  isLoading: false,
  error: null as Error | null,
}));

vi.mock("~/hooks/useThemes", () => ({
  useThemes: () => ({
    themes: themeState.themes,
    isLoading: themeState.isLoading,
    error: themeState.error,
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock("~/components/shared/ThemeModal", () => ({
  ThemeModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Opprett tema</div> : null,
}));

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
  return render(createElement(RouterProvider, { router }));
}

const baseProps: TextAnalysisProps = {
  analysisContext: "GENERAL_FEEDBACK",
  phrases: [
    { text: "søke sykepenger", count: 12 },
    { text: "finne riktig", count: 7 },
  ],
  quotes: [
    {
      text: "Jeg prøvde å finne riktig skjema for sykepenger.",
      answeredAt: "2026-08-10T10:00:00Z",
    },
  ],
  confidenceLevel: "high",
  phraseFieldId: "task",
  themes: [],
  recentResponses: [
    {
      text: "Dette er det aller nyeste svaret.",
      submittedAt: "2026-08-20T10:00:00Z",
      success: "partial",
    },
  ],
  totalCount: 120,
};

describe("TextAnalysis", () => {
  beforeEach(() => {
    themeState.themes = [];
    themeState.isLoading = false;
    themeState.error = null;
  });

  it("prioriterer fraser og utvalgte eksempler når svargrunnlaget er stort", async () => {
    await renderWithRouter(<TextAnalysis {...baseProps} />);

    expect(screen.getByText("Mange svar")).toBeInTheDocument();
    expect(screen.getByText("Uttrykk som går igjen")).toBeInTheDocument();
    expect(screen.getByText("Eksempler fra svarene")).toBeInTheDocument();
    expect(
      screen.getByText("«Jeg prøvde å finne riktig skjema for sykepenger.»"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Dette er det aller nyeste svaret/),
    ).not.toBeInTheDocument();

    const phraseHeading = screen.getByText("Uttrykk som går igjen");
    const examplesHeading = screen.getByText("Eksempler fra svarene");
    expect(
      phraseHeading.compareDocumentPosition(examplesHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const phraseLink = screen.getByRole("link", {
      name: /12 tilbakemeldinger.*søke sykepenger/i,
    });
    expect(phraseLink).toHaveAttribute(
      "href",
      expect.stringMatching(/phrase=task.*s%C3%B8ke|phrase=task.*søke/i),
    );
  });

  it("viser konkrete, nyeste svar før tidlige mønstre når det er få svar", async () => {
    await renderWithRouter(
      <TextAnalysis {...baseProps} confidenceLevel="low" totalCount={12} />,
    );

    expect(screen.getByText("Få svar")).toBeInTheDocument();
    expect(screen.getByText("Svarene så langt")).toBeInTheDocument();
    expect(screen.getByText("Tidlige mønstre")).toBeInTheDocument();
    expect(
      screen.getByText("«Dette er det aller nyeste svaret.»"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Jeg prøvde å finne riktig skjema/),
    ).not.toBeInTheDocument();

    const responsesHeading = screen.getByText("Svarene så langt");
    const phraseHeading = screen.getByText("Tidlige mønstre");
    expect(
      responsesHeading.compareDocumentPosition(phraseHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("forklarer at egne temaer har en annen rolle enn automatiske fraser", async () => {
    await renderWithRouter(<TextAnalysis {...baseProps} />);

    expect(screen.getByText("Egne temaer")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Lag egne temaer når dere vil følge de samme tingene over tid.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nytt tema" }),
    ).toBeInTheDocument();
  });

  it("holder egne temaer uten treff tilgjengelige og skiller svar uten tema", async () => {
    themeState.themes = [
      {
        id: "theme-no-hits",
        team: "team-test",
        name: "Utbetaling",
        keywords: ["utbetaling"],
        analysisContext: "GENERAL_FEEDBACK",
      },
    ];

    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        themes={[
          {
            theme: "Annet",
            count: 9,
            examples: ["Et svar uten treff"],
          },
        ]}
      />,
    );

    expect(screen.getByText("1 eget tema")).toBeInTheDocument();
    expect(screen.getByText("Utbetaling")).toBeInTheDocument();
    expect(screen.getByText("0 (0%)")).toBeInTheDocument();
    expect(screen.getByText("Uten tema")).toBeInTheDocument();
    expect(screen.getByText("9 svar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Uten tema/ })).toHaveAttribute(
      "href",
      expect.stringContaining("theme=uncategorized"),
    );
  });

  it("viser discovery-temaets fullføringsandel", async () => {
    themeState.themes = [
      {
        id: "theme-with-rate",
        team: "team-test",
        name: "Utbetaling",
        keywords: ["utbetaling"],
        analysisContext: "GENERAL_FEEDBACK",
      },
    ];

    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        themes={[
          {
            theme: "Utbetaling",
            count: 12,
            examples: [],
            successRate: 0.75,
          },
        ]}
      />,
    );

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("viser hindringstemaer uten en filterlenke som API-et ikke støtter", async () => {
    themeState.themes = [
      {
        id: "blocker-theme",
        team: "team-test",
        name: "Innlogging",
        keywords: ["innlogging"],
        analysisContext: "BLOCKER",
      },
    ];

    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        analysisContext="BLOCKER"
        themes={[
          {
            theme: "Innlogging",
            themeId: "blocker-theme",
            count: 4,
            examples: [],
          },
          { theme: "Annet", themeId: "blocker-other", count: 3, examples: [] },
        ]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Innlogging" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Uten tema/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Uten tema")).toBeInTheDocument();
  });

  it("viser temalasting uten å fremstille statistikk som konfigurerte temaer", async () => {
    themeState.isLoading = true;

    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        themes={[{ theme: "Utbetaling", count: 12, examples: [] }]}
      />,
    );

    expect(screen.getByText("Laster temaer …")).toBeInTheDocument();
    expect(screen.queryByText("Utbetaling")).not.toBeInTheDocument();
  });

  it("viser temafeil uten å fremstille statistikk som konfigurerte temaer", async () => {
    themeState.error = new Error("Tematjenesten svarte ikke");

    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        themes={[{ theme: "Utbetaling", count: 12, examples: [] }]}
      />,
    );

    expect(screen.getByText("Kunne ikke laste temaene.")).toBeInTheDocument();
    expect(
      screen.getByText("Kunne ikke laste temaene. Prøv å laste siden på nytt."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Utbetaling")).not.toBeInTheDocument();
  });

  it("beholder cachede temaer når en oppdatering feiler", async () => {
    themeState.themes = [
      {
        id: "cached-theme",
        team: "team-test",
        name: "Utbetaling",
        keywords: ["utbetaling"],
        analysisContext: "GENERAL_FEEDBACK",
      },
    ];
    themeState.error = new Error("Oppdateringen feilet");

    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        themes={[{ theme: "Utbetaling", count: 12, examples: [] }]}
      />,
    );

    expect(screen.getByText("Utbetaling")).toBeInTheDocument();
    expect(
      screen.getByText(/Viser temaene som allerede var lastet inn/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rediger temaet Utbetaling" }),
    ).toBeInTheDocument();
  });

  it("viser tom tilstand uten å blokkere opprettelse av det første temaet", async () => {
    const user = userEvent.setup();
    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        phrases={[]}
        quotes={[]}
        recentResponses={[]}
        totalCount={0}
      />,
    );

    expect(
      screen.getByText("Ingen data tilgjengelig ennå."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Opprett første tema" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("bruker den synlige, domenetilpassede overskriften som listenavn", async () => {
    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        labels={{ phrasesTitle: "Oppgaver som går igjen" }}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Oppgaver som går igjen" }),
    ).toBeInTheDocument();
  });

  it.each([
    [29, "Få svar"],
    [30, "Noen svar"],
    [100, "Noen svar"],
    [101, "Mange svar"],
  ])("utleder riktig svargrunnlag ved %i svar når API-feltet mangler", async (totalCount, expectedLabel) => {
    await renderWithRouter(
      <TextAnalysis
        {...baseProps}
        confidenceLevel={undefined}
        totalCount={totalCount}
      />,
    );

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });
});
