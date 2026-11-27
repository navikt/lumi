import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLASS_NAMES } from "../../LumiSurveyDock/classNames.js";
import type { SurveyDocumentV1 } from "../../surveyTypes.js";
import { LumiSurveyInline } from "../LumiSurveyInline.js";

const survey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "kalkulator",
      questions: [
        {
          id: "rating",
          type: "rating",
          variant: "emoji",
          prompt: "Hvor lett var det å bruke kalkulatoren?",
          description: "Tenk på forrige gang du brukte den.",
          required: true,
        },
        {
          id: "begrunnelse",
          type: "text",
          prompt: "Hva kunne vært bedre?",
          visibleIf: { questionId: "rating", operator: "EXISTS" },
        },
      ],
    },
  ],
};

const pagedSurvey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  intro: { title: "To korte spørsmål", body: "Det tar under ett minutt." },
  pages: [
    {
      id: "besok",
      title: "Om besøket",
      description: "Tenk på det du nettopp gjorde.",
      questions: [
        {
          id: "oppgave",
          type: "text",
          prompt: "Hva kom du for å gjøre?",
          required: true,
        },
        {
          id: "resultat",
          type: "singleChoice",
          prompt: "Fikk du gjort det?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "nei", label: "Nei" },
          ],
        },
        {
          id: "viktig",
          type: "multiChoice",
          prompt: "Hva var viktigst?",
          options: [
            { value: "fart", label: "At det gikk fort" },
            { value: "sprak", label: "At språket var klart" },
          ],
        },
        {
          id: "vurdering",
          type: "rating",
          variant: "nps",
          prompt: "Hvor sannsynlig er det at du bruker siden igjen?",
        },
      ],
    },
    {
      id: "mer",
      title: "Fortell mer",
      questions: [
        { id: "kommentar", type: "text", prompt: "Hva kan vi forbedre?" },
      ],
    },
  ],
};

const transport = { submit: vi.fn().mockResolvedValue(undefined) };

/** The page an inline survey lives in: under a heading, inside `<main>`. */
const AppPage = ({ children }: { children: ReactNode }) => (
  <main>
    <h1>Kalkulator</h1>
    <h2>Resultatet ditt</h2>
    <p>Innhold fra appen.</p>
    {children}
  </main>
);

const expectNoViolations = async () => {
  const results = await axe.run(document.body);
  expect(results.violations).toEqual([]);
};

describe("LumiSurveyInline accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("has no axe violations with a question, inside the main landmark of a page", async () => {
    render(
      <AppPage>
        <LumiSurveyInline
          surveyId="a11y-inline"
          survey={survey}
          transport={transport}
          headingLevel="3"
        />
      </AppPage>,
    );

    await expectNoViolations();
  });

  it("has no axe violations on the intro, on a page with several kinds of questions and on the receipt", async () => {
    const user = userEvent.setup();
    render(
      <AppPage>
        <LumiSurveyInline
          surveyId="a11y-inline-pages"
          survey={pagedSurvey}
          transport={transport}
          headingLevel="3"
          behavior={{ showProgress: true }}
        />
      </AppPage>,
    );

    await expectNoViolations();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await expectNoViolations();

    await user.type(
      screen.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
      "Regne ut",
    );
    await user.click(screen.getByRole("radio", { name: "Ja" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    await screen.findByRole("heading", { name: "Fortell mer" });
    await expectNoViolations();

    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("heading", { name: "Takk for tilbakemeldingen!" });
    await expectNoViolations();
  });

  it("has no axe violations while it shows validation errors", async () => {
    const user = userEvent.setup();
    render(
      <AppPage>
        <LumiSurveyInline
          surveyId="a11y-inline-errors"
          survey={{ ...pagedSurvey, intro: undefined }}
          transport={transport}
          headingLevel="3"
        />
      </AppPage>,
    );

    await user.click(screen.getByRole("button", { name: "Neste" }));
    await screen.findByRole("heading", {
      name: "Du må rette svarene før du kan fortsette:",
    });

    await expectNoViolations();
  });

  it("has no axe violations with two surveys on the same page", async () => {
    render(
      <AppPage>
        <LumiSurveyInline
          surveyId="a11y-inline-repeated"
          survey={survey}
          transport={transport}
          headingLevel="3"
        />
        <h2>Neste del</h2>
        <LumiSurveyInline
          surveyId="a11y-inline-repeated"
          survey={survey}
          transport={transport}
          headingLevel="3"
        />
      </AppPage>,
    );

    await expectNoViolations();
  });

  it("adds no landmark to the page", () => {
    render(
      <AppPage>
        <LumiSurveyInline
          surveyId="a11y-inline"
          survey={survey}
          transport={transport}
        />
      </AppPage>,
    );

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("names the rating group by the survey's heading and describes it by the description", () => {
    render(
      <LumiSurveyInline
        surveyId="a11y-inline"
        survey={survey}
        transport={transport}
      />,
    );

    const group = screen.getByRole("radiogroup", {
      name: "Hvor lett var det å bruke kalkulatoren?",
    });
    expect(group).toHaveAccessibleDescription(
      "Tenk på forrige gang du brukte den.",
    );
    expect(within(group).getAllByRole("radio")).toHaveLength(5);
    // The prompt is read once: the heading names the group.
    expect(
      screen.getAllByRole("heading", {
        name: "Hvor lett var det å bruke kalkulatoren?",
      }),
    ).toHaveLength(1);
  });

  it.each([
    ["empty", ""],
    ["only spaces", " "],
  ])(
    "names the rating group by its prompt when the page title is %s",
    (_kind, title) => {
      const blankTitle: SurveyDocumentV1 = {
        ...survey,
        pages: [{ ...survey.pages[0], title }],
      };
      render(
        <LumiSurveyInline
          surveyId="a11y-inline"
          survey={blankTitle}
          transport={transport}
        />,
      );

      const prompt = "Hvor lett var det å bruke kalkulatoren?";
      expect(
        screen.getByRole("radiogroup", { name: prompt }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("heading").map((heading) => heading.textContent),
      ).toEqual([prompt]);
    },
  );

  it("announces the receipt in a live region and marks its heading as focusable from script only", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyInline
        surveyId="a11y-inline"
        survey={survey}
        transport={transport}
        success={{ title: "Takk for svaret", body: "Vi leser alt." }}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /5\./ }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    const receipt = await screen.findByRole("heading", {
      name: "Takk for svaret",
    });
    expect(receipt).toHaveAttribute("tabindex", "-1");
    expect(receipt.closest('[role="status"]')).toHaveAttribute(
      "aria-live",
      "polite",
    );
    const root = document.querySelector(`.${CLASS_NAMES.inlineContainer}`);
    expect(root?.querySelectorAll('[tabindex="0"], button, a')).toHaveLength(0);
  });

  it("announces a failed submission as an alert", async () => {
    const user = userEvent.setup();
    render(
      <AppPage>
        <LumiSurveyInline
          surveyId="a11y-inline"
          survey={survey}
          transport={{ submit: vi.fn().mockRejectedValue(new Error("nei")) }}
          headingLevel="3"
        />
      </AppPage>,
    );

    await user.click(screen.getByRole("radio", { name: /5\./ }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kunne ikke sende tilbakemeldingen.",
    );
    await expectNoViolations();
  });

  it("reports progress to screen readers when the pages are shown one at a time", () => {
    render(
      <LumiSurveyInline
        surveyId="a11y-inline-progress"
        survey={{ ...pagedSurvey, intro: undefined }}
        transport={transport}
        behavior={{ showProgress: true }}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Fremdrift i undersøkelsen" }),
    ).toHaveAttribute("aria-valuetext", "Steg 1 av 2");
  });
});
