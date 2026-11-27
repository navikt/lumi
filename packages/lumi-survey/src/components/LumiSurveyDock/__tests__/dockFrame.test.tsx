import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LumiSurveyTransport } from "../../../core/types.js";
import type { SurveyDocumentV1 } from "../../surveyTypes.js";
import { CLASS_NAMES } from "../classNames.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const SURVEY_ID = "dock-frame";

const survey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "besok",
      title: "Om besøket",
      questions: [
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
  ],
};

const renderDock = () => {
  const submit = vi.fn<LumiSurveyTransport["submit"]>(async () => undefined);
  render(
    <LumiSurveyDock
      surveyId={SURVEY_ID}
      survey={survey}
      transport={{ submit }}
      behavior={{ storageStrategy: "none" }}
    />,
  );
  return { submit };
};

/**
 * The dock shares its survey flow with `LumiSurveyInline`. These are the
 * parts of the dock's own frame that an inline survey leaves out, and that
 * the dock must keep.
 */
describe("LumiSurveyDock frame", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("floats as a landmark with a shadow, a scroll area and a close button", async () => {
    renderDock();

    const dock = await screen.findByRole("complementary", {
      name: "Tilbakemeldingspanel",
    });
    const panel = dock.querySelector<HTMLElement>(`.${CLASS_NAMES.panel}`);
    expect(dock.style.position).toBe("fixed");
    expect(panel?.getAttribute("style")).toContain("shadow");
    expect(panel?.style.overflowY).toBe("auto");
    expect(panel?.style.maxHeight).not.toBe("");
    expect(screen.getByRole("button", { name: "Lukk" })).toBeInTheDocument();
  });

  it("builds its DOM ids from surveyId", async () => {
    const user = userEvent.setup();
    renderDock();

    const heading = await screen.findByRole("heading", { name: "Om besøket" });
    expect(heading).toHaveAttribute("id", `${SURVEY_ID}-besok-page-heading`);
    expect(document.getElementById(`${SURVEY_ID}-dock-panel`)).toHaveClass(
      CLASS_NAMES.panel,
    );
    expect(
      document.getElementById(`${SURVEY_ID}-question-resultat`),
    ).not.toBeNull();

    await user.click(screen.getByRole("radio", { name: "Ja" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByRole("heading", {
        name: "Takk for tilbakemeldingen!",
      }),
    ).toHaveAttribute("id", `${SURVEY_ID}-dock-success-heading`);
  });

  it("keeps its own form, so Enter in a field sends the answers", async () => {
    const user = userEvent.setup();
    const { submit } = renderDock();

    const yes = await screen.findByRole("radio", { name: "Ja" });
    expect(yes.closest("form")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "type",
      "submit",
    );

    await user.click(yes);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });

  it("closes from the button on the receipt", async () => {
    const user = userEvent.setup();
    renderDock();

    await user.click(await screen.findByRole("radio", { name: "Ja" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("heading", { name: "Takk for tilbakemeldingen!" });
    // The close button in the header and the button on the receipt.
    const closeButtons = screen.getAllByRole("button", { name: "Lukk" });
    expect(closeButtons).toHaveLength(2);
    await user.click(closeButtons[1]);

    await waitFor(() =>
      expect(
        document.querySelector(`[data-feedback-id="${SURVEY_ID}"]`),
      ).toBeNull(),
    );
  });
});
