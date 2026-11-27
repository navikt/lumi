import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode, useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyEvents,
  LumiSurveySubmission,
  LumiSurveyTransport,
} from "../../../core/types.js";
import { CLASS_NAMES } from "../../LumiSurveyDock/classNames.js";
import { LumiSurveyDock } from "../../LumiSurveyDock/LumiSurveyDock.js";
import type { SurveyDocumentV1 } from "../../surveyTypes.js";
import {
  LumiSurveyInline,
  type LumiSurveyInlineProps,
} from "../LumiSurveyInline.js";
import {
  installFakeIntersectionObserver,
  observedElements,
  placeObserved,
  placeObservedBelowTheFold,
} from "./fakeIntersectionObserver.js";

const SURVEY_ID = "kalkulator-tilbakemelding";

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
  pages: [
    {
      id: "besok",
      title: "Om besøket",
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
      ],
    },
    {
      id: "mer",
      title: "Fortell mer",
      questions: [
        {
          id: "kommentar",
          type: "text",
          prompt: "Hva kan vi forbedre?",
        },
      ],
    },
  ],
};

const everyFieldSurvey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "alt",
      title: "Alle felttypene",
      questions: [
        {
          id: "fritekst",
          type: "text",
          prompt: "Fritekst",
          description: "Skriv kort.",
        },
        {
          id: "enkeltvalg",
          type: "singleChoice",
          prompt: "Enkeltvalg",
          description: "Velg ett.",
          options: [
            { value: "a", label: "Alfa" },
            { value: "b", label: "Bravo" },
          ],
        },
        {
          id: "flervalg",
          type: "multiChoice",
          prompt: "Flervalg",
          options: [
            { value: "x", label: "Xray" },
            { value: "y", label: "Yankee" },
          ],
        },
        {
          id: "sokbart",
          type: "multiChoice",
          variant: "combobox",
          prompt: "Søkbart flervalg",
          options: [
            { value: "soknad", label: "Sende søknad" },
            { value: "status", label: "Sjekke status" },
          ],
        },
        {
          id: "ansikter",
          type: "rating",
          variant: "emoji",
          prompt: "Ansikter",
          description: "Fra dårlig til bra.",
        },
        {
          id: "skala",
          type: "rating",
          variant: "nps",
          prompt: "Skala fra 0 til 10",
        },
      ],
    },
  ],
};

const createTransport = () => {
  const submit = vi.fn<LumiSurveyTransport["submit"]>(async () => undefined);
  return { transport: { submit } satisfies LumiSurveyTransport, submit };
};

/**
 * Lets React finish: the update that follows a settled submit, and the
 * effects after it. A focus assertion made before the effects have run
 * would pass or fail by chance.
 */
const reactSettled = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** A transport that waits for the test to let the submit succeed or fail. */
const pendingTransport = () => {
  let settle: { resolve: () => void; reject: (cause: unknown) => void };
  const submit = vi.fn<LumiSurveyTransport["submit"]>(
    () =>
      new Promise<void>((resolve, reject) => {
        settle = { resolve, reject };
      }),
  );
  return {
    transport: { submit } satisfies LumiSurveyTransport,
    /** The submit succeeds, and the receipt and its focus are in place. */
    succeed: async () => {
      settle.resolve();
      await reactSettled();
    },
    /** The submit fails, and the error and its focus are in place. */
    fail: async () => {
      settle.reject(new Error("nettverk"));
      await reactSettled();
    },
  };
};

const renderInline = (props: Partial<LumiSurveyInlineProps> = {}) => {
  const { transport, submit } = createTransport();
  const result = render(
    <LumiSurveyInline
      surveyId={SURVEY_ID}
      survey={survey}
      transport={transport}
      {...props}
    />,
  );
  return { ...result, submit };
};

const inlineRoot = (): HTMLElement => {
  const root = document.querySelector<HTMLElement>(
    `.${CLASS_NAMES.inlineContainer}`,
  );
  if (!root) throw new Error("The inline survey is not rendered");
  return root;
};

/** A box 600 pixels wide, from `top` to `bottom` on screen. */
const boxAt = (top: number, bottom: number): DOMRect =>
  ({
    top,
    bottom,
    left: 100,
    right: 700,
    width: 600,
    height: bottom - top,
    x: 100,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** The panel of a survey: what is measured to tell whether it is seen. */
const panelOf = (root: Element = inlineRoot()): HTMLElement => {
  const panel = root.querySelector<HTMLElement>(`.${CLASS_NAMES.panel}`);
  if (!panel) throw new Error("The inline survey has no panel");
  return panel;
};

const allIds = (): string[] =>
  [...document.querySelectorAll("[id]")].map((element) => element.id);

const denySurveyConsent = () => {
  const controller = (
    globalThis as unknown as {
      webStorageController: {
        getCurrentConsent: () => {
          consent: { analytics: boolean; surveys: boolean };
          userActionTaken: boolean;
        };
      };
    }
  ).webStorageController;
  vi.spyOn(controller, "getCurrentConsent").mockReturnValue({
    consent: { analytics: true, surveys: false },
    userActionTaken: true,
  });
};

describe("LumiSurveyInline", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("placement", () => {
    it("renders the survey at once, as a part of the page", () => {
      renderInline();

      const root = inlineRoot();
      expect(root.tagName).toBe("SECTION");
      expect(root).toHaveAttribute("data-feedback-id", SURVEY_ID);
      expect(
        screen.getByRole("heading", {
          name: "Hvor lett var det å bruke kalkulatoren?",
        }),
      ).toBeInTheDocument();
      // The container decides the width; nothing is fixed to the viewport.
      expect(root.style.position).toBe("");
      expect(root.style.width).toBe("");
      expect(root.style.zIndex).toBe("");
    });

    it("has no floating frame: no landmark, shadow, scroll area or close button", () => {
      renderInline();

      const root = inlineRoot();
      const panel = root.querySelector<HTMLElement>(`.${CLASS_NAMES.panel}`);
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(panel?.getAttribute("style")).not.toContain("shadow");
      expect(panel?.style.maxHeight).toBe("");
      expect(panel?.style.overflowY).toBe("");
      expect(
        screen.queryByRole("button", { name: "Lukk" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Gi tilbakemelding" }),
      ).not.toBeInTheDocument();
    });

    it("does not move focus when it is shown", () => {
      render(
        <>
          <button type="button">Appens knapp</button>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={createTransport().transport}
          />
        </>,
      );

      expect(inlineRoot()).toBeInTheDocument();
      expect(document.body).toHaveFocus();
    });

    it("passes the app's class names and Aksel tokens to the container and the panel", () => {
      renderInline({
        style: {
          containerClassName: "min-beholder",
          panelClassName: "mitt-panel",
          panelBackground: "neutral-soft",
        },
      });

      const root = inlineRoot();
      const panel = root.querySelector<HTMLElement>(`.${CLASS_NAMES.panel}`);
      expect(root).toHaveClass(CLASS_NAMES.inlineContainer, "min-beholder");
      expect(panel).toHaveClass("mitt-panel");
      expect(panel?.getAttribute("style")).toContain("neutral-soft");
    });
  });

  describe("storage and consent", () => {
    it("is shown to users who have not consented to surveys", () => {
      denySurveyConsent();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      renderInline();

      expect(inlineRoot()).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it("is shown although the dock with the same surveyId has been dismissed", () => {
      localStorage.setItem(
        `lumi-dismissed-${SURVEY_ID}`,
        JSON.stringify({
          version: 1,
          state: "dismissed",
          dismissedAt: new Date().toISOString(),
          resumeAt: null,
          hideCompletely: true,
        }),
      );

      renderInline();

      expect(inlineRoot()).toBeInTheDocument();
    });

    it("stores nothing in the browser, also after an answer is sent", async () => {
      const user = userEvent.setup();
      const onDismissalPersistFailed = vi.fn();
      const setItem = vi.spyOn(localStorage, "setItem");
      const setSessionItem = vi.spyOn(Storage.prototype, "setItem");
      const { submit } = renderInline({ events: { onDismissalPersistFailed } });

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(submit).toHaveBeenCalledTimes(1);
      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
      expect(setSessionItem).not.toHaveBeenCalled();
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).toBe("");
      expect(onDismissalPersistFailed).not.toHaveBeenCalled();
    });
  });

  describe("answering", () => {
    it("reveals follow-up questions and sends the answers", async () => {
      const user = userEvent.setup();
      const { submit } = renderInline({
        context: { tags: { surface: "inline", placement: "under-kalkulator" } },
      });

      expect(
        screen.queryByRole("textbox", { name: /Hva kunne vært bedre\?/ }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("radio", { name: /4\./ }));
      await user.type(
        screen.getByRole("textbox", { name: /Hva kunne vært bedre\?/ }),
        "Forklar tallene",
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      const submission = submit.mock.calls[0][0];
      expect(submission.surveyId).toBe(SURVEY_ID);
      expect(submission.answers).toEqual({
        rating: 4,
        begrunnelse: "Forklar tallene",
      });
      expect(submission.transportPayload.context?.tags).toEqual({
        surface: "inline",
        placement: "under-kalkulator",
      });
    });

    it("sends the same payload as the dock for the same answers", async () => {
      const user = userEvent.setup();
      const inline = createTransport();
      const dock = createTransport();
      render(
        <>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={inline.transport}
          />
          <LumiSurveyDock
            surveyId={SURVEY_ID}
            survey={survey}
            transport={dock.transport}
            behavior={{ storageStrategy: "none" }}
          />
        </>,
      );

      const dockElement = await screen.findByRole("complementary");
      for (const scope of [inlineRoot(), dockElement]) {
        await user.click(within(scope).getByRole("radio", { name: /2\./ }));
        await user.type(within(scope).getByRole("textbox"), "For mange felt");
        await user.click(within(scope).getByRole("button", { name: "Send" }));
      }

      await waitFor(() => expect(dock.submit).toHaveBeenCalledTimes(1));
      expect(inline.submit).toHaveBeenCalledTimes(1);
      // Timestamps and the deduplication key differ per submission.
      const comparable = ({ transportPayload }: LumiSurveySubmission) => {
        const {
          deduplicationKey: _deduplicationKey,
          startedAt: _startedAt,
          submittedAt: _submittedAt,
          timeToCompleteMs: _timeToCompleteMs,
          ...rest
        } = transportPayload;
        return rest;
      };
      expect(comparable(inline.submit.mock.calls[0][0])).toEqual(
        comparable(dock.submit.mock.calls[0][0]),
      );
      expect(inline.submit.mock.calls[0][0].transportPayload).toMatchObject({
        schemaVersion: 2,
        surveyId: SURVEY_ID,
        surveyType: "rating",
      });
    });

    it("keeps the receipt where the survey was, without a button", async () => {
      const user = userEvent.setup();
      const { rerender, submit } = renderInline({
        success: { title: "Takk for svaret", body: "Vi leser alt." },
      });
      const root = inlineRoot();

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      const receipt = await screen.findByRole("heading", {
        name: "Takk for svaret",
      });
      expect(root).toContainElement(receipt);
      expect(within(root).getByText("Vi leser alt.")).toBeInTheDocument();
      expect(within(root).queryByRole("button")).not.toBeInTheDocument();
      expect(within(root).queryByRole("radio")).not.toBeInTheDocument();

      // The receipt stays through later renders of the page.
      rerender(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={{ submit }}
          success={{ title: "Takk for svaret", body: "Vi leser alt." }}
        />,
      );
      expect(
        screen.getByRole("heading", { name: "Takk for svaret" }),
      ).toBeInTheDocument();
    });

    it("shows only the title when the receipt has no body", async () => {
      const user = userEvent.setup();
      renderInline();

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      const panel = inlineRoot().querySelector(`.${CLASS_NAMES.panel}`);
      expect(panel?.textContent).toBe(receipt.textContent);
    });

    it("uses the receipt and the intro from the survey document", async () => {
      const user = userEvent.setup();
      renderInline({
        survey: {
          ...survey,
          intro: { title: "Hjelp oss å forbedre kalkulatoren" },
          success: { title: "Svaret er sendt" },
        },
      });

      expect(
        screen.getByRole("heading", {
          name: "Hjelp oss å forbedre kalkulatoren",
        }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Start" }));
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(
        await screen.findByRole("heading", { name: "Svaret er sendt" }),
      ).toBeInTheDocument();
    });

    it("shows the error and keeps the answers when sending fails", async () => {
      const user = userEvent.setup();
      const submit = vi
        .fn<LumiSurveyTransport["submit"]>()
        .mockRejectedValue(new Error("nettverk"));
      const onSubmitError = vi.fn();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={{ submit }}
          events={{ onSubmitError }}
        />,
      );

      await user.click(screen.getByRole("radio", { name: /3\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Kunne ikke sende tilbakemeldingen. Prøv igjen senere.",
      );
      expect(onSubmitError).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("radio", { name: /3\./ })).toBeChecked();
      expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    });

    it("renders nothing and logs an error without a usable transport", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={{ endpoint: "api/uten-skraastrek" }}
        />,
      );

      expect(
        document.querySelector(`.${CLASS_NAMES.inlineContainer}`),
      ).toBeNull();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain("[Lumi]");
    });

    it("renders nothing when no question in the document is visible", () => {
      renderInline({
        survey: {
          authoringSchemaVersion: 1,
          pages: [
            {
              id: "skjult",
              questions: [
                {
                  id: "kun-mobil",
                  type: "text",
                  prompt: "Vises bare med en tag",
                  visibleIf: {
                    field: "METADATA",
                    key: "variant",
                    operator: "EQ",
                    value: "B",
                  },
                },
              ],
            },
          ],
        },
        context: { tags: { variant: "A" } },
      });

      expect(
        document.querySelector(`.${CLASS_NAMES.inlineContainer}`),
      ).toBeNull();
    });

    it("shows no intro when the document has no question for this user", () => {
      const onViewDock = vi.fn();
      // The start button would lead to nothing, and the survey would vanish
      // with focus in it.
      renderInline({
        survey: {
          authoringSchemaVersion: 1,
          intro: { title: "Hjelp oss å bli bedre", body: "Tre spørsmål." },
          pages: [
            {
              id: "mobil",
              questions: [
                {
                  id: "kun-mobil",
                  type: "text",
                  prompt: "Hvordan var det på mobil?",
                  visibleIf: {
                    field: "METADATA",
                    key: "deviceType",
                    operator: "EQ",
                    value: "mobile",
                  },
                },
              ],
            },
          ],
        },
        events: { onViewDock },
      });

      expect(
        document.querySelector(`.${CLASS_NAMES.inlineContainer}`),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
      expect(onViewDock).not.toHaveBeenCalled();
    });
  });

  describe("focus and keyboard", () => {
    it("can be answered with the keyboard alone, and ends with focus on the receipt", async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Appens knapp</button>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={createTransport().transport}
          />
        </>,
      );

      await user.tab();
      expect(
        screen.getByRole("button", { name: "Appens knapp" }),
      ).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("radio", { name: /1\./ })).toHaveFocus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(screen.getByRole("radio", { name: /3\./ })).toBeChecked();
      await user.tab();
      expect(
        screen.getByRole("textbox", { name: /Hva kunne vært bedre\?/ }),
      ).toHaveFocus();
      await user.keyboard("Litt tregt");
      await user.tab();
      expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
      await user.keyboard("{Enter}");

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      await waitFor(() => expect(receipt).toHaveFocus());
    });

    it("leaves focus in the page when the user has moved on before the receipt", async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      const submit = vi.fn<LumiSurveyTransport["submit"]>(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      render(
        <>
          <button type="button">Appens knapp</button>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={{ submit }}
          />
        </>,
      );

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      const appButton = screen.getByRole("button", { name: "Appens knapp" });
      await user.click(appButton);
      finish();
      await reactSettled();

      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(appButton).toHaveFocus();
    });

    it("leaves focus alone when it left the survey and then left the page's controls too", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <>
          <button type="button">Appens knapp</button>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />
        </>,
      );

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      // The browser drops focus from the disabled send button to <body>
      // without telling the survey where focus goes next.
      act(() => send.blur());
      expect(document.body).toHaveFocus();
      // Focus then goes to the app, and from there to nothing at all.
      const appButton = screen.getByRole("button", { name: "Appens knapp" });
      act(() => appButton.focus());
      act(() => appButton.blur());
      expect(document.body).toHaveFocus();
      await pending.succeed();

      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(document.body).toHaveFocus();
    });

    it("moves focus to the receipt when the browser dropped it from the disabled send button", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      // Chromium and WebKit move focus to <body> when the focused button is
      // disabled. jsdom keeps it, so the test drops it by hand.
      act(() => send.blur());
      expect(document.body).toHaveFocus();
      await pending.succeed();

      expect(
        await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        }),
      ).toHaveFocus();
    });

    it("scrolls to the receipt when the survey is on screen, and leaves the page where it is when the user has scrolled away", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      // The arguments of the latest focus() call on the receipt heading.
      const receiptFocusOptions = () =>
        focus.mock.calls[
          focus.mock.contexts
            .map((element) => (element as HTMLElement).textContent)
            .lastIndexOf("Takk for tilbakemeldingen!")
        ];

      // On screen: an ordinary focus, which scrolls the receipt into view.
      const first = pendingTransport();
      const { unmount } = render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={first.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      await first.succeed();
      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receiptFocusOptions()).toEqual([undefined]);
      unmount();

      // Scrolled away while the answer was on its way: no scrolling back.
      const second = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={second.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());
      placeObservedBelowTheFold();
      await second.succeed();
      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receipt).toHaveFocus();
      expect(receiptFocusOptions()).toEqual([{ preventScroll: true }]);
    });

    it("returns focus to the send button when sending fails and the browser dropped focus", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );

      await user.click(screen.getByRole("radio", { name: /3\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());
      expect(document.body).toHaveFocus();
      await pending.fail();

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
    });

    it("returns focus to the send button on the last page too", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={pagedSurvey}
          transport={pending.transport}
          behavior={{ initialPageId: "mer" }}
        />,
      );

      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());
      await pending.fail();

      await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
    });

    it("does not take focus back when sending fails after the user has moved on", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <>
          <button type="button">Appens knapp</button>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />
        </>,
      );

      await user.click(screen.getByRole("radio", { name: /3\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      const appButton = screen.getByRole("button", { name: "Appens knapp" });
      await user.click(appButton);
      await pending.fail();

      await screen.findByRole("alert");
      expect(appButton).toHaveFocus();
    });

    it("moves focus to the heading of the next page and back again", async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      renderInline({
        survey: pagedSurvey,
        events: { onStepChange },
        behavior: { showProgress: true },
      });

      expect(screen.getByText("Steg 1 av 2")).toBeInTheDocument();
      await user.type(
        screen.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
        "Sjekke utbetalingen",
      );
      await user.click(screen.getByRole("radio", { name: "Ja" }));
      await user.click(screen.getByRole("button", { name: "Neste" }));

      const nextHeading = await screen.findByRole("heading", {
        name: "Fortell mer",
      });
      expect(nextHeading).toHaveFocus();
      expect(inlineRoot()).toContainElement(nextHeading);
      expect(onStepChange).toHaveBeenLastCalledWith(1, 2);

      await user.click(screen.getByRole("button", { name: "Tilbake" }));
      expect(
        await screen.findByRole("heading", { name: "Om besøket" }),
      ).toHaveFocus();
      expect(
        screen.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
      ).toHaveValue("Sjekke utbetalingen");
    });

    it("keeps focus in the survey when a portal shows it in an iframe", async () => {
      // The script runs in the app's document, and the survey is rendered
      // in the document of the iframe.
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = frame.contentDocument as Document;
      const user = userEvent.setup({ document: frameDocument });
      const inFrame = within(frameDocument.body);
      try {
        render(
          createPortal(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={pagedSurvey}
              transport={createTransport().transport}
            />,
            frameDocument.body,
          ),
        );

        // One answer is missing: focus goes to the field in the iframe.
        await user.type(
          inFrame.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
          "Sjekke utbetalingen",
        );
        await user.click(inFrame.getByRole("button", { name: "Neste" }));
        expect(frameDocument.activeElement).toBe(
          inFrame.getByRole("radio", { name: "Ja" }),
        );

        await user.click(inFrame.getByRole("radio", { name: "Ja" }));
        await user.click(inFrame.getByRole("button", { name: "Neste" }));
        const nextHeading = await inFrame.findByRole("heading", {
          name: "Fortell mer",
        });
        expect(frameDocument.activeElement).toBe(nextHeading);

        await user.click(inFrame.getByRole("button", { name: "Send" }));
        const receipt = await inFrame.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        expect(frameDocument.activeElement).toBe(receipt);
      } finally {
        cleanup();
        frame.remove();
      }
    });

    it.each([
      ["succeeds", "Takk for tilbakemeldingen!"],
      ["fails", "Send"],
    ] as const)(
      "leaves focus on the page around an iframe when the user went there while the answer was sent and sending %s",
      async (outcome, inSurvey) => {
        const outside = document.createElement("button");
        outside.textContent = "Knapp på siden";
        document.body.append(outside);
        const frame = document.createElement("iframe");
        document.body.append(frame);
        const frameDocument = frame.contentDocument as Document;
        const user = userEvent.setup({ document: frameDocument });
        const inFrame = within(frameDocument.body);
        const pending = pendingTransport();
        try {
          render(
            createPortal(
              <LumiSurveyInline
                surveyId={SURVEY_ID}
                survey={survey}
                transport={pending.transport}
              />,
              frameDocument.body,
            ),
          );
          await user.click(inFrame.getByRole("radio", { name: /5\./ }));
          await user.click(inFrame.getByRole("button", { name: "Send" }));
          // The iframe's document hears nothing when focus goes to the page.
          outside.focus();
          expect(frameDocument.hasFocus()).toBe(false);
          await (outcome === "succeeds" ? pending.succeed() : pending.fail());

          // The receipt or the button that the survey would have focused.
          const target =
            outcome === "succeeds"
              ? await inFrame.findByRole("heading", { name: inSurvey })
              : inFrame.getByRole("button", { name: inSurvey });
          expect(target).toBeInTheDocument();
          expect(document.activeElement).toBe(outside);
          expect(frameDocument.activeElement).not.toBe(target);
        } finally {
          cleanup();
          frame.remove();
          outside.remove();
        }
      },
    );

    it("leaves focus alone when it went to an element of the iframe's own window, and that element is gone", async () => {
      // The survey is in a closed shadow tree in the iframe. Focus moves from
      // the survey to a button beside it in the same tree, so the iframe's
      // document hears no focusin. Only the blur tells the survey, and the
      // button belongs to the iframe's window.
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = frame.contentDocument as Document;
      const host = frameDocument.createElement("div");
      frameDocument.body.append(host);
      const shadow = host.attachShadow({ mode: "closed" });
      const mount = frameDocument.createElement("div");
      const beside = frameDocument.createElement("button");
      beside.textContent = "Knapp ved surveyen";
      shadow.append(mount, beside);
      const user = userEvent.setup({ document: frameDocument });
      const inShadow = within(mount);
      const pending = pendingTransport();
      try {
        render(
          createPortal(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />,
            mount,
          ),
        );
        await user.click(inShadow.getByRole("radio", { name: /5\./ }));
        await user.click(inShadow.getByRole("button", { name: "Send" }));
        act(() => inShadow.getByRole("radio", { name: /5\./ }).focus());
        act(() => beside.focus());
        expect(shadow.activeElement).toBe(beside);
        act(() => beside.remove());
        await pending.succeed();

        const receipt = await inShadow.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        expect(shadow.activeElement).not.toBe(receipt);
      } finally {
        cleanup();
        frame.remove();
      }
    });

    it("leaves focus alone when a dialog on the page stops the focus event, and the dialog is gone", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      const inDialog = document.createElement("button");
      inDialog.textContent = "Knapp i dialogen";
      dialog.append(inDialog);
      // Some dialog libraries keep focus events to themselves.
      dialog.addEventListener("focusin", (event) => event.stopPropagation());
      try {
        render(
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />,
        );
        await user.click(screen.getByRole("radio", { name: /5\./ }));
        const send = screen.getByRole("button", { name: "Send" });
        await user.click(send);
        // The browser drops focus from the disabled button.
        act(() => send.blur());
        document.body.append(dialog);
        act(() => inDialog.focus());
        act(() => dialog.remove());
        expect(document.body).toHaveFocus();
        await pending.succeed();

        const receipt = await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        expect(receipt).not.toHaveFocus();
        expect(document.body).toHaveFocus();
      } finally {
        dialog.remove();
      }
    });

    it("keeps focus in the survey when it is rendered in a shadow tree", async () => {
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode: "open" });
      const mount = document.createElement("div");
      shadow.append(mount);
      const inShadow = within(mount);
      try {
        render(
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={pagedSurvey}
            transport={createTransport().transport}
          />,
          { container: mount },
        );

        // user-event types where the document says focus is, which in a
        // shadow tree is the host. The events are sent to the fields.
        const next = inShadow.getByRole("button", { name: "Neste" });
        next.focus();
        fireEvent.change(
          inShadow.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
          { target: { value: "Sjekke utbetalingen" } },
        );
        fireEvent.click(inShadow.getByRole("radio", { name: "Ja" }));
        fireEvent.click(next);
        const nextHeading = await inShadow.findByRole("heading", {
          name: "Fortell mer",
        });
        expect(shadow.activeElement).toBe(nextHeading);

        const send = inShadow.getByRole("button", { name: "Send" });
        send.focus();
        fireEvent.click(send);
        const receipt = await inShadow.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        await waitFor(() => expect(shadow.activeElement).toBe(receipt));
      } finally {
        cleanup();
        host.remove();
      }
    });

    it.each([
      ["an open shadow tree", ["open"]],
      ["a closed shadow tree", ["closed"]],
      ["an open tree in a closed tree", ["closed", "open"]],
      ["a closed tree in a closed tree", ["closed", "closed"]],
      ["a closed tree in an open tree", ["open", "closed"]],
    ] as const)(
      "gives the receipt focus in %s after focus went to the page and back",
      async (_, modes) => {
        const outside = document.createElement("button");
        outside.textContent = "Knapp på siden";
        document.body.append(outside);
        const host = document.createElement("div");
        document.body.append(host);
        // Each tree is in the one before it. The survey is in the last.
        let shadow = host.attachShadow({ mode: modes[0] });
        for (const mode of modes.slice(1)) {
          const innerHost = document.createElement("div");
          shadow.append(innerHost);
          shadow = innerHost.attachShadow({ mode });
        }
        const mount = document.createElement("div");
        shadow.append(mount);
        const inShadow = within(mount);
        // A browser sends focus events out of a shadow tree to the document,
        // with the host as their target. jsdom keeps them inside the tree.
        const focusAsBrowser = (element: HTMLElement) => {
          element.focus();
          element.dispatchEvent(
            new FocusEvent("focusin", { bubbles: true, composed: true }),
          );
        };
        try {
          render(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={createTransport().transport}
            />,
            { container: mount },
          );
          const option = inShadow.getByRole("radio", { name: /5\./ });
          focusAsBrowser(option);
          fireEvent.click(option);

          focusAsBrowser(outside);
          const send = inShadow.getByRole("button", { name: "Send" });
          focusAsBrowser(send);
          fireEvent.click(send);

          const receipt = await inShadow.findByRole("heading", {
            name: "Takk for tilbakemeldingen!",
          });
          await waitFor(() => expect(shadow.activeElement).toBe(receipt));
        } finally {
          cleanup();
          host.remove();
          outside.remove();
        }
      },
    );

    it("leaves focus on the page when it went there from a shadow tree before the answer was sent", async () => {
      const outside = document.createElement("button");
      outside.textContent = "Knapp på siden";
      document.body.append(outside);
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode: "open" });
      const mount = document.createElement("div");
      shadow.append(mount);
      const inShadow = within(mount);
      const pending = pendingTransport();
      try {
        render(
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />,
          { container: mount },
        );
        fireEvent.click(inShadow.getByRole("radio", { name: /5\./ }));
        const send = inShadow.getByRole("button", { name: "Send" });
        send.focus();
        send.dispatchEvent(
          new FocusEvent("focusin", { bubbles: true, composed: true }),
        );
        fireEvent.click(send);
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );
        // While the answer is sent, the user goes on to the page.
        outside.focus();
        await pending.succeed();

        await inShadow.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        expect(document.activeElement).toBe(outside);
      } finally {
        cleanup();
        host.remove();
        outside.remove();
      }
    });

    it.each([
      ["the same shadow tree as the survey", false],
      ["a closed shadow tree around the survey's tree", true],
    ])(
      "leaves focus on the element in %s that the user went to after a screen reader pressed Send, also when the page stops the focus event",
      async (_case, nested) => {
        const host = document.createElement("div");
        document.body.append(host);
        const shadow = host.attachShadow({ mode: nested ? "closed" : "open" });
        const mount = document.createElement("div");
        const first = document.createElement("button");
        first.textContent = "Første knapp i komponenten";
        const second = document.createElement("button");
        second.textContent = "Andre knapp i komponenten";
        if (nested) {
          const innerHost = document.createElement("div");
          innerHost.attachShadow({ mode: "open" }).append(mount);
          shadow.append(first, innerHost, second);
        } else {
          shadow.append(first, mount, second);
        }
        const inShadow = within(mount);
        // A browser sends focus events out of a shadow tree to the document,
        // with the host as their target. jsdom keeps them inside the tree.
        const focusAsBrowser = (element: HTMLElement) => {
          element.focus();
          element.dispatchEvent(
            new FocusEvent("focusin", { bubbles: true, composed: true }),
          );
        };
        const stopFocusEvent = (event: Event) => event.stopPropagation();
        const pending = pendingTransport();
        try {
          render(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />,
            { container: mount },
          );
          focusAsBrowser(first);
          // A screen reader presses the option and Send without moving focus.
          fireEvent.click(inShadow.getByRole("radio", { name: /5\./ }));
          fireEvent.click(inShadow.getByRole("button", { name: "Send" }));
          await waitFor(() =>
            expect(pending.transport.submit).toHaveBeenCalled(),
          );
          // The document sees the host before and after this move, and a
          // listener on the window keeps the focus event from the document.
          window.addEventListener("focusin", stopFocusEvent, true);
          focusAsBrowser(second);
          await pending.succeed();

          await inShadow.findByRole("heading", {
            name: "Takk for tilbakemeldingen!",
          });
          expect(shadow.activeElement).toBe(second);
        } finally {
          window.removeEventListener("focusin", stopFocusEvent, true);
          cleanup();
          host.remove();
        }
      },
    );

    it("does not scroll to the receipt of a survey that rests against the edge of the viewport", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());

      // The user scrolls until the survey's lower edge is level with the top
      // of the viewport. The browser reports nothing: the survey still
      // touches the viewport, and no step of its area is passed.
      placeObserved({ top: -399 });
      vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue({
        top: -400,
        bottom: 0,
        left: 100,
        right: 700,
        width: 600,
        height: 400,
        x: 100,
        y: -400,
        toJSON: () => ({}),
      });
      fireEvent.scroll(document);
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receipt).toHaveFocus();
      const call = focus.mock.contexts.lastIndexOf(receipt);
      expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
    });

    it("does not scroll a scroll area back to the receipt of a survey that rests against its edge", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const pending = pendingTransport();
      render(
        <div data-testid="area" style={{ overflowY: "auto" }}>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />
        </div>,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());

      // The user scrolls the area until the survey's upper edge is level with
      // the bottom of the area. The survey is still inside the viewport, and
      // the browser reports nothing: no step of its area is passed.
      const box = (top: number, bottom: number) =>
        ({
          top,
          bottom,
          left: 100,
          right: 700,
          width: 600,
          height: bottom - top,
          x: 100,
          y: top,
          toJSON: () => ({}),
        }) as DOMRect;
      vi.spyOn(
        screen.getByTestId("area"),
        "getBoundingClientRect",
      ).mockReturnValue(box(100, 400));
      vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue(
        box(400, 800),
      );
      fireEvent.scroll(screen.getByTestId("area"));
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receipt).toHaveFocus();
      const call = focus.mock.contexts.lastIndexOf(receipt);
      expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
    });

    it("brings the receipt into view when a tall survey shrinks to it with the user still at it", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));

      // A tall survey: its top is above the viewport, and the user is at
      // Send, at the bottom of it.
      const place = vi
        .spyOn(panelOf(), "getBoundingClientRect")
        .mockReturnValue(boxAt(-700, 700));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());
      // The receipt is short, so the survey now ends above the viewport.
      place.mockReturnValue(boxAt(-700, -500));
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receipt).toHaveFocus();
      const call = focus.mock.contexts.lastIndexOf(receipt);
      expect(focus.mock.calls[call]).toEqual([undefined]);
    });

    describe("in a scroll area with a border", () => {
      // The area is 320 pixels high on screen, with a border of 10 pixels:
      // it shows from 100 to 400.
      const renderInArea = () => {
        installFakeIntersectionObserver();
        const pending = pendingTransport();
        render(
          <div data-testid="area" style={{ overflowY: "auto" }}>
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />
          </div>,
        );
        const area = screen.getByTestId("area");
        vi.spyOn(area, "getBoundingClientRect").mockReturnValue(boxAt(90, 410));
        vi.spyOn(area, "clientTop", "get").mockReturnValue(10);
        vi.spyOn(area, "clientHeight", "get").mockReturnValue(300);
        placeObserved();
        return { area, pending };
      };

      const sendWithPanelAt = async (
        top: number,
        area: HTMLElement,
        pending: ReturnType<typeof pendingTransport>,
      ) => {
        const user = userEvent.setup();
        await user.click(screen.getByRole("radio", { name: /5\./ }));
        const send = screen.getByRole("button", { name: "Send" });
        await user.click(send);
        act(() => send.blur());
        vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue(
          boxAt(top, top + 400),
        );
        fireEvent.scroll(area);
        await pending.succeed();
        return screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
      };

      it("does not scroll the area back when the survey rests against the inside of its border", async () => {
        const focus = vi.spyOn(HTMLElement.prototype, "focus");
        const { area, pending } = renderInArea();
        const receipt = await sendWithPanelAt(400, area, pending);

        const call = focus.mock.contexts.lastIndexOf(receipt);
        expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
      });

      it("brings the receipt into view when a pixel of the survey shows in the area", async () => {
        const focus = vi.spyOn(HTMLElement.prototype, "focus");
        const { area, pending } = renderInArea();
        const receipt = await sendWithPanelAt(399, area, pending);

        const call = focus.mock.contexts.lastIndexOf(receipt);
        expect(focus.mock.calls[call]).toEqual([undefined]);
      });
    });

    it("does not scroll back to a survey in an iframe that a scroll area on the page around it has moved away", async () => {
      // The survey is in an iframe from the same site, and the iframe is in a
      // scroll area of the page that shows from 100 to 400. The user scrolls
      // the area until the iframe is below it, still inside the window.
      installFakeIntersectionObserver();
      const area = document.createElement("div");
      area.style.overflowY = "auto";
      const frame = document.createElement("iframe");
      area.append(frame);
      document.body.append(area);
      const frameDocument = frame.contentDocument as Document;
      // Elements in the iframe belong to the iframe's window.
      const frameWindow = frame.contentWindow as typeof window;
      const focus = vi.spyOn(frameWindow.HTMLElement.prototype, "focus");
      const user = userEvent.setup({ document: frameDocument });
      const inFrame = within(frameDocument.body);
      const pending = pendingTransport();
      try {
        render(
          createPortal(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />,
            frameDocument.body,
          ),
        );
        placeObserved();
        await user.click(inFrame.getByRole("radio", { name: /5\./ }));
        // Focus stays on Send, as jsdom keeps it on a disabled button.
        await user.click(inFrame.getByRole("button", { name: "Send" }));

        vi.spyOn(area, "getBoundingClientRect").mockReturnValue(
          boxAt(100, 400),
        );
        vi.spyOn(area, "clientHeight", "get").mockReturnValue(300);
        vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(
          boxAt(400, 700),
        );
        vi.spyOn(
          panelOf(frameDocument.body),
          "getBoundingClientRect",
        ).mockReturnValue(boxAt(0, 300));
        fireEvent.scroll(area);
        await pending.succeed();

        const receipt = await inFrame.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        const call = focus.mock.contexts.lastIndexOf(receipt);
        expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
      } finally {
        cleanup();
        area.remove();
      }
    });

    it("brings the receipt into view when the user scrolls a few pixels of the survey back on screen, which the browser does not report", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());

      // While the answer is sent, the user scrolls a tall survey out over the
      // top of the viewport, back until it rests against it, and on until 30
      // pixels of it show. The browser reports the first two moves and not
      // the last: 30 of 1400 pixels pass no step of the survey's area.
      const place = vi.spyOn(panelOf(), "getBoundingClientRect");
      for (const top of [-1500, -1400, -1370]) {
        place.mockReturnValue(boxAt(top, top + 1400));
        fireEvent.scroll(document);
        placeObserved({ top, height: 1400 });
      }
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      const call = focus.mock.contexts.lastIndexOf(receipt);
      expect(focus.mock.calls[call]).toEqual([undefined]);
    });

    it("does not scroll a scroll area in a shadow tree back to the receipt of a survey that rests against its edge", async () => {
      // The survey and the scroll area are in the same shadow tree, which a
      // scroll event does not leave.
      installFakeIntersectionObserver();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode: "open" });
      const area = document.createElement("div");
      area.style.overflowY = "auto";
      shadow.append(area);
      const mount = document.createElement("div");
      area.append(mount);
      const inShadow = within(mount);
      const pending = pendingTransport();
      try {
        render(
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />,
          { container: mount },
        );
        placeObserved();
        fireEvent.click(inShadow.getByRole("radio", { name: /5\./ }));
        fireEvent.click(inShadow.getByRole("button", { name: "Send" }));
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );

        // The user scrolls the area until the survey's upper edge is level
        // with the bottom of the area. The browser reports nothing.
        vi.spyOn(area, "getBoundingClientRect").mockReturnValue(
          boxAt(100, 400),
        );
        vi.spyOn(area, "clientHeight", "get").mockReturnValue(300);
        vi.spyOn(panelOf(mount), "getBoundingClientRect").mockReturnValue(
          boxAt(400, 800),
        );
        fireEvent.scroll(area);
        await pending.succeed();

        const receipt = await inShadow.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        expect(shadow.activeElement).toBe(receipt);
        const call = focus.mock.contexts.lastIndexOf(receipt);
        expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
      } finally {
        cleanup();
        host.remove();
      }
    });

    it.each([
      ["the root", () => document.documentElement, boxAt(-1600, 3400)],
      // A page with `height: 100%` on `<body>`.
      [
        "<body>, which the viewport takes over",
        () => document.body,
        boxAt(-1600, -800),
      ],
    ])(
      "brings the receipt into view when the overflow of %s scrolls the page",
      async (_name, scrollerOf, scrollerBox) => {
        const scroller = scrollerOf();
        scroller.style.overflowY = "scroll";
        try {
          installFakeIntersectionObserver();
          const user = userEvent.setup();
          const focus = vi.spyOn(HTMLElement.prototype, "focus");
          const pending = pendingTransport();
          render(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />,
          );
          placeObserved();
          await user.click(screen.getByRole("radio", { name: /5\./ }));

          // The page is scrolled 1600 pixels down. A tall survey shows from
          // the top of the viewport to 700, and the user is at Send, at the
          // bottom of it.
          vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(
            scrollerBox,
          );
          vi.spyOn(scroller, "clientHeight", "get").mockReturnValue(800);
          vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue(
            boxAt(-700, 700),
          );
          const send = screen.getByRole("button", { name: "Send" });
          await user.click(send);
          act(() => send.blur());
          await pending.succeed();

          const receipt = await screen.findByRole("heading", {
            name: "Takk for tilbakemeldingen!",
          });
          const call = focus.mock.contexts.lastIndexOf(receipt);
          expect(focus.mock.calls[call]).toEqual([undefined]);
        } finally {
          scroller.style.overflowY = "";
        }
      },
    );

    it("brings the receipt into view when the survey comes back into view without a scroll, as when content above it closes", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());

      // While the answer is sent, the user scrolls a tall survey out over the
      // top of the viewport. Then content above it closes, and the bottom of
      // the survey is back on screen. Only the browser's report says so.
      vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue(
        boxAt(-1500, -100),
      );
      fireEvent.scroll(document);
      placeObserved({ top: -1500, height: 1400 });
      placeObserved({ top: -1000, height: 1400 });
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      const call = focus.mock.contexts.lastIndexOf(receipt);
      expect(focus.mock.calls[call]).toEqual([undefined]);
    });

    it("does not scroll a scroll area that shows the survey through a slot back to the receipt of a survey that rests against its edge", async () => {
      // A component shows the survey, which is in the page, in a slot inside
      // a scroll area in its own shadow tree. A scroll event does not leave
      // that tree.
      installFakeIntersectionObserver();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode: "open" });
      const area = document.createElement("div");
      area.style.overflowY = "auto";
      area.append(document.createElement("slot"));
      shadow.append(area);
      const mount = document.createElement("div");
      host.append(mount);
      const pending = pendingTransport();
      try {
        render(
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />,
          { container: mount },
        );
        placeObserved();
        fireEvent.click(screen.getByRole("radio", { name: /5\./ }));
        fireEvent.click(screen.getByRole("button", { name: "Send" }));
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );

        // The user scrolls the area until the survey's upper edge is level
        // with the bottom of the area. The browser reports nothing.
        vi.spyOn(area, "getBoundingClientRect").mockReturnValue(
          boxAt(100, 400),
        );
        vi.spyOn(area, "clientHeight", "get").mockReturnValue(300);
        vi.spyOn(panelOf(mount), "getBoundingClientRect").mockReturnValue(
          boxAt(400, 800),
        );
        fireEvent.scroll(area);
        await pending.succeed();

        const receipt = await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        expect(receipt).toHaveFocus();
        const call = focus.mock.contexts.lastIndexOf(receipt);
        expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
      } finally {
        cleanup();
        host.remove();
      }
    });

    it("does not scroll back to a survey in an iframe from another site that the page around it has moved away", async () => {
      // The survey's page is in an iframe from another site. It cannot see the
      // page around it, so a scroll in its own page does not tell the whole
      // story. Only the browser sees where the iframe is.
      installFakeIntersectionObserver();
      vi.spyOn(window, "parent", "get").mockReturnValue({} as Window);
      const user = userEvent.setup();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      // Focus stays on Send, as jsdom keeps it on a disabled button.
      await user.click(screen.getByRole("button", { name: "Send" }));

      // The page around the iframe scrolls it out of the viewport, and the
      // browser reports it. Then the page in the iframe scrolls a little, and
      // the survey is still in that page's window.
      placeObserved({ top: -900 });
      vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue(
        boxAt(100, 500),
      );
      fireEvent.scroll(document);
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receipt).toHaveFocus();
      const call = focus.mock.contexts.lastIndexOf(receipt);
      expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
    });

    it("leaves focus alone after a press on a tool on the page around the iframe while the answer was sent", async () => {
      // The survey is in an iframe from the same site. A tool on the page
      // around it keeps focus where it is when it is pressed, as an editor's
      // toolbar does.
      const tool = document.createElement("button");
      tool.textContent = "Fet";
      tool.addEventListener("mousedown", (event) => event.preventDefault());
      document.body.append(tool);
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = frame.contentDocument as Document;
      const user = userEvent.setup({ document: frameDocument });
      const inFrame = within(frameDocument.body);
      const pending = pendingTransport();
      try {
        render(
          createPortal(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />,
            frameDocument.body,
          ),
        );
        await user.click(inFrame.getByRole("radio", { name: /5\./ }));
        // Focus stays on Send, as jsdom keeps it on a disabled button.
        await user.click(inFrame.getByRole("button", { name: "Send" }));
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );
        fireEvent.mouseDown(tool);
        fireEvent.click(tool);
        await pending.succeed();

        expect(
          await inFrame.findByRole("heading", {
            name: "Takk for tilbakemeldingen!",
          }),
        ).not.toHaveFocus();
      } finally {
        cleanup();
        frame.remove();
        tool.remove();
      }
    });

    it("does not scroll <body> back to the receipt when <body> is a scroll area and the survey rests against its edge", async () => {
      // With overflow of its own on the root, the overflow of <body> is not
      // the viewport's: <body> is a scroll area, here from 100 to 700.
      const { documentElement: root, body } = document;
      root.style.overflowX = "hidden";
      root.style.overflowY = "hidden";
      body.style.overflowY = "auto";
      try {
        installFakeIntersectionObserver();
        const user = userEvent.setup();
        const focus = vi.spyOn(HTMLElement.prototype, "focus");
        const pending = pendingTransport();
        render(
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={pending.transport}
          />,
        );
        placeObserved();
        await user.click(screen.getByRole("radio", { name: /5\./ }));
        const send = screen.getByRole("button", { name: "Send" });
        await user.click(send);
        act(() => send.blur());

        vi.spyOn(body, "getBoundingClientRect").mockReturnValue(
          boxAt(100, 700),
        );
        vi.spyOn(body, "clientHeight", "get").mockReturnValue(600);
        vi.spyOn(panelOf(), "getBoundingClientRect").mockReturnValue(
          boxAt(700, 1100),
        );
        fireEvent.scroll(body);
        await pending.succeed();

        const receipt = await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        });
        const call = focus.mock.contexts.lastIndexOf(receipt);
        expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
      } finally {
        root.style.overflowX = "";
        root.style.overflowY = "";
        body.style.overflowY = "";
      }
    });

    it("lets a dialog that the app shows from the survey through a portal keep its own Enter and focus", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      const onSearch = vi.fn();
      // The app's notice opens a dialog with a search form outside the survey.
      // biome-ignore lint/correctness/noComponentHookFactories: Created once per test, outside React rendering, to isolate its state.
      const NoticeWithDialog = () => {
        const [open, setOpen] = useState(true);
        return (
          <>
            Les om personvern.
            {open
              ? createPortal(
                  <div role="dialog" aria-label="Søk i hjelpen">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        onSearch();
                      }}
                    >
                      <input aria-label="Søkeord" />
                      <button type="submit">Søk</button>
                    </form>
                    <button type="button" onClick={() => setOpen(false)}>
                      Lukk
                    </button>
                  </div>,
                  document.body,
                )
              : null}
          </>
        );
      };
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
          behavior={{ personalDataNotice: <NoticeWithDialog /> }}
        />,
      );

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.type(
        screen.getByRole("textbox", { name: "Søkeord" }),
        "a{Enter}",
      );
      expect(onSearch).toHaveBeenCalledTimes(1);

      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      act(() => send.blur());
      await user.click(screen.getByRole("button", { name: "Lukk" }));
      expect(document.body).toHaveFocus();
      await pending.succeed();

      const receipt = await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(receipt).not.toHaveFocus();
      expect(document.body).toHaveFocus();
    });

    // A mouse in Safari presses a button without moving focus to it. So does
    // a screen reader in browse mode, which sends a click alone. jsdom's
    // click does not move focus either.
    const press = (element: HTMLElement) => {
      fireEvent.pointerDown(element);
      fireEvent.click(element);
    };
    const pressWithScreenReader = (element: HTMLElement) => {
      fireEvent.click(element);
    };

    it.each([
      ["a mouse in Safari", press],
      ["a screen reader", pressWithScreenReader],
    ])(
      "moves focus to the receipt after a press on Send that did not move focus, from %s",
      async (_way, pressSend) => {
        const user = userEvent.setup();
        const pending = pendingTransport();
        render(
          <>
            <button type="button">Appens knapp</button>
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />
          </>,
        );
        await user.click(screen.getByRole("radio", { name: /5\./ }));
        // The user goes to the page, and comes back with a press on Send.
        const appButton = screen.getByRole("button", { name: "Appens knapp" });
        await user.click(appButton);
        act(() => appButton.blur());
        pressSend(screen.getByRole("button", { name: "Send" }));
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );
        expect(document.body).toHaveFocus();
        await pending.succeed();

        expect(
          await screen.findByRole("heading", {
            name: "Takk for tilbakemeldingen!",
          }),
        ).toHaveFocus();
      },
    );

    it.each([
      ["moves focus to the receipt", "succeeds"],
      ["returns focus to Send", "fails"],
    ] as const)(
      "%s when a screen reader pressed Send while focus stayed on the page and the submit %s",
      async (_result, outcome) => {
        const user = userEvent.setup();
        const pending = pendingTransport();
        render(
          <>
            <button type="button">Appens knapp</button>
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />
          </>,
        );
        await user.click(screen.getByRole("radio", { name: /5\./ }));
        const appButton = screen.getByRole("button", { name: "Appens knapp" });
        await user.click(appButton);
        pressWithScreenReader(screen.getByRole("button", { name: "Send" }));
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );
        expect(appButton).toHaveFocus();

        if (outcome === "succeeds") {
          await pending.succeed();
          expect(
            await screen.findByRole("heading", {
              name: "Takk for tilbakemeldingen!",
            }),
          ).toHaveFocus();
        } else {
          await pending.fail();
          await screen.findByRole("alert");
          expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
        }
      },
    );

    it("leaves focus alone when the user pressed somewhere on the page while the answer was sent", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      press(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(pending.transport.submit).toHaveBeenCalled());
      act(() => (document.activeElement as HTMLElement | null)?.blur());
      press(document.body);
      await pending.succeed();

      expect(
        await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        }),
      ).not.toHaveFocus();
      expect(document.body).toHaveFocus();
    });

    it("leaves focus alone when a finger that lands on the survey scrolls past it after the user has left", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={pending.transport}
        />,
      );
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      const send = screen.getByRole("button", { name: "Send" });
      await user.click(send);
      await waitFor(() => expect(pending.transport.submit).toHaveBeenCalled());
      // The user goes on to the page, and scrolls back past the survey. The
      // browser sends a pointer that is cancelled, and no click.
      press(document.body);
      act(() => send.blur());
      fireEvent.pointerDown(panelOf(), { pointerType: "touch" });
      fireEvent.pointerCancel(panelOf(), { pointerType: "touch" });
      await pending.succeed();

      expect(
        await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        }),
      ).not.toHaveFocus();
      expect(document.body).toHaveFocus();
    });

    it.each([
      [
        "a press on a tool that keeps focus where it is",
        (dialog: HTMLElement) => {
          const tool = within(dialog).getByRole("button", { name: "Fet" });
          fireEvent.mouseDown(tool);
          fireEvent.click(tool);
        },
      ],
      [
        "focus, when the app then closes the dialog with its frame",
        (dialog: HTMLElement, frame: HTMLIFrameElement) => {
          within(dialog).getByRole("button", { name: "Lukk" }).focus();
          frame.remove();
        },
      ],
    ])(
      "leaves focus alone after %s in a dialog that the survey shows in another document",
      async (_way, goIntoDialog) => {
        const user = userEvent.setup();
        const pending = pendingTransport();
        const frame = document.createElement("iframe");
        document.body.append(frame);
        const frameBody = (frame.contentDocument as Document).body;
        // biome-ignore lint/correctness/noComponentHookFactories: Created once per test, outside React rendering, to isolate its state.
        const NoticeWithDialog = () => (
          <>
            Les om personvern.
            {createPortal(
              <div role="dialog" aria-label="Hjelp">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  Fet
                </button>
                <button type="button">Lukk</button>
              </div>,
              frameBody,
            )}
          </>
        );
        try {
          render(
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
              behavior={{ personalDataNotice: <NoticeWithDialog /> }}
            />,
          );
          await user.click(screen.getByRole("radio", { name: /5\./ }));
          const send = screen.getByRole("button", { name: "Send" });
          await user.click(send);
          await waitFor(() =>
            expect(pending.transport.submit).toHaveBeenCalled(),
          );
          act(() => send.blur());
          // While the answer is sent, the user goes into the dialog. The
          // survey's document hears nothing of it.
          act(() => goIntoDialog(within(frameBody).getByRole("dialog"), frame));
          expect(document.body).toHaveFocus();
          await pending.succeed();

          expect(
            await screen.findByRole("heading", {
              name: "Takk for tilbakemeldingen!",
            }),
          ).not.toHaveFocus();
          expect(document.body).toHaveFocus();
        } finally {
          cleanup();
          frame.remove();
        }
      },
    );

    it("leaves focus on the page when React shows the survey again after the answer was sent", async () => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      const app = (mode: "visible" | "hidden") => (
        <>
          <button type="button">Appens knapp</button>
          <Activity mode={mode}>
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={survey}
              transport={pending.transport}
            />
          </Activity>
        </>
      );
      const { rerender } = render(app("visible"));
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(pending.transport.submit).toHaveBeenCalled());

      // The app hides the survey while the answer is sent. The user goes on to
      // the page and leaves focus nowhere.
      rerender(app("hidden"));
      const appButton = screen.getByRole("button", { name: "Appens knapp" });
      await user.click(appButton);
      act(() => appButton.blur());
      await pending.succeed();
      rerender(app("visible"));
      await reactSettled();

      expect(
        await screen.findByRole("heading", {
          name: "Takk for tilbakemeldingen!",
        }),
      ).not.toHaveFocus();
      expect(document.body).toHaveFocus();
    });

    it("moves focus to the error summary when several answers are missing", async () => {
      const user = userEvent.setup();
      const onValidationFailed = vi.fn();
      renderInline({ survey: pagedSurvey, events: { onValidationFailed } });

      await user.click(screen.getByRole("button", { name: "Neste" }));

      const summaryHeading = await screen.findByRole("heading", {
        name: "Du må rette svarene før du kan fortsette:",
      });
      const summary = summaryHeading.closest<HTMLElement>(
        ".aksel-error-summary",
      );
      expect(summary).not.toBeNull();
      // Aksel passes focus on from the summary to its heading.
      expect(summaryHeading).toHaveFocus();
      expect(inlineRoot()).toContainElement(summary);
      expect(onValidationFailed).toHaveBeenCalledWith(["oppgave", "resultat"]);

      // A link in the summary moves focus to its field in the same survey.
      await user.click(
        within(summary as HTMLElement).getByRole("link", {
          name: "Hva kom du for å gjøre?",
        }),
      );
      expect(
        screen.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
      ).toHaveFocus();
    });

    it("moves focus to the field when one answer is missing", async () => {
      const user = userEvent.setup();
      renderInline({ survey: pagedSurvey });

      await user.click(screen.getByRole("radio", { name: "Nei" }));
      await user.click(screen.getByRole("button", { name: "Neste" }));

      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
        ).toHaveFocus(),
      );
      expect(screen.getByText("Du må svare på spørsmålet.")).toBeVisible();
    });

    it("moves focus from the intro to the first question", async () => {
      const user = userEvent.setup();
      renderInline({
        intro: { title: "To korte spørsmål", startLabel: "Kom i gang" },
      });

      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Kom i gang" }));

      expect(
        screen.getByRole("heading", {
          name: "Hvor lett var det å bruke kalkulatoren?",
        }),
      ).toHaveFocus();
    });
  });

  describe("inside a form the app owns", () => {
    const renderInAppForm = () => {
      const onAppSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const { transport, submit } = createTransport();
      render(
        <form onSubmit={onAppSubmit}>
          <label>
            Appens felt
            <input type="text" name="felt" />
          </label>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={{
              ...pagedSurvey,
              intro: { title: "Før du sender skjemaet" },
            }}
            transport={transport}
          />
          <button type="submit">Send skjemaet</button>
        </form>,
      );
      return { onAppSubmit, submit };
    };

    it("creates no form element and no submit button of its own", async () => {
      const user = userEvent.setup();
      renderInAppForm();

      const root = inlineRoot();
      const assertNoFormControls = () => {
        expect(root.querySelector("form")).toBeNull();
        for (const button of root.querySelectorAll("button")) {
          expect(button).toHaveAttribute("type", "button");
        }
      };

      assertNoFormControls();
      await user.click(screen.getByRole("button", { name: "Start" }));
      assertNoFormControls();
      await user.type(
        screen.getByRole("textbox", { name: "Hva kom du for å gjøre?" }),
        "Søke",
      );
      await user.click(screen.getByRole("radio", { name: "Ja" }));
      await user.click(screen.getByRole("button", { name: "Neste" }));
      await screen.findByRole("heading", { name: "Fortell mer" });
      assertNoFormControls();
      expect(document.querySelectorAll("form")).toHaveLength(1);
    });

    it("never submits the app's form: not from its buttons, and not with Enter in a field", async () => {
      const user = userEvent.setup();
      const { onAppSubmit, submit } = renderInAppForm();

      await user.click(screen.getByRole("button", { name: "Start" }));
      const textarea = screen.getByRole("textbox", {
        name: "Hva kom du for å gjøre?",
      });
      await user.type(textarea, "Søke{Enter}om noe");
      // Enter still makes a new line in a text answer.
      expect(textarea).toHaveValue("Søke\nom noe");
      const yes = screen.getByRole("radio", { name: "Ja" });
      await user.click(yes);
      expect(yes).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onAppSubmit).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Neste" }));
      await screen.findByRole("heading", { name: "Fortell mer" });
      await user.click(screen.getByRole("button", { name: "Tilbake" }));
      await user.click(screen.getByRole("button", { name: "Neste" }));
      await user.click(await screen.findByRole("button", { name: "Send" }));

      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      expect(submit).toHaveBeenCalledTimes(1);
      expect(onAppSubmit).not.toHaveBeenCalled();
    });

    it("lets Enter pick an option in the searchable field without submitting the app's form", async () => {
      const user = userEvent.setup();
      const onAppSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const { transport, submit } = createTransport();
      render(
        <form onSubmit={onAppSubmit}>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={everyFieldSurvey}
            transport={transport}
            behavior={{ questionLayout: "singlePage" }}
          />
          <button type="submit">Send skjemaet</button>
        </form>,
      );

      const combobox = screen.getByRole("combobox", {
        name: /Søkbart flervalg/,
      });
      // Enter in the empty search field does nothing.
      await user.click(combobox);
      await user.keyboard("{Escape}{Enter}");
      expect(onAppSubmit).not.toHaveBeenCalled();

      // Enter picks the option the arrow key has marked.
      await user.type(combobox, "status");
      await user.keyboard("{ArrowDown}{Enter}");
      expect(onAppSubmit).not.toHaveBeenCalled();
      // Enter on a checkbox does not submit either.
      const checkbox = screen.getByRole("checkbox", { name: "Xray" });
      await user.click(checkbox);
      await user.keyboard("{Enter}");
      expect(onAppSubmit).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(submit.mock.calls[0][0].answers).toEqual({
        sokbart: ["status"],
        flervalg: ["x"],
      });
      expect(onAppSubmit).not.toHaveBeenCalled();
    });

    it("leaves Enter in the app's own fields alone", async () => {
      const user = userEvent.setup();
      const { onAppSubmit } = renderInAppForm();

      await user.type(
        screen.getByRole("textbox", { name: "Appens felt" }),
        "abc{Enter}",
      );

      expect(onAppSubmit).toHaveBeenCalledTimes(1);
    });

    describe("with every kind of field", () => {
      const renderEveryFieldInAppForm = () => {
        const onAppSubmit = vi.fn((event: React.FormEvent) =>
          event.preventDefault(),
        );
        const { transport, submit } = createTransport();
        render(
          <form aria-label="Appens skjema" onSubmit={onAppSubmit}>
            <label>
              Appens felt
              <input type="text" name="felt" />
            </label>
            <LumiSurveyInline
              surveyId={SURVEY_ID}
              survey={everyFieldSurvey}
              transport={transport}
              behavior={{ questionLayout: "singlePage" }}
            />
          </form>,
        );
        const form = screen.getByRole("form", { name: "Appens skjema" });
        return { form: form as HTMLFormElement, onAppSubmit, submit };
      };

      const answerEveryField = async (
        user: ReturnType<typeof userEvent.setup>,
      ) => {
        await user.type(
          screen.getByRole("textbox", { name: /Fritekst/ }),
          "Hei",
        );
        await user.click(screen.getByRole("radio", { name: "Bravo" }));
        await user.click(screen.getByRole("checkbox", { name: "Xray" }));
        await user.type(
          screen.getByRole("combobox", { name: /Søkbart flervalg/ }),
          "status",
        );
        await user.keyboard("{ArrowDown}{Enter}");
      };

      it("keeps its answers out of the app's form data", async () => {
        const user = userEvent.setup();
        const { form } = renderEveryFieldInAppForm();

        await answerEveryField(user);

        expect([...new FormData(form).keys()]).toEqual(["felt"]);
        const fields = [
          screen.getByRole("textbox", { name: /Fritekst/ }),
          screen.getByRole("radio", { name: "Alfa" }),
          screen.getByRole("radio", { name: "Bravo" }),
          screen.getByRole("checkbox", { name: "Xray" }),
          screen.getByRole("checkbox", { name: "Yankee" }),
          screen.getByRole("combobox", { name: /Søkbart flervalg/ }),
        ] as (HTMLInputElement | HTMLTextAreaElement)[];
        for (const field of fields) {
          expect(field.form).toBeNull();
        }
      });

      it("keeps the answers the user sees when the app resets its form", async () => {
        const user = userEvent.setup();
        const { form, submit } = renderEveryFieldInAppForm();
        await answerEveryField(user);

        act(() => form.reset());

        expect(screen.getByRole("textbox", { name: /Fritekst/ })).toHaveValue(
          "Hei",
        );
        expect(screen.getByRole("radio", { name: "Bravo" })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: "Xray" })).toBeChecked();
        await user.click(screen.getByRole("button", { name: "Send" }));
        await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
        expect(submit.mock.calls[0][0].answers).toMatchObject({
          fritekst: "Hei",
          enkeltvalg: "b",
          flervalg: ["x"],
          sokbart: ["status"],
        });
      });
    });
  });

  describe("several surveys on one page", () => {
    it("gives every survey its own DOM ids, also with the same surveyId", () => {
      render(
        <>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={everyFieldSurvey}
            transport={createTransport().transport}
          />
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={everyFieldSurvey}
            transport={createTransport().transport}
          />
        </>,
      );

      const ids = allIds();
      expect(ids.length).toBeGreaterThan(40);
      expect(new Set(ids).size).toBe(ids.length);
      // Every reference points to an element in the same survey.
      for (const root of document.querySelectorAll<HTMLElement>(
        `.${CLASS_NAMES.inlineContainer}`,
      )) {
        for (const element of root.querySelectorAll(
          "[aria-labelledby], [aria-describedby], label[for]",
        )) {
          const references = [
            element.getAttribute("aria-labelledby"),
            element.getAttribute("aria-describedby"),
            element.getAttribute("for"),
          ]
            .filter((value): value is string => Boolean(value))
            .flatMap((value) => value.split(" "));
          for (const id of references) {
            expect(root).toContainElement(document.getElementById(id));
          }
        }
      }
    });

    it("names its fields itself, so they are unique also between apps that each bundle React", () => {
      render(
        <>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={everyFieldSurvey}
            transport={createTransport().transport}
          />
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={everyFieldSurvey}
            transport={createTransport().transport}
          />
        </>,
      );
      const roots = [
        ...document.querySelectorAll<HTMLElement>(
          `.${CLASS_NAMES.inlineContainer}`,
        ),
      ];
      const prefixOf = (root: HTMLElement) => {
        const panelId = root.querySelector(`.${CLASS_NAMES.panel}`)?.id ?? "";
        return panelId.replace(/-dock-panel$/, "");
      };

      // React's useId counts from the start in each copy of React. An id or
      // a radio name that comes from it is the same in two such apps.
      const prefixes = roots.map(prefixOf);
      expect(prefixes[0]).toMatch(/^lumi-inline-[a-z0-9]{6,}$/);
      expect(prefixes[1]).not.toBe(prefixes[0]);
      roots.forEach((root, index) => {
        // Aksel keeps a hidden copy of the textarea to measure its height.
        const fields = [
          ...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            'input, textarea:not([aria-hidden="true"])',
          ),
        ];
        expect(fields).toHaveLength(6);
        // The ids name the question by its place in the document, not by
        // its id: `q1` is the second question.
        expect(fields.map((field) => field.id)).toEqual([
          `${prefixes[index]}-field-q0`,
          `${prefixes[index]}-option-0-q1`,
          `${prefixes[index]}-option-1-q1`,
          `${prefixes[index]}-option-0-q2`,
          `${prefixes[index]}-option-1-q2`,
          `${prefixes[index]}-combobox-q3`,
        ]);
        for (const field of fields) {
          // A label that is clicked answers the field in its own survey.
          expect(
            root.querySelector(`label[for="${CSS.escape(field.id)}"]`),
          ).not.toBeNull();
        }
        const radios = fields.filter(
          (field): field is HTMLInputElement =>
            field instanceof HTMLInputElement && field.type === "radio",
        );
        expect(radios).toHaveLength(2);
        for (const radio of radios) {
          expect(radio.name).toBe(`${prefixes[index]}-field-q1`);
        }
        // The rating groups get their ids from the same prefix.
        const ratingIds = [...root.querySelectorAll('[role="radiogroup"]')]
          .flatMap((group) =>
            (group.getAttribute("aria-describedby") ?? "").split(" "),
          )
          .filter(Boolean);
        expect(ratingIds).toEqual([
          `${prefixes[index]}-description-q4`,
          `${prefixes[index]}-low-q5`,
          `${prefixes[index]}-high-q5`,
        ]);
      });
    });

    it("keeps the ids of one question apart from the ids of a question with a longer name", async () => {
      const user = userEvent.setup();
      // Each question below is named as a part of the question before it
      // would be, if the part came last in the id.
      const { submit } = renderInline({
        survey: {
          authoringSchemaVersion: 1,
          type: "custom",
          pages: [
            {
              id: "side",
              title: "Navn som ligner",
              questions: [
                {
                  id: "valg",
                  type: "singleChoice",
                  prompt: "Hva gjelder det?",
                  options: [
                    { value: "soknad", label: "Søknad" },
                    { value: "annet", label: "Annet" },
                  ],
                },
                { id: "valg-0", type: "text", prompt: "Hvilken søknad?" },
                { id: "valg-error", type: "text", prompt: "Hva gikk galt?" },
                {
                  id: "valg-1",
                  type: "multiChoice",
                  prompt: "Hva prøvde du?",
                  options: [
                    { value: "telefon", label: "Telefon" },
                    { value: "chat", label: "Chat" },
                  ],
                },
                {
                  id: "valg-1-0",
                  type: "multiChoice",
                  variant: "combobox",
                  prompt: "Hvor lette du?",
                  options: [{ value: "forside", label: "Forsiden" }],
                },
                {
                  id: "vurdering",
                  type: "rating",
                  variant: "nps",
                  prompt: "Hvor fornøyd er du?",
                  description: "Tenk på hele besøket.",
                },
                {
                  id: "vurdering-heading",
                  type: "rating",
                  variant: "stars",
                  prompt: "Hvor lett var det?",
                  description: "Fra vanskelig til lett.",
                },
                { id: "vurdering-low", type: "text", prompt: "Hvorfor lavt?" },
                {
                  id: "vurdering-description",
                  type: "text",
                  prompt: "Vil du si mer?",
                },
              ],
            },
          ],
        },
      });

      const ids = allIds();
      expect(new Set(ids).size).toBe(ids.length);

      // A click on the label of the text field answers the text field. With
      // a shared id it would pick the first option of the question above.
      await user.click(screen.getByText("Hvilken søknad?"));
      expect(
        screen.getByRole("textbox", { name: /Hvilken søknad\?/ }),
      ).toHaveFocus();
      expect(screen.getByRole("radio", { name: "Søknad" })).not.toBeChecked();

      await user.keyboard("Dagpenger");
      await user.click(screen.getByText("Annet"));
      await user.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(submit.mock.calls[0][0].answers).toEqual({
        valg: "annet",
        "valg-0": "Dagpenger",
      });
    });

    it("builds no DOM id from the ids in the document", async () => {
      const user = userEvent.setup();
      // Ids a document may use: a page named as a part of a field, a question
      // named as the end of a heading id, a question named as the list of
      // the searchable field before it, and an id with a space.
      renderInline({
        survey: {
          authoringSchemaVersion: 1,
          type: "custom",
          pages: [
            {
              id: "field",
              title: "Om besøket",
              questions: [
                { id: "page-heading", type: "text", prompt: "Hva kom du for?" },
                {
                  id: "x",
                  type: "multiChoice",
                  variant: "combobox",
                  prompt: "Hva gjaldt det?",
                  options: [{ value: "soknad", label: "Søknad" }],
                },
                {
                  id: "x-filtered-options",
                  type: "multiChoice",
                  variant: "combobox",
                  prompt: "Hvor lette du?",
                  options: [{ value: "forside", label: "Forsiden" }],
                },
                {
                  id: "bruker score",
                  type: "rating",
                  variant: "nps",
                  prompt: "Hvor sannsynlig er det at du kommer tilbake?",
                  lowLabel: "Helt usannsynlig",
                  highLabel: "Helt sikkert",
                },
              ],
            },
          ],
        },
      });

      const ids = allIds();
      expect(new Set(ids).size).toBe(ids.length);
      // A space in an id would split every ARIA reference to it in two.
      expect(ids.filter((id) => /\s/.test(id))).toEqual([]);

      // The page title and the text field have each their own id, so the
      // label still belongs to the field.
      await user.click(screen.getByText("Hva kom du for?"));
      expect(
        screen.getByRole("textbox", { name: /Hva kom du for\?/ }),
      ).toHaveFocus();

      // Both searchable fields keep their names.
      expect(
        screen.getByRole("combobox", { name: /Hva gjaldt det\?/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: /Hvor lette du\?/ }),
      ).toBeInTheDocument();

      // The scale is described by both of its end labels.
      const scale = screen.getByRole("radiogroup", {
        name: /Hvor sannsynlig er det at du kommer tilbake\?/,
      });
      expect(scale).toHaveAccessibleDescription(
        expect.stringContaining("Helt usannsynlig"),
      );
      expect(scale).toHaveAccessibleDescription(
        expect.stringContaining("Helt sikkert"),
      );
    });

    it("keeps answers, errors, focus and receipts apart", async () => {
      const user = userEvent.setup();
      const first = createTransport();
      const second = createTransport();
      render(
        <>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={pagedSurvey}
            transport={first.transport}
            context={{ tags: { surface: "inline", placement: "artikkel-1" } }}
          />
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={pagedSurvey}
            transport={second.transport}
            context={{ tags: { surface: "inline", placement: "artikkel-2" } }}
          />
        </>,
      );
      const [firstRoot, secondRoot] = [
        ...document.querySelectorAll<HTMLElement>(
          `.${CLASS_NAMES.inlineContainer}`,
        ),
      ];

      // An error in the second survey moves focus within the second survey.
      await user.click(
        within(secondRoot).getByRole("button", { name: "Neste" }),
      );
      await waitFor(() =>
        expect(secondRoot).toContainElement(
          document.activeElement as HTMLElement,
        ),
      );
      expect(
        within(firstRoot).queryByText("Du må svare på spørsmålet."),
      ).not.toBeInTheDocument();

      // The second survey is answered. The first one is untouched.
      await user.type(
        within(secondRoot).getByRole("textbox", {
          name: "Hva kom du for å gjøre?",
        }),
        "Lese artikkelen",
      );
      await user.click(within(secondRoot).getByRole("radio", { name: "Nei" }));
      await user.click(
        within(secondRoot).getByRole("button", { name: "Neste" }),
      );
      const secondHeading = await within(secondRoot).findByRole("heading", {
        name: "Fortell mer",
      });
      expect(secondHeading).toHaveFocus();
      expect(
        within(firstRoot).getByRole("heading", { name: "Om besøket" }),
      ).toBeInTheDocument();
      expect(
        within(firstRoot).getByRole("textbox", {
          name: "Hva kom du for å gjøre?",
        }),
      ).toHaveValue("");

      await user.click(
        within(secondRoot).getByRole("button", { name: "Send" }),
      );

      const receipt = await within(secondRoot).findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      await waitFor(() => expect(receipt).toHaveFocus());
      expect(second.submit).toHaveBeenCalledTimes(1);
      expect(first.submit).not.toHaveBeenCalled();
      expect(
        second.submit.mock.calls[0][0].transportPayload.context?.tags,
      ).toEqual({ surface: "inline", placement: "artikkel-2" });
      expect(
        within(firstRoot).getByRole("button", { name: "Neste" }),
      ).toBeInTheDocument();
    });

    it("can stand next to the dock with the same surveyId", async () => {
      render(
        <>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={createTransport().transport}
          />
          <LumiSurveyDock
            surveyId={SURVEY_ID}
            survey={survey}
            transport={createTransport().transport}
            behavior={{ storageStrategy: "none" }}
          />
        </>,
      );

      await screen.findByRole("complementary");
      const ids = allIds();
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("heading level", () => {
    const groupedSurvey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "en",
          title: "Første del",
          questions: [
            { id: "navn", type: "text", prompt: "Hva gjaldt det?" },
            {
              id: "vurdering",
              type: "rating",
              variant: "stars",
              prompt: "Hvor fornøyd er du?",
              required: true,
            },
          ],
        },
        {
          id: "to",
          title: "Andre del",
          questions: [{ id: "mer", type: "text", prompt: "Noe mer?" }],
        },
      ],
    };

    it("uses level 2 for the title unless the app sets another level", () => {
      renderInline();

      expect(
        screen.getByRole("heading", {
          name: "Hvor lett var det å bruke kalkulatoren?",
        }).tagName,
      ).toBe("H2");
    });

    it("places page titles and questions with their own heading under the level the app sets", async () => {
      const user = userEvent.setup();
      renderInline({
        survey: groupedSurvey,
        headingLevel: "3",
        behavior: { questionLayout: "singlePage" },
      });

      expect(screen.getByRole("heading", { name: "Første del" }).tagName).toBe(
        "H3",
      );
      expect(screen.getByRole("heading", { name: "Andre del" }).tagName).toBe(
        "H3",
      );
      // A question with its own heading sits one level below the title.
      expect(
        screen.getByRole("heading", { name: "Hvor fornøyd er du?" }).tagName,
      ).toBe("H4");

      await user.type(
        screen.getByRole("textbox", { name: /Hva gjaldt det\?/ }),
        "x",
      );
      await user.click(screen.getByRole("button", { name: "Send" }));
      expect(screen.getByText("Du må svare på spørsmålet.")).toBeVisible();
      expect(
        screen.queryByRole("heading", { level: 2 }),
      ).not.toBeInTheDocument();
    });

    it("uses the level for the intro and the receipt too", async () => {
      const user = userEvent.setup();
      renderInline({
        headingLevel: "4",
        intro: { title: "Før du begynner" },
      });

      expect(
        screen.getByRole("heading", { name: "Før du begynner" }).tagName,
      ).toBe("H4");
      await user.click(screen.getByRole("button", { name: "Start" }));
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(
        (
          await screen.findByRole("heading", {
            name: "Takk for tilbakemeldingen!",
          })
        ).tagName,
      ).toBe("H4");
    });

    it("gives the error summary the same level as the title", async () => {
      const user = userEvent.setup();
      renderInline({ survey: pagedSurvey, headingLevel: "5" });

      await user.click(screen.getByRole("button", { name: "Neste" }));

      expect(
        (
          await screen.findByRole("heading", {
            name: "Du må rette svarene før du kan fortsette:",
          })
        ).tagName,
      ).toBe("H5");
    });

    it.each([
      ["a level that is too deep for the questions below", "6"],
      ["level 1", "1"],
      ["something that is not a level", "stor"],
    ])("falls back to level 2 for %s", (_description, level) => {
      renderInline({
        headingLevel: level as LumiSurveyInlineProps["headingLevel"],
      });

      expect(
        screen.getByRole("heading", {
          name: "Hvor lett var det å bruke kalkulatoren?",
        }).tagName,
      ).toBe("H2");
    });

    it("reads a number from plain JavaScript as its level", () => {
      renderInline({
        headingLevel: 3 as unknown as LumiSurveyInlineProps["headingLevel"],
      });

      expect(
        screen.getByRole("heading", {
          name: "Hvor lett var det å bruke kalkulatoren?",
        }).tagName,
      ).toBe("H3");
    });
  });

  describe("language", () => {
    it("marks survey text with lang and built-in copy as Bokmål", () => {
      renderInline({ lang: "en" });

      expect(
        within(screen.getByRole("heading")).getByText(
          "Hvor lett var det å bruke kalkulatoren?",
        ),
      ).toHaveAttribute("lang", "en");
      expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
        "lang",
        "nb",
      );
      expect(inlineRoot()).not.toHaveAttribute("lang");
    });

    it("lets the app replace built-in copy", async () => {
      const user = userEvent.setup();
      renderInline({
        survey: pagedSurvey,
        labels: {
          submit: "Send inn",
          validationError: "Dette må du svare på.",
        },
        behavior: { questionLayout: "singlePage" },
      });

      await user.click(screen.getByRole("radio", { name: "Ja" }));
      await user.click(screen.getByRole("button", { name: "Send inn" }));

      expect(await screen.findByText("Dette må du svare på.")).toBeVisible();
    });
  });

  describe("views and time to complete", () => {
    it("counts a view when the survey is rendered, in browsers without IntersectionObserver", () => {
      const onViewDock = vi.fn();

      renderInline({ events: { onViewDock } });

      expect(onViewDock).toHaveBeenCalledTimes(1);
      expect(onViewDock).toHaveBeenCalledWith(SURVEY_ID);
    });

    it("counts the view the first time the survey is on screen, and only once", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      const { rerender, submit } = renderInline({ events: { onViewDock } });

      expect(onViewDock).not.toHaveBeenCalled();
      placeObservedBelowTheFold();
      expect(onViewDock).not.toHaveBeenCalled();

      // Six tenths of the survey are above the bottom of the viewport.
      placeObserved({ top: 560 });
      expect(onViewDock).toHaveBeenCalledTimes(1);
      expect(onViewDock).toHaveBeenCalledWith(SURVEY_ID);

      // A new events object and scrolling past again are not new views.
      rerender(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={{ submit }}
          events={{ onViewDock }}
        />,
      );
      placeObserved();
      expect(onViewDock).toHaveBeenCalledTimes(1);
    });

    it("measures the panel, not the space a flex row or a grid stretches the element around it to", () => {
      installFakeIntersectionObserver();
      renderInline();

      expect(observedElements()).toEqual([panelOf()]);
    });

    it("does not count a panel that the app has made invisible or transparent", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      renderInline({ events: { onViewDock } });
      const panel = panelOf();

      // Each place shows a new share of the survey, so the browser reports it.
      panel.style.opacity = "0";
      placeObserved({ top: 500 });
      panel.style.opacity = "";
      panel.style.visibility = "hidden";
      placeObserved({ top: 560 });
      expect(onViewDock).not.toHaveBeenCalled();

      panel.style.visibility = "";
      placeObserved({ top: 600 });
      expect(onViewDock).toHaveBeenCalledTimes(1);
    });

    it("counts the view of a user who clicks in the survey without moving focus", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      renderInline({ events: { onViewDock } });
      // Too little of the survey is on screen to count.
      placeObservedBelowTheFold();

      fireEvent.click(panelOf());

      expect(onViewDock).toHaveBeenCalledTimes(1);
    });

    it("counts the view of a user who answers, also when the app starts a new survey from the answer", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      // biome-ignore lint/correctness/noComponentHookFactories: Created once per test, outside React rendering, to isolate its state.
      const SwitchingApp = () => {
        const [surveyId, setSurveyId] = useState("forste");
        return (
          <LumiSurveyInline
            surveyId={surveyId}
            survey={survey}
            transport={createTransport().transport}
            events={{ onViewDock, onAnswer: () => setSurveyId("andre") }}
          />
        );
      };
      render(<SwitchingApp />);
      // Too little of the survey is on screen to count.
      placeObservedBelowTheFold();

      fireEvent.click(screen.getByRole("radio", { name: /5\./ }));

      expect(onViewDock).toHaveBeenCalledTimes(1);
      expect(onViewDock).toHaveBeenCalledWith("forste");
    });

    it("reports the view before the answer that makes it count", () => {
      installFakeIntersectionObserver();
      const reported: string[] = [];
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={createTransport().transport}
          events={{
            onViewDock: () => reported.push("view"),
            onAnswer: () => reported.push("answer"),
          }}
        />,
      );
      placeObservedBelowTheFold();

      fireEvent.click(screen.getByRole("radio", { name: /5\./ }));

      expect(reported).toEqual(["view", "answer"]);
    });

    it("counts one view per survey in StrictMode", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      render(
        <StrictMode>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={createTransport().transport}
            events={{ onViewDock }}
          />
        </StrictMode>,
      );

      placeObserved();

      expect(onViewDock).toHaveBeenCalledTimes(1);
    });

    it("counts one view when React hides the survey and shows it again", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      const app = (mode: "visible" | "hidden") => (
        <Activity mode={mode}>
          <LumiSurveyInline
            surveyId={SURVEY_ID}
            survey={survey}
            transport={createTransport().transport}
            events={{ onViewDock }}
          />
        </Activity>
      );
      const { rerender } = render(app("visible"));
      placeObserved();
      expect(onViewDock).toHaveBeenCalledTimes(1);

      // React disconnects the effects of a hidden part and connects them
      // again when it is shown. The survey has kept its state.
      rerender(app("hidden"));
      rerender(app("visible"));
      placeObserved();

      expect(onViewDock).toHaveBeenCalledTimes(1);
    });

    it("counts the survey that is on screen, and not the one further down", () => {
      installFakeIntersectionObserver();
      const seen = vi.fn();
      const unseen = vi.fn();
      render(
        <>
          <LumiSurveyInline
            surveyId="oppe"
            survey={survey}
            transport={createTransport().transport}
            events={{ onViewDock: seen }}
          />
          <LumiSurveyInline
            surveyId="nede"
            survey={survey}
            transport={createTransport().transport}
            events={{ onViewDock: unseen }}
          />
        </>,
      );
      const [upper, lower] = [
        ...document.querySelectorAll(`.${CLASS_NAMES.inlineContainer}`),
      ].map((root) => panelOf(root));

      placeObservedBelowTheFold();
      placeObserved({ top: 100 }, upper);

      expect(seen).toHaveBeenCalledWith("oppe");
      expect(unseen).not.toHaveBeenCalled();

      placeObserved({ top: 100 }, lower);
      expect(unseen).toHaveBeenCalledWith("nede");
      expect(seen).toHaveBeenCalledTimes(1);
    });

    it("does not count a view for a survey that is not rendered", () => {
      installFakeIntersectionObserver();
      vi.spyOn(console, "error").mockImplementation(() => {});
      const onViewDock = vi.fn();
      render(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={survey}
          transport={{ endpoint: "" }}
          events={{ onViewDock }}
        />,
      );

      placeObserved();

      expect(onViewDock).not.toHaveBeenCalled();
    });

    it("starts the clock when the survey comes on screen, not when the page renders it", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-23T10:00:00.000Z"));
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const { submit } = renderInline();

      // The user reads the page for ten minutes before scrolling down.
      vi.setSystemTime(new Date("2026-11-23T10:10:00.000Z"));
      placeObserved();
      vi.setSystemTime(new Date("2026-11-23T10:10:20.000Z"));
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      const { startedAt, transportPayload } = submit.mock.calls[0][0];
      expect(startedAt).toBe("2026-11-23T10:10:00.000Z");
      expect(transportPayload.startedAt).toBe("2026-11-23T10:10:00.000Z");
      expect(transportPayload.timeToCompleteMs).toBe(20_000);
    });

    it("counts the view when the user answers a survey that is too tall to count as seen", async () => {
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const onViewDock = vi.fn();
      renderInline({ events: { onViewDock } });

      // A fifth of the survey fills less than half of the viewport.
      placeObserved({ top: 500, height: 1500 });
      expect(onViewDock).not.toHaveBeenCalled();

      await user.click(screen.getByRole("radio", { name: /5\./ }));
      expect(onViewDock).toHaveBeenCalledTimes(1);

      // Coming fully on screen afterwards is not a second view.
      placeObserved();
      expect(onViewDock).toHaveBeenCalledTimes(1);
    });

    it("counts a view for a new surveyId only when the survey is on screen", () => {
      installFakeIntersectionObserver();
      const onViewDock = vi.fn();
      const { rerender, submit } = renderInline({ events: { onViewDock } });
      placeObserved();
      expect(onViewDock).toHaveBeenCalledTimes(1);

      // The app shows another survey in the same place, below the fold.
      rerender(
        <LumiSurveyInline
          surveyId="neste-survey"
          survey={survey}
          transport={{ submit }}
          events={{ onViewDock }}
        />,
      );
      placeObservedBelowTheFold();
      expect(onViewDock).toHaveBeenCalledTimes(1);

      placeObserved();
      expect(onViewDock).toHaveBeenCalledTimes(2);
      expect(onViewDock).toHaveBeenLastCalledWith("neste-survey");
    });

    it("starts a survey with a new surveyId from the beginning, with its own clock", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-23T10:00:00.000Z"));
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const { rerender, submit } = renderInline();
      placeObserved();
      await user.click(screen.getByRole("radio", { name: /2\./ }));
      await user.type(
        screen.getByRole("textbox", { name: /Hva kunne vært bedre\?/ }),
        "Hører til den første surveyen",
      );

      // Twenty minutes later the app shows another survey in the same place.
      vi.setSystemTime(new Date("2026-11-23T10:20:00.000Z"));
      rerender(
        <LumiSurveyInline
          surveyId="neste-survey"
          survey={survey}
          transport={{ submit }}
        />,
      );
      placeObserved();

      // No answer follows from the first survey.
      for (const face of screen.getAllByRole("radio")) {
        expect(face).toHaveAttribute("aria-checked", "false");
      }
      expect(
        screen.queryByRole("textbox", { name: /Hva kunne vært bedre\?/ }),
      ).toBeNull();

      vi.setSystemTime(new Date("2026-11-23T10:20:30.000Z"));
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      const submission = submit.mock.calls[0][0];
      expect(submission.surveyId).toBe("neste-survey");
      expect(submission.answers).toEqual({ rating: 5 });
      expect(submission.startedAt).toBe("2026-11-23T10:20:00.000Z");
      expect(submission.transportPayload.timeToCompleteMs).toBe(30_000);
    });

    it("shows a survey with a new surveyId instead of the receipt of the one before it", async () => {
      const user = userEvent.setup();
      const { rerender, submit } = renderInline();
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });

      rerender(
        <LumiSurveyInline
          surveyId="neste-survey"
          survey={survey}
          transport={{ submit }}
        />,
      );

      expect(
        screen.queryByRole("heading", { name: "Takk for tilbakemeldingen!" }),
      ).toBeNull();
      expect(screen.getAllByRole("radio")).toHaveLength(5);
    });

    it("does not count a finger that lands on the survey to scroll past it", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-23T10:00:00.000Z"));
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const onViewDock = vi.fn();
      const { submit } = renderInline({ events: { onViewDock } });

      // The top of the survey is on screen. The user puts a finger on it and
      // scrolls on: the browser sends a pointer that is cancelled, and
      // neither a click nor focus.
      vi.setSystemTime(new Date("2026-11-23T10:02:00.000Z"));
      placeObserved({ top: 735 });
      const face = screen.getByRole("radio", { name: /5\./ });
      fireEvent.pointerDown(face, { pointerType: "touch" });
      fireEvent.pointerCancel(face, { pointerType: "touch" });
      expect(onViewDock).not.toHaveBeenCalled();

      // The clock has not started either: it starts with the answer.
      vi.setSystemTime(new Date("2026-11-23T10:02:40.000Z"));
      await user.click(face);
      expect(onViewDock).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(submit.mock.calls[0][0].startedAt).toBe(
        "2026-11-23T10:02:40.000Z",
      );
    });

    it("starts the clock when focus enters the survey before it counts as seen", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-23T10:00:00.000Z"));
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const { submit } = renderInline();

      vi.setSystemTime(new Date("2026-11-23T10:03:00.000Z"));
      await user.tab();
      expect(screen.getByRole("radio", { name: /1\./ })).toHaveFocus();
      vi.setSystemTime(new Date("2026-11-23T10:03:15.000Z"));
      await user.keyboard("{ArrowRight}");
      await user.tab();
      await user.tab();
      await user.keyboard("{Enter}");

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(submit.mock.calls[0][0].startedAt).toBe(
        "2026-11-23T10:03:00.000Z",
      );
    });

    it("starts the clock at the first touch when the survey is answered before it counts as seen", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-23T10:00:00.000Z"));
      installFakeIntersectionObserver();
      const user = userEvent.setup();
      const onViewDock = vi.fn();
      const { submit } = renderInline({ events: { onViewDock } });

      // Only the top of the survey is on screen when the user answers.
      vi.setSystemTime(new Date("2026-11-23T10:05:00.000Z"));
      placeObserved({ top: 740, height: 200 });
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      vi.setSystemTime(new Date("2026-11-23T10:05:30.000Z"));
      placeObserved();
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(submit.mock.calls[0][0].startedAt).toBe(
        "2026-11-23T10:05:00.000Z",
      );
      expect(onViewDock).toHaveBeenCalledTimes(1);
    });
  });

  describe("events", () => {
    it("reports answers and the submission, and never a reset or a storage failure", async () => {
      const user = userEvent.setup();
      const events = {
        onAnswer: vi.fn(),
        onSubmitStart: vi.fn(),
        onSubmitSuccess: vi.fn(),
        onReset: vi.fn(),
        onDismissalPersistFailed: vi.fn(),
      } satisfies LumiSurveyEvents;
      const { unmount } = renderInline({ events });

      await user.click(screen.getByRole("radio", { name: /4\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });
      unmount();

      expect(events.onAnswer).toHaveBeenCalledWith("rating", 4);
      expect(events.onSubmitStart).toHaveBeenCalledTimes(1);
      expect(events.onSubmitSuccess).toHaveBeenCalledTimes(1);
      expect(events.onReset).not.toHaveBeenCalled();
      expect(events.onDismissalPersistFailed).not.toHaveBeenCalled();
    });
  });

  describe("preview options", () => {
    it("starts on the page given by behavior.initialPageId", () => {
      renderInline({
        survey: pagedSurvey,
        behavior: { initialPageId: "mer" },
      });

      expect(
        screen.getByRole("heading", { name: "Fortell mer" }),
      ).toBeInTheDocument();
    });

    it("shows the questions for the device a preview simulates", () => {
      const mobileOnly: SurveyDocumentV1 = {
        authoringSchemaVersion: 1,
        pages: [
          {
            id: "side",
            questions: [
              {
                id: "kun-mobil",
                type: "text",
                prompt: "Hvordan var det på mobil?",
                visibleIf: {
                  field: "METADATA",
                  key: "deviceType",
                  operator: "EQ",
                  value: "mobile",
                },
              },
              { id: "alltid", type: "text", prompt: "Noe mer?" },
            ],
          },
        ],
      };
      const { rerender, submit } = renderInline({
        survey: mobileOnly,
        behavior: { simulatedViewport: { width: 1280, height: 800 } },
      });
      expect(
        screen.queryByRole("textbox", { name: /Hvordan var det på mobil\?/ }),
      ).toBeNull();

      rerender(
        <LumiSurveyInline
          surveyId={SURVEY_ID}
          survey={mobileOnly}
          transport={{ submit }}
          behavior={{ simulatedViewport: { width: 360, height: 640 } }}
        />,
      );

      expect(
        screen.getByRole("textbox", { name: /Hvordan var det på mobil\?/ }),
      ).toBeInTheDocument();
    });

    it("starts over when the app gives the survey a new key", async () => {
      const user = userEvent.setup();
      const { transport } = createTransport();
      const { rerender } = render(
        <LumiSurveyInline
          key="artikkel-1"
          surveyId={SURVEY_ID}
          survey={survey}
          transport={transport}
        />,
      );
      await user.click(screen.getByRole("radio", { name: /5\./ }));
      await user.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      });

      rerender(
        <LumiSurveyInline
          key="artikkel-2"
          surveyId={SURVEY_ID}
          survey={survey}
          transport={transport}
        />,
      );

      expect(screen.getByRole("radio", { name: /5\./ })).not.toBeChecked();
    });
  });
});
