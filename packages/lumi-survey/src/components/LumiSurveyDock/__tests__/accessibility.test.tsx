import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRatingSurvey } from "../../../presets";
import type { SurveyDocumentV1 } from "../../surveyTypes.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const survey = createRatingSurvey({
  ratingPrompt: "Hvor fornøyd er du?",
  followUpQuestions: [
    {
      id: "feedback",
      type: "text",
      prompt: "Hva kan vi forbedre?",
      required: false,
    },
  ],
});

const mockTransport = { submit: vi.fn().mockResolvedValue(undefined) };

describe("LumiSurveyDock Accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should have no axe violations in open state", async () => {
    const { container } = render(
      <LumiSurveyDock
        surveyId="a11y-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("should have no axe violations on the intro screen, blank start label included", async () => {
    const { container } = render(
      <LumiSurveyDock
        surveyId="a11y-test-intro"
        survey={
          {
            authoringSchemaVersion: 1,
            intro: {
              title: "Velkommen",
              body: "To korte spørsmål.",
              startLabel: "   ",
            },
            pages: [
              {
                id: "side-1",
                questions: [
                  {
                    id: "rating",
                    type: "rating",
                    prompt: "Hvordan gikk det?",
                  },
                ],
              },
            ],
          } satisfies SurveyDocumentV1
        }
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("should have no axe violations in minimized state", async () => {
    const { container } = render(
      <LumiSurveyDock
        surveyId="a11y-test-min"
        survey={survey}
        transport={mockTransport}
        behavior={{ initialOpen: false }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /gi tilbakemelding/i }),
      ).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("renders widget in aside element", async () => {
    render(
      <LumiSurveyDock
        surveyId="aside-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("complementary")).toBeInTheDocument();
    });
  });

  it("supports keyboard navigation for rating", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="keyboard-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /1\./i })).toBeInTheDocument();
    });

    const firstRadio = screen.getByRole("radio", { name: /1\./i });

    // Focus the first radio
    firstRadio.focus();
    expect(firstRadio).toHaveFocus();

    // Arrow right should select next option
    await user.keyboard("{ArrowRight}");
    const secondRadio = screen.getByRole("radio", { name: /2\./i });
    expect(secondRadio).toHaveAttribute("aria-checked", "true");
    expect(secondRadio).toHaveFocus();
  });

  it("has proper heading hierarchy", async () => {
    render(
      <LumiSurveyDock
        surveyId="heading-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Hvor fornøyd er du?");
    });
  });

  it("should have no axe violations in intro state", async () => {
    const { container } = render(
      <LumiSurveyDock
        surveyId="a11y-intro-test"
        survey={survey}
        transport={mockTransport}
        intro={{ title: "Hei!", body: "Vi vil gjerne høre fra deg." }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /hei!/i }),
      ).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it("intro heading has correct id for aria-labelledby", async () => {
    render(
      <LumiSurveyDock
        surveyId="intro-id-test"
        survey={survey}
        transport={mockTransport}
        intro={{ title: "Velkommen" }}
      />,
    );

    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /velkommen/i });
      expect(heading).toHaveAttribute("id", "intro-id-test-dock-intro-heading");
    });
  });

  it("announces success state to screen readers", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="announce-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    // Complete the form
    await user.click(screen.getByRole("radio", { name: /5\./i }));

    const textbox = screen.queryByRole("textbox");
    if (textbox) {
      await user.type(textbox, "Feedback");
    }

    await user.click(screen.getByRole("button", { name: /send/i }));

    // Check for status announcement
    await waitFor(() => {
      const statusRegion = screen.getByRole("status");
      expect(statusRegion).toBeInTheDocument();
    });
  });

  it("radiogroup has accessible name", async () => {
    render(
      <LumiSurveyDock
        surveyId="radiogroup-test"
        survey={survey}
        transport={mockTransport}
      />,
    );

    await waitFor(() => {
      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup).toHaveAttribute("aria-labelledby");
    });
  });

  it("moves focus to question heading after clicking Start in intro", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-intro-test"
        survey={survey}
        transport={mockTransport}
        intro={{ title: "Velkommen", body: "Kort intro" }}
      />,
    );

    // Intro heading is shown initially
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /velkommen/i }),
      ).toBeInTheDocument();
    });

    // Click Start
    await user.click(screen.getByRole("button", { name: /start/i }));

    // After transition, the question heading should have focus
    await waitFor(() => {
      const questionHeading = screen.getByRole("heading", {
        name: /hvor fornøyd er du/i,
      });
      expect(questionHeading).toHaveFocus();
    });
  });

  it("moves focus from the minimized trigger to the opened heading", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-open-test"
        survey={survey}
        transport={mockTransport}
        behavior={{ initialOpen: false, storageStrategy: "none" }}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: /gi tilbakemelding/i }),
    );

    expect(
      screen.getByRole("heading", { name: /hvor fornøyd er du/i }),
    ).toHaveFocus();
  });

  it("moves focus to the intro heading when reopening an intro survey", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-open-intro-test"
        survey={survey}
        transport={mockTransport}
        intro={{ title: "Velkommen", body: "Kort intro" }}
        behavior={{ initialOpen: false, storageStrategy: "none" }}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: /gi tilbakemelding/i }),
    );

    expect(screen.getByRole("heading", { name: /velkommen/i })).toHaveFocus();
  });

  it("moves focus from the close button to the minimized trigger", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-close-test"
        survey={survey}
        transport={mockTransport}
        behavior={{ storageStrategy: "none" }}
      />,
    );

    await screen.findByRole("radio", { name: /5\./i });
    await user.click(screen.getByRole("button", { name: /lukk/i }));

    expect(
      screen.getByRole("button", { name: /gi tilbakemelding/i }),
    ).toHaveFocus();
  });

  it("moves focus from submit to the success heading", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-success-test"
        survey={survey}
        transport={mockTransport}
        behavior={{ storageStrategy: "none" }}
      />,
    );

    await user.click(await screen.findByRole("radio", { name: /5\./i }));
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByRole("heading", {
        name: /takk for tilbakemeldingen/i,
      }),
    ).toHaveFocus();
  });

  it("does not steal focus back when a pending submit finishes", async () => {
    let resolveSubmission!: () => void;
    const submission = new Promise<void>((resolve) => {
      resolveSubmission = resolve;
    });
    const transport = { submit: vi.fn().mockReturnValue(submission) };
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Vertsside</button>
        <LumiSurveyDock
          surveyId="focus-success-host-test"
          survey={survey}
          transport={transport}
          behavior={{ storageStrategy: "none" }}
        />
      </>,
    );

    await user.click(await screen.findByRole("radio", { name: /5\./i }));
    await user.click(screen.getByRole("button", { name: /send/i }));
    await user.click(screen.getByRole("button", { name: /vertsside/i }));

    await act(async () => {
      resolveSubmission();
      await submission;
    });

    await screen.findByRole("heading", {
      name: /takk for tilbakemeldingen/i,
    });
    expect(screen.getByRole("button", { name: /vertsside/i })).toHaveFocus();
  });

  describe("when the receipt hides the dock completely", () => {
    const hostNodes: HTMLElement[] = [];

    const addHostElement = <K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      setup: (element: HTMLElementTagNameMap[K]) => void,
    ) => {
      const element = document.createElement(tagName);
      setup(element);
      document.body.prepend(element);
      hostNodes.push(element);
      return element;
    };

    const renderDockAfterHost = (
      success?: React.ComponentProps<typeof LumiSurveyDock>["success"],
    ) =>
      render(
        <LumiSurveyDock
          surveyId="focus-return-test"
          survey={survey}
          transport={mockTransport}
          behavior={{ storageStrategy: "none" }}
          success={success}
        />,
      );

    const answerAndCloseReceipt = async (
      user: ReturnType<typeof userEvent.setup>,
    ) => {
      await user.click(await screen.findByRole("radio", { name: /5\./i }));
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByRole("heading", {
        name: /takk for tilbakemeldingen/i,
      });
      // The receipt has two close controls; the primary one is last.
      const closeButtons = screen.getAllByRole("button", { name: "Lukk" });
      await user.click(closeButtons[closeButtons.length - 1]);
    };

    afterEach(() => {
      for (const node of hostNodes.splice(0)) {
        node.remove();
      }
      document.body.removeAttribute("tabindex");
    });

    it("returns focus to the element that had it before the dock", async () => {
      const host = addHostElement("button", (button) => {
        button.textContent = "Vertsside";
      });
      const user = userEvent.setup();
      renderDockAfterHost();
      await screen.findByRole("radio", { name: /5\./i });

      host.focus();
      await answerAndCloseReceipt(user);

      expect(
        document.querySelector('[data-feedback-id="focus-return-test"]'),
      ).not.toBeInTheDocument();
      expect(host).toHaveFocus();
    });

    it("returns focus after an automatic close as well", async () => {
      const host = addHostElement("button", (button) => {
        button.textContent = "Vertsside";
      });
      const user = userEvent.setup();
      renderDockAfterHost({ autoClose: true, autoCloseDelayMs: 10 });
      await screen.findByRole("radio", { name: /5\./i });

      host.focus();
      await user.click(screen.getByRole("radio", { name: /5\./i }));
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(host).toHaveFocus();
      });
    });

    it("falls back to #maincontent when the earlier element is gone", async () => {
      const main = addHostElement("main", (element) => {
        element.id = "maincontent";
      });
      const host = addHostElement("button", (button) => {
        button.textContent = "Vertsside";
      });
      const other = addHostElement("button", (button) => {
        button.textContent = "Annen knapp";
      });
      const user = userEvent.setup();
      renderDockAfterHost();
      await screen.findByRole("radio", { name: /5\./i });

      host.focus();
      await user.click(screen.getByRole("radio", { name: /5\./i }));
      host.remove();
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByRole("heading", {
        name: /takk for tilbakemeldingen/i,
      });
      const closeButtons = screen.getAllByRole("button", { name: "Lukk" });
      await user.click(closeButtons[closeButtons.length - 1]);

      expect(main).toHaveFocus();
      expect(main).toHaveAttribute("tabindex", "-1");

      // The temporary tabindex leaves with focus, so the host tab order stays.
      other.focus();
      expect(main).not.toHaveAttribute("tabindex");
    });

    it("keeps a tabindex the page has set on #maincontent", async () => {
      const main = addHostElement("main", (element) => {
        element.id = "maincontent";
        element.setAttribute("tabindex", "-1");
      });
      const other = addHostElement("button", (button) => {
        button.textContent = "Annen knapp";
      });
      const user = userEvent.setup();
      renderDockAfterHost();

      await answerAndCloseReceipt(user);

      expect(main).toHaveFocus();
      other.focus();
      expect(main).toHaveAttribute("tabindex", "-1");
    });

    it("skips an earlier element that can no longer take focus", async () => {
      const main = addHostElement("main", (element) => {
        element.id = "maincontent";
      });
      const host = addHostElement("button", (button) => {
        button.textContent = "Vertsside";
      });
      const user = userEvent.setup();
      renderDockAfterHost();
      await screen.findByRole("radio", { name: /5\./i });

      host.focus();
      await user.click(screen.getByRole("radio", { name: /5\./i }));
      host.disabled = true;
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByRole("heading", {
        name: /takk for tilbakemeldingen/i,
      });
      const closeButtons = screen.getAllByRole("button", { name: "Lukk" });
      await user.click(closeButtons[closeButtons.length - 1]);

      expect(host).not.toHaveFocus();
      expect(main).toHaveFocus();
    });

    it("falls back to the body when the page has no #maincontent", async () => {
      const user = userEvent.setup();
      renderDockAfterHost();

      await answerAndCloseReceipt(user);

      expect(document.activeElement).toBe(document.body);
      expect(document.body).toHaveAttribute("tabindex", "-1");
    });
  });

  describe("language marking", () => {
    const englishSurvey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      intro: { title: "Welcome", body: "Two short questions." },
      pages: [
        {
          id: "first",
          title: "About your visit",
          description: "Answer both questions.",
          questions: [
            {
              id: "task",
              type: "singleChoice",
              prompt: "What did you come to do?",
              description: "Pick one.",
              options: [
                { value: "apply", label: "Apply" },
                { value: "read", label: "Read" },
              ],
            },
            { id: "comment", type: "text", prompt: "Anything else?" },
          ],
        },
        {
          id: "second",
          questions: [{ id: "rating", type: "rating", prompt: "How was it?" }],
        },
      ],
      success: { title: "Thank you!", body: "We read every answer." },
    };

    const renderEnglishDock = (
      props: Partial<React.ComponentProps<typeof LumiSurveyDock>> = {},
    ) =>
      render(
        <LumiSurveyDock
          surveyId="lang-prop-test"
          survey={englishSurvey}
          transport={mockTransport}
          behavior={{ storageStrategy: "none" }}
          {...props}
        />,
      );

    const langOf = (element: Element) =>
      element.closest("[lang]")?.getAttribute("lang") ?? null;

    const expectOptionalSuffixesInBokmal = () => {
      const suffixes = screen.getAllByText("(valgfritt)");
      expect(suffixes.length).toBeGreaterThan(0);
      for (const suffix of suffixes) {
        expect(langOf(suffix)).toBe("nb");
      }
    };

    it("inherits the page language without lang, apart from built-in copy", async () => {
      const user = userEvent.setup();
      renderEnglishDock();

      const aside = await screen.findByRole("complementary", {
        name: "Tilbakemeldingspanel",
      });
      expect(aside).not.toHaveAttribute("lang");
      expect(langOf(screen.getByText("Welcome"))).toBeNull();
      expect(langOf(screen.getByText("Two short questions."))).toBeNull();
      expect(langOf(screen.getByRole("button", { name: "Start" }))).toBe("nb");

      await user.click(screen.getByRole("button", { name: "Start" }));

      expect(langOf(screen.getByText("About your visit"))).toBeNull();
      expect(langOf(screen.getByText("What did you come to do?"))).toBeNull();
      expect(langOf(screen.getByText("Apply"))).toBeNull();
      expect(langOf(screen.getByRole("button", { name: "Neste" }))).toBe("nb");
      expectOptionalSuffixesInBokmal();

      await user.click(screen.getByRole("button", { name: "Lukk" }));

      expect(
        langOf(screen.getByRole("button", { name: "Gi tilbakemelding" })),
      ).toBe("nb");
    });

    it("marks text from the survey with lang", async () => {
      const user = userEvent.setup();
      renderEnglishDock({ lang: "en" });

      expect(langOf(await screen.findByText("Welcome"))).toBe("en");
      expect(langOf(screen.getByText("Two short questions."))).toBe("en");
      expect(screen.getByRole("complementary")).not.toHaveAttribute("lang");

      await user.click(screen.getByRole("button", { name: "Start" }));

      expect(langOf(screen.getByText("About your visit"))).toBe("en");
      expect(langOf(screen.getByText("Answer both questions."))).toBe("en");
      expect(langOf(screen.getByText("What did you come to do?"))).toBe("en");
      expect(langOf(screen.getByText("Pick one."))).toBe("en");
      expect(langOf(screen.getByText("Apply"))).toBe("en");
      expect(langOf(screen.getByText("Anything else?"))).toBe("en");
      // Built-in copy keeps its own Bokmål marking.
      expect(langOf(screen.getByRole("button", { name: "Neste" }))).toBe("nb");
      expectOptionalSuffixesInBokmal();
    });

    it("leaves copy replaced through labels to the page language", async () => {
      const user = userEvent.setup();
      render(
        <LumiSurveyDock
          surveyId="lang-labels-test"
          survey={survey}
          transport={mockTransport}
          behavior={{ storageStrategy: "none" }}
          labels={{ submit: "Send feedback", minimizedButton: "Give feedback" }}
          success={{ primaryLabel: "Close" }}
        />,
      );

      await user.click(await screen.findByRole("radio", { name: /5\./i }));
      expect(
        langOf(screen.getByRole("button", { name: "Send feedback" })),
      ).toBeNull();

      await user.click(screen.getByRole("button", { name: "Send feedback" }));

      // The default receipt title is still built-in copy.
      expect(
        langOf(
          await screen.findByRole("heading", {
            name: /takk for tilbakemeldingen/i,
          }),
        ),
      ).toBe("nb");
      expect(langOf(screen.getByRole("button", { name: "Close" }))).toBeNull();
    });

    it("marks the default minimized button and leaves a replaced one alone", async () => {
      const { unmount } = render(
        <LumiSurveyDock
          surveyId="lang-minimized-test"
          survey={survey}
          transport={mockTransport}
          behavior={{ storageStrategy: "none", initialOpen: false }}
        />,
      );
      expect(
        langOf(
          await screen.findByRole("button", { name: "Gi tilbakemelding" }),
        ),
      ).toBe("nb");
      unmount();

      render(
        <LumiSurveyDock
          surveyId="lang-minimized-test"
          survey={survey}
          transport={mockTransport}
          behavior={{ storageStrategy: "none", initialOpen: false }}
          labels={{ minimizedButton: "Give feedback" }}
        />,
      );
      expect(
        langOf(await screen.findByRole("button", { name: "Give feedback" })),
      ).toBeNull();
    });
  });

  it("moves focus to the new question heading after Next and Back", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-step-test"
        survey={survey}
        transport={mockTransport}
        behavior={{ questionLayout: "steps" }}
      />,
    );

    const rating = await screen.findByRole("radio", { name: /5\./i });
    await user.click(rating);
    expect(rating).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /neste/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /hva kan vi forbedre/i }),
      ).toHaveFocus();
    });

    await user.click(screen.getByRole("button", { name: /tilbake/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /hvor fornøyd er du/i }),
      ).toHaveFocus();
    });
  });

  it("does not move focus to the heading for an ordinary answer change", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="focus-answer-test"
        survey={survey}
        transport={mockTransport}
        behavior={{ questionLayout: "steps" }}
      />,
    );

    const rating = await screen.findByRole("radio", { name: /5\./i });
    await user.click(rating);

    expect(rating).toHaveFocus();
    expect(
      screen.getByRole("heading", { name: /hvor fornøyd er du/i }),
    ).not.toHaveFocus();
  });

  it("has no axe violations with multiple questions and an error summary", async () => {
    const user = userEvent.setup();
    const pageSurvey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "page-one",
          title: "Om opplevelsen",
          questions: [
            {
              id: "first",
              type: "text",
              prompt: "Første spørsmål",
              required: true,
            },
            {
              id: "second",
              type: "text",
              prompt: "Andre spørsmål",
              required: true,
            },
          ],
        },
        {
          id: "page-two",
          title: "Til slutt",
          questions: [{ id: "last", type: "text", prompt: "Siste spørsmål" }],
        },
      ],
    };
    const { container } = render(
      <LumiSurveyDock
        surveyId="page-a11y-test"
        survey={pageSurvey}
        transport={mockTransport}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Neste" }));
    expect(
      await screen.findByRole("heading", {
        name: "Du må rette svarene før du kan fortsette:",
      }),
    ).toHaveFocus();

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
