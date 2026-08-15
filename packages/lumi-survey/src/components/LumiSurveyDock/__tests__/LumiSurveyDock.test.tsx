import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyEvents,
  LumiSurveyTransport,
} from "../../../core/types.js";
import {
  createRatingSurvey,
  createTopTasksSurvey,
} from "../../../presets/index.js";
import type {
  LumiSurveyConfig,
  LumiSurveyDefinition,
  SurveyDocumentV1,
} from "../../surveyTypes.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

function createSurvey(): LumiSurveyConfig {
  return createRatingSurvey({
    ratingPrompt: "Hvor fornøyd er du?",
    ratingDescription: "Beskriv gjerne opplevelsen din.",
    followUpQuestions: [
      {
        id: "feedback",
        type: "text",
        prompt: "Hva kan vi forbedre?",
        required: true,
        maxLength: 500,
      },
      {
        id: "free-text",
        type: "text",
        prompt: "Andre kommentarer?",
        required: false,
        maxLength: 500,
      },
    ],
  });
}

function renderDock(options?: {
  transport?: LumiSurveyTransport;
  events?: LumiSurveyEvents;
  survey?: LumiSurveyDefinition;
  context?: Record<string, unknown>;
  initialOpen?: boolean;
  behavior?: Record<string, unknown>;
}) {
  const transport: LumiSurveyTransport = options?.transport ?? {
    submit: vi.fn().mockResolvedValue(undefined),
  };

  return render(
    <LumiSurveyDock
      surveyId="dock-feedback"
      survey={options?.survey ?? createSurvey()}
      transport={transport}
      events={options?.events}
      context={options?.context}
      behavior={{
        initialOpen: options?.initialOpen ?? true,
        ...(options?.behavior ?? {}),
      }}
    />,
  );
}

describe("LumiSurveyDock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders and validates multiple questions on an authored page", async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "context",
          title: "Om besøket",
          description: "Svar på begge spørsmålene.",
          questions: [
            {
              id: "task",
              type: "text",
              prompt: "Hva prøvde du å gjøre?",
              required: true,
            },
            {
              id: "outcome",
              type: "text",
              prompt: "Hvordan gikk det?",
              required: true,
            },
          ],
        },
        {
          id: "details",
          title: "Fortell mer",
          questions: [
            {
              id: "comment",
              type: "text",
              prompt: "Hva kan vi forbedre?",
            },
          ],
        },
      ],
    };

    renderDock({
      survey,
      events: { onStepChange },
      behavior: { questionLayout: "auto", showProgress: true },
    });

    expect(
      await screen.findByRole("heading", { name: "Om besøket" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Svar på begge spørsmålene.")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Hva prøvde du å gjøre?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Hvordan gikk det?" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Hva kan vi forbedre?" }),
    ).not.toBeInTheDocument();
    expect(onStepChange).toHaveBeenLastCalledWith(0, 2);

    await user.click(screen.getByRole("button", { name: "Neste" }));

    const errorSummary = await screen.findByText(
      "Du må svare på disse spørsmålene før du kan fortsette:",
    );
    expect(errorSummary).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Hva prøvde du å gjøre?" }),
    ).toHaveAttribute("href", "#dock-feedback-question-task");
    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(errorSummary).toHaveFocus();
    await user.click(
      screen.getByRole("link", { name: "Hva prøvde du å gjøre?" }),
    );
    expect(
      screen.getByRole("textbox", { name: "Hva prøvde du å gjøre?" }),
    ).toHaveFocus();

    await user.type(
      screen.getByRole("textbox", { name: "Hva prøvde du å gjøre?" }),
      "Finne informasjon",
    );
    expect(
      screen.getByRole("textbox", { name: "Hva prøvde du å gjøre?" }),
    ).toHaveFocus();
    await user.type(
      screen.getByRole("textbox", { name: "Hvordan gikk det?" }),
      "Bra",
    );
    await user.click(screen.getByRole("button", { name: "Neste" }));

    const secondHeading = await screen.findByRole("heading", {
      name: "Fortell mer",
    });
    expect(secondHeading).toHaveFocus();
    expect(onStepChange).toHaveBeenLastCalledWith(1, 2);
  });

  it("skips authored pages that have no visible questions", async () => {
    const user = userEvent.setup();
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "decision",
          questions: [
            {
              id: "decision-question",
              type: "singleChoice",
              prompt: "Vil du utdype?",
              required: true,
              options: [
                { value: "yes", label: "Ja" },
                { value: "no", label: "Nei" },
              ],
            },
          ],
        },
        {
          id: "conditional",
          title: "Utdyping",
          questions: [
            {
              id: "conditional-comment",
              type: "text",
              prompt: "Fortell mer",
              visibleIf: {
                questionId: "decision-question",
                operator: "EQ",
                value: "yes",
              },
            },
          ],
        },
        {
          id: "final",
          title: "Til slutt",
          questions: [
            {
              id: "final-comment",
              type: "text",
              prompt: "Andre kommentarer?",
            },
          ],
        },
      ],
    };

    renderDock({ survey });
    await user.click(await screen.findByRole("radio", { name: "Nei" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));

    expect(
      await screen.findByRole("heading", { name: "Til slutt" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Utdyping" }),
    ).not.toBeInTheDocument();
  });

  it("flattens authored pages in single-page layout and keeps page headings", async () => {
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "first",
          title: "Første del",
          questions: [{ id: "q1", type: "text", prompt: "Spørsmål én" }],
        },
        {
          id: "second",
          title: "Andre del",
          description: "Felles kontekst.",
          questions: [{ id: "q2", type: "text", prompt: "Spørsmål to" }],
        },
      ],
    };

    renderDock({ survey, behavior: { questionLayout: "singlePage" } });

    expect(
      await screen.findByRole("heading", { name: "Første del" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Andre del" }).tagName).toBe(
      "H2",
    );
    expect(screen.getByText("Felles kontekst.")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Spørsmål én/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Spørsmål to/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Neste" }),
    ).not.toBeInTheDocument();
  });

  it("uses the first visible question as the header when a document page has no title", async () => {
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "untitled",
          questions: [
            {
              id: "hidden",
              type: "text",
              prompt: "Skjult spørsmål",
              visibleIf: {
                field: "METADATA",
                key: "showHidden",
                operator: "EQ",
                value: true,
              },
            },
            {
              id: "visible",
              type: "text",
              prompt: "Synlig spørsmål",
            },
          ],
        },
      ],
    };

    renderDock({ survey, behavior: { questionLayout: "singlePage" } });

    expect(
      await screen.findByRole("heading", { name: /Synlig spørsmål/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Skjult spørsmål" }),
    ).not.toBeInTheDocument();
  });

  it("clears page validation errors when the dock resets on close", async () => {
    const user = userEvent.setup();
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "required",
          questions: [
            { id: "first", type: "text", prompt: "Første", required: true },
            { id: "second", type: "text", prompt: "Andre", required: true },
          ],
        },
        {
          id: "last",
          questions: [{ id: "last", type: "text", prompt: "Siste" }],
        },
      ],
    };

    renderDock({ survey, behavior: { storageStrategy: "none" } });
    await user.click(await screen.findByRole("button", { name: "Neste" }));
    expect(
      screen.getByText(
        "Du må svare på disse spørsmålene før du kan fortsette:",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lukk" }));
    await user.click(screen.getByRole("button", { name: "Gi tilbakemelding" }));

    expect(
      screen.queryByText(
        "Du må svare på disse spørsmålene før du kan fortsette:",
      ),
    ).not.toBeInTheDocument();
  });

  it("does not render a document while every page is hidden", async () => {
    const onViewDock = vi.fn();
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "hidden",
          questions: [
            {
              id: "hidden-question",
              type: "text",
              prompt: "Skjult spørsmål",
              visibleIf: {
                field: "METADATA",
                key: "ready",
                operator: "EQ",
                value: true,
              },
            },
          ],
        },
      ],
    };

    renderDock({ survey, events: { onViewDock } });

    await waitFor(() => {
      expect(
        screen.queryByRole("complementary", {
          name: "Tilbakemeldingspanel",
        }),
      ).not.toBeInTheDocument();
    });
    expect(onViewDock).not.toHaveBeenCalled();
  });

  it("keeps page and rating descriptions visible and associated", async () => {
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "rating-page",
          description: "Dette gjelder besøket ditt.",
          questions: [
            {
              id: "rating",
              type: "rating",
              prompt: "Hvordan gikk det?",
              description: "Velg det alternativet som passer best.",
            },
          ],
        },
      ],
    };

    const { container } = renderDock({ survey });

    expect(
      await screen.findByText("Dette gjelder besøket ditt."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Velg det alternativet som passer best."),
    ).toBeInTheDocument();
    expect(container.querySelector("fieldset")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("rating-description"),
    );
    expect(container.querySelector("fieldset")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("dock-feedback-rating-dock-heading-description"),
    );
  });

  it("does not repeat a question description in a titled page header", async () => {
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "titled",
          title: "Om opplevelsen",
          questions: [
            {
              id: "comment",
              type: "text",
              prompt: "Fortell mer",
              description: "Du kan skrive kort.",
            },
          ],
        },
      ],
    };

    renderDock({ survey });

    expect(
      await screen.findByRole("heading", { name: "Om opplevelsen" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Du kan skrive kort.")).toHaveLength(1);
  });

  it("removes errors for questions hidden by a new answer without stealing focus", async () => {
    const user = userEvent.setup();
    const visibleWhenYes = {
      questionId: "controller",
      operator: "EQ" as const,
      value: "yes",
    };
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "conditional-fields",
          questions: [
            {
              id: "controller",
              type: "singleChoice",
              prompt: "Vil du utdype?",
              required: true,
              options: [
                { value: "yes", label: "Ja" },
                { value: "no", label: "Nei" },
              ],
            },
            {
              id: "detail-one",
              type: "text",
              prompt: "Detalj én",
              required: true,
              visibleIf: visibleWhenYes,
            },
            {
              id: "detail-two",
              type: "text",
              prompt: "Detalj to",
              required: true,
              visibleIf: visibleWhenYes,
            },
          ],
        },
        {
          id: "last",
          questions: [{ id: "last", type: "text", prompt: "Siste" }],
        },
      ],
    };

    renderDock({ survey });
    await user.click(await screen.findByRole("radio", { name: "Ja" }));
    await user.click(screen.getByRole("button", { name: "Neste" }));
    expect(
      screen.getByText(
        "Du må svare på disse spørsmålene før du kan fortsette:",
      ),
    ).toBeInTheDocument();

    const noOption = screen.getByRole("radio", { name: "Nei" });
    await user.click(noOption);

    expect(
      screen.queryByText(
        "Du må svare på disse spørsmålene før du kan fortsette:",
      ),
    ).not.toBeInTheDocument();
    expect(noOption).toHaveFocus();
  });

  it("keeps authored page metadata out of the flat submission contract", async () => {
    const user = userEvent.setup();
    const transport: LumiSurveyTransport = {
      submit: vi.fn().mockResolvedValue(undefined),
    };
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "page-identity-must-not-leak",
          title: "Tilbakemelding",
          description: "Denne teksten er bare presentasjon.",
          questions: [
            {
              id: "answer",
              type: "text",
              prompt: "Hva synes du?",
              required: true,
            },
            {
              id: "hidden-detail",
              type: "text",
              prompt: "Skjult detalj",
              visibleIf: {
                questionId: "answer",
                operator: "EQ",
                value: "vis",
              },
            },
          ],
        },
      ],
    };

    renderDock({ survey, transport });
    await user.type(
      await screen.findByRole("textbox", { name: "Hva synes du?" }),
      "bra",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(transport.submit).toHaveBeenCalledOnce());
    const submission = vi.mocked(transport.submit).mock.calls[0]?.[0];
    expect(submission?.answers).toEqual({ answer: "bra" });
    expect(
      submission?.transportPayload.definition.fields.map(
        (field) => field.fieldId,
      ),
    ).toEqual(["answer", "hidden-detail"]);
    expect(JSON.stringify(submission)).not.toContain(
      "page-identity-must-not-leak",
    );
    expect(JSON.stringify(submission)).not.toContain(
      "Denne teksten er bare presentasjon.",
    );
  });

  it("uses the same typography scale for every question on a single page", async () => {
    const survey: LumiSurveyConfig = {
      type: "custom",
      questions: [
        {
          id: "first",
          type: "text",
          prompt: "Første spørsmål",
          description: "Første beskrivelse",
          required: true,
        },
        {
          id: "second",
          type: "text",
          prompt: "Andre spørsmål",
          description: "Andre beskrivelse",
          required: true,
        },
      ],
    };

    renderDock({
      survey,
      behavior: { questionLayout: "singlePage" },
    });

    const firstPrompt = await screen.findByRole("heading", {
      name: "Første spørsmål",
    });
    const secondPrompt = screen.getByText("Andre spørsmål");
    const firstDescription = screen.getByText("Første beskrivelse", {
      selector: "p",
    });
    const secondDescription = screen.getByText("Andre beskrivelse");

    // Aksel Heading xsmall and Label medium both use the 18/24 scale.
    expect(firstPrompt).toHaveClass("aksel-heading--xsmall");
    expect(secondPrompt).toHaveClass("aksel-label");
    expect(firstDescription).toHaveClass("aksel-body-short--medium");
    expect(secondDescription).toHaveClass("aksel-body-short--medium");
  });

  it("keeps compact header typography when questions are shown one at a time", async () => {
    const survey: LumiSurveyConfig = {
      type: "custom",
      questions: [
        {
          id: "first-step",
          type: "text",
          prompt: "Første steg",
          description: "Kompakt beskrivelse",
          required: true,
        },
        {
          id: "second-step",
          type: "text",
          prompt: "Andre steg",
          required: true,
        },
      ],
    };

    renderDock({
      survey,
      behavior: { questionLayout: "steps" },
    });

    const prompt = await screen.findByRole("heading", {
      name: "Første steg",
    });
    const description = screen.getByText("Kompakt beskrivelse", {
      selector: "p",
    });

    expect(prompt).toHaveClass("aksel-heading--small");
    expect(description).toHaveClass("aksel-body-short--small");
  });

  it("does not show personal data notice when branching submits before any text question", async () => {
    const user = userEvent.setup();
    const transport: LumiSurveyTransport = {
      submit: vi.fn().mockResolvedValue(undefined),
    };

    const branchingSurvey: LumiSurveyConfig = {
      type: "custom",
      questions: [
        {
          id: "decision",
          type: "singleChoice",
          prompt: "Vil du legge igjen en kommentar?",
          required: true,
          options: [
            { value: "yes", label: "Ja" },
            { value: "no", label: "Nei" },
          ],
          logic: [
            {
              condition: { field: "ANSWER", operator: "EQ", value: "yes" },
              action: { type: "SUBMIT" },
            },
            {
              condition: { field: "ANSWER", operator: "EQ", value: "no" },
              action: { type: "JUMP_TO", targetId: "feedback" },
            },
          ],
        },
        {
          id: "feedback",
          type: "text",
          prompt: "Kommentar",
          required: false,
        },
      ],
    };

    renderDock({ survey: branchingSurvey, transport });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /ja/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /ja/i }));
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      screen.queryByText(/ikke skriv inn navn eller andre personopplysninger/i),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(transport.submit).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByRole("heading", { name: /takk for tilbakemeldingen/i }),
    ).toBeInTheDocument();
  });

  it("shows personal data notice when branching leads to a text question", async () => {
    const user = userEvent.setup();

    const branchingSurvey: LumiSurveyConfig = {
      type: "custom",
      questions: [
        {
          id: "decision",
          type: "singleChoice",
          prompt: "Vil du legge igjen en kommentar?",
          required: true,
          options: [
            { value: "yes", label: "Ja" },
            { value: "no", label: "Nei" },
          ],
          logic: [
            {
              condition: { field: "ANSWER", operator: "EQ", value: "yes" },
              action: { type: "SUBMIT" },
            },
            {
              condition: { field: "ANSWER", operator: "EQ", value: "no" },
              action: { type: "JUMP_TO", targetId: "feedback" },
            },
          ],
        },
        {
          id: "feedback",
          type: "text",
          prompt: "Kommentar",
          required: false,
        },
      ],
    };

    renderDock({ survey: branchingSurvey });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /nei/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /nei/i }));
    await user.click(screen.getByRole("button", { name: /neste/i }));

    expect(
      screen.getByRole("textbox", { name: /kommentar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ikke skriv inn navn eller andre personopplysninger/i),
    ).toBeInTheDocument();
  });

  it("gates follow-up questions until the rating is answered", async () => {
    const user = userEvent.setup();
    renderDock();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    expect(
      screen.queryByLabelText(/hva kan vi forbedre/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/andre kommentarer/i),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText(/ikke skriv inn navn eller andre personopplysninger/i),
    ).not.toBeInTheDocument();

    const blockedButton = screen.getByRole("button", { name: /send/i });
    expect(blockedButton).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /5\./i }));

    expect(screen.getByLabelText(/hva kan vi forbedre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/andre kommentarer/i)).toBeInTheDocument();

    expect(
      screen.getByText(/ikke skriv inn navn eller andre personopplysninger/i),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
  });

  it("submits answers via the transport and shows success state", async () => {
    const transportSubmit = vi.fn().mockResolvedValue(undefined);
    renderDock({ transport: { submit: transportSubmit } });

    const user = userEvent.setup();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /5\./i }));
    await user.type(screen.getByLabelText(/hva kan vi forbedre/i), "Alt bra");

    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    expect(transportSubmit).toHaveBeenCalledTimes(1);
    expect(transportSubmit.mock.calls[0][0].surveyId).toBe("dock-feedback");

    await screen.findByRole("heading", { name: /takk for tilbakemeldingen/i });
    expect(
      screen.getAllByRole("button", { name: /lukk/i }).length,
    ).toBeGreaterThan(0);
  });

  it("submits from taskSuccess when the blocker becomes hidden (top tasks)", async () => {
    const transportSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const survey = createTopTasksSurvey({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
    });

    renderDock({ survey, transport: { submit: transportSubmit } });

    // Step 1: task
    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: /oppgave 1/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /oppgave 1/i }));
    await user.click(screen.getByRole("button", { name: /neste/i }));

    // Step 2: taskSuccess
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /^ja$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /^ja$/i }));
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(transportSubmit).toHaveBeenCalledTimes(1);
    });

    await screen.findByRole("heading", { name: /takk for tilbakemeldingen/i });
  });

  it("skips otherTask through visibleIf while keeping top tasks in auto step mode", async () => {
    const user = userEvent.setup();
    const survey = createTopTasksSurvey({
      tasks: [{ value: "t1", label: "Oppgave 1" }],
      includeOtherTask: true,
      includeBlockerQuestion: false,
    });

    renderDock({ survey });

    await user.click(await screen.findByRole("radio", { name: /oppgave 1/i }));
    await user.click(screen.getByRole("button", { name: /neste/i }));

    expect(
      screen.queryByRole("textbox", { name: /beskriv hva du prøvde/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^ja$/i })).toBeInTheDocument();
  });

  it("uses auto-collected context in METADATA visibility conditions", async () => {
    const survey: LumiSurveyConfig = {
      type: "custom",
      questions: [
        {
          id: "rating",
          type: "rating",
          prompt: "Hvor fornøyd er du?",
          required: true,
        },
        {
          id: "desktop-feedback",
          type: "text",
          prompt: "Tilbakemelding fra desktop",
          required: false,
          visibleIf: {
            field: "METADATA",
            key: "deviceType",
            operator: "EQ",
            value: "desktop",
          },
        },
      ],
    };

    renderDock({ survey });

    expect(
      await screen.findByRole("textbox", {
        name: /tilbakemelding fra desktop/i,
      }),
    ).toBeInTheDocument();
  });

  it("supports step layout without branching when questionLayout is steps", async () => {
    const user = userEvent.setup();
    renderDock({ behavior: { questionLayout: "steps" } });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /5\./i })).toBeInTheDocument();
    });

    // In step layout we should see Next immediately (submit is only on last step).
    expect(screen.getByRole("button", { name: /neste/i })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /5\./i }));
    await user.click(screen.getByRole("button", { name: /neste/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: /hva kan vi forbedre/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /tilbake/i }),
    ).toBeInTheDocument();
  });

  it("shows progress from the first question when explicitly enabled", async () => {
    const user = userEvent.setup();
    renderDock({
      behavior: { questionLayout: "steps", showProgress: true },
    });

    const progressBar = await screen.findByRole("progressbar", {
      name: "Fremdrift i undersøkelsen",
    });

    expect(progressBar).toHaveAttribute("aria-valuenow", "1");
    expect(progressBar).toHaveAttribute("aria-valuemax", "3");
    expect(progressBar).toHaveAttribute("aria-valuetext", "Steg 1 av 3");

    await user.click(screen.getByRole("radio", { name: /5\./i }));
    await user.click(screen.getByRole("button", { name: /neste/i }));
    expect(progressBar).toHaveAttribute("aria-valuetext", "Steg 2 av 3");

    await user.click(screen.getByRole("button", { name: /tilbake/i }));
    expect(progressBar).toHaveAttribute("aria-valuetext", "Steg 1 av 3");
  });

  it("shows first-question progress after intro without counting intro as a step", async () => {
    const user = userEvent.setup();
    render(
      <LumiSurveyDock
        surveyId="dock-progress-with-intro"
        survey={createSurvey()}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
        behavior={{ questionLayout: "steps", showProgress: true }}
        intro={{ title: "Velkommen", body: "Kort intro" }}
      />,
    );

    await screen.findByRole("heading", { name: "Velkommen" });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /start/i }));

    expect(
      await screen.findByRole("progressbar", {
        name: "Fremdrift i undersøkelsen",
      }),
    ).toBeInTheDocument();
  });

  it("displays validation errors when required questions are missing", async () => {
    const user = userEvent.setup();
    const events: LumiSurveyEvents = {
      onValidationFailed: vi.fn(),
    };
    const transport: LumiSurveyTransport = {
      submit: vi.fn().mockResolvedValue(undefined),
    };

    renderDock({ events, transport });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole("radio", { name: /4\./i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /4\./i }));

    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    expect(transport.submit).not.toHaveBeenCalled();
    expect(events.onValidationFailed).toHaveBeenCalledWith(
      expect.arrayContaining(["feedback"]),
    );
    expect(screen.getByLabelText(/hva kan vi forbedre/i)).toHaveFocus();
  });

  it("calls onViewDock when the dock mounts", () => {
    const events: LumiSurveyEvents = {
      onViewDock: vi.fn(),
    };

    renderDock({ events });

    expect(events.onViewDock).toHaveBeenCalledWith("dock-feedback");
  });

  it("renders the minimized button when initialOpen is false", async () => {
    renderDock({ initialOpen: false });

    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /gi tilbakemelding/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("region", { name: /gi tilbakemelding/i }),
    ).not.toBeInTheDocument();
  });

  it("persists dismissal state and triggers reset when closing", async () => {
    const events: LumiSurveyEvents = {
      onReset: vi.fn(),
      onDismissalPersistFailed: vi.fn(),
    };

    const user = userEvent.setup();
    const { unmount } = renderDock({ events });

    // Wait for loading to complete
    await waitFor(() => {
      const initialContainer = document.querySelector(
        '[data-feedback-id="dock-feedback"]',
      ) as HTMLElement;
      expect(initialContainer?.getAttribute("data-state")).toBe("open");
    });

    const closeButton = screen.getByRole("button", { name: /avbryt|lukk/i });
    await act(async () => {
      await user.click(closeButton);
    });

    expect(events.onReset).toHaveBeenCalledTimes(1);

    // With consent storage, the dismissal persists
    await waitFor(() => {
      const nextContainer = document.querySelector(
        '[data-feedback-id="dock-feedback"]',
      ) as HTMLElement | null;

      expect(nextContainer?.getAttribute("data-state")).toBe("dismissed");
    });

    // onDismissalPersistFailed should NOT be called when storage works correctly
    expect(events.onDismissalPersistFailed).not.toHaveBeenCalled();

    unmount();
    // Clear localStorage before remount to test fresh state
    localStorage.clear();

    // When remounting with cleared storage, dock respects initialOpen (true by default)
    renderDock();

    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /hvor fornøyd er du/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows transport error message when submission fails", async () => {
    const transportSubmit = vi.fn().mockRejectedValue(new Error("network"));
    renderDock({ transport: { submit: transportSubmit } });

    const user = userEvent.setup();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole("radio", { name: /4\./i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /4\./i }));
    await user.type(screen.getByLabelText(/hva kan vi forbedre/i), "Alt bra");

    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    const errorAlert = await screen.findByText(
      /kunne ikke sende tilbakemeldingen/i,
    );
    expect(errorAlert.closest('[role="alert"]')).toHaveTextContent(
      /kunne ikke sende tilbakemeldingen/i,
    );
  });
});
