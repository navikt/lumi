import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { LumiSurveyTransport } from "../../../core/types.js";
import { LumiSurveyDock } from "../../LumiSurveyDock/LumiSurveyDock.js";
import { LumiSurveyInline } from "../../LumiSurveyInline/LumiSurveyInline.js";
import type { SurveyDocumentV1 } from "../../surveyTypes.js";

// An app that hydrates the whole document has its React root on the
// document. React listens where its root is, so it hears an event there before
// a listener the survey adds later. React marks the document when the first
// root in it is made, and a root on the document made after that would not
// listen. So this file makes no other roots.

const survey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "side",
      questions: [
        {
          id: "vurdering",
          type: "rating",
          variant: "emoji",
          prompt: "Hvor fornøyd er du?",
        },
      ],
    },
  ],
};

/** A transport that waits for the test to let the submit succeed. */
const pendingTransport = () => {
  let resolve!: () => void;
  const submit = vi.fn<LumiSurveyTransport["submit"]>(
    () =>
      new Promise<void>((settle) => {
        resolve = settle;
      }),
  );
  return {
    transport: { submit } satisfies LumiSurveyTransport,
    succeed: () =>
      act(async () => {
        resolve();
        await new Promise((settle) => setTimeout(settle, 0));
      }),
  };
};

const renderOnDocument = (survey: ReactNode) => {
  const root = createRoot(document);
  act(() =>
    root.render(
      <html lang="nb">
        <head />
        <body>{survey}</body>
      </html>,
    ),
  );
  return () => act(() => root.unmount());
};

describe("a survey in an app with its React root on the document", () => {
  it.each([
    [
      "LumiSurveyInline",
      (transport: LumiSurveyTransport) => (
        <LumiSurveyInline
          surveyId="dokumentrot"
          survey={survey}
          transport={transport}
        />
      ),
    ],
    [
      "LumiSurveyDock",
      (transport: LumiSurveyTransport) => (
        <LumiSurveyDock
          surveyId="dokumentrot"
          survey={survey}
          transport={transport}
          behavior={{ storageStrategy: "none" }}
        />
      ),
    ],
  ])(
    "%s moves focus to the receipt after Send",
    async (_component, surveyWith) => {
      const user = userEvent.setup();
      const pending = pendingTransport();
      const unmount = renderOnDocument(surveyWith(pending.transport));
      try {
        await user.click(await screen.findByRole("radio", { name: /5\./ }));
        const send = screen.getByRole("button", { name: /send/i });
        await user.click(send);
        await waitFor(() =>
          expect(pending.transport.submit).toHaveBeenCalled(),
        );
        // A browser drops focus from the button when it is disabled.
        act(() => send.blur());
        await pending.succeed();

        await waitFor(() =>
          expect(
            screen.getByRole("heading", { name: /takk for tilbakemeldingen/i }),
          ).toHaveFocus(),
        );
      } finally {
        unmount();
      }
    },
  );
});
