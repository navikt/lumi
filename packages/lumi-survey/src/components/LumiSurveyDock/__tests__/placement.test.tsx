import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LumiSurveyTransport } from "../../../core/types.js";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";
import type { LumiSurveyBehavior, LumiSurveyStyle } from "../propTypes.js";

const SURVEY_ID = "placement";

const survey = createRatingSurvey({ ratingPrompt: "Hvor fornøyd er du?" });

const transport: LumiSurveyTransport = {
  submit: vi.fn().mockResolvedValue(undefined),
};

function renderDock({
  behavior,
  style,
}: {
  behavior?: LumiSurveyBehavior;
  style?: LumiSurveyStyle;
} = {}) {
  return render(
    <>
      <button type="button">Før widgeten</button>
      <LumiSurveyDock
        surveyId={SURVEY_ID}
        survey={survey}
        transport={transport}
        behavior={{ storageStrategy: "none", ...behavior }}
        style={style}
      />
    </>,
  );
}

const dock = () => document.querySelector(`[data-feedback-id="${SURVEY_ID}"]`);

describe("dock placement", () => {
  it("keeps the default stacking order", async () => {
    renderDock();

    await waitFor(() => expect(dock()).not.toBeNull());
    expect((dock() as HTMLElement).style.zIndex).toBe("1000");
  });

  it("lets the app lower the stacking order", async () => {
    renderDock({ style: { zIndex: 997 } });

    await waitFor(() => expect(dock()).not.toBeNull());
    expect((dock() as HTMLElement).style.zIndex).toBe("997");
  });

  it("shows nothing after closing when the minimized button is hidden, and returns focus", async () => {
    const user = userEvent.setup();
    renderDock({ behavior: { hideMinimizedButton: true } });

    const before = screen.getByRole("button", { name: "Før widgeten" });
    await user.click(before);
    await user.click(await screen.findByRole("button", { name: "Lukk" }));

    await waitFor(() => expect(dock()).toBeNull());
    expect(
      screen.queryByRole("button", { name: "Gi tilbakemelding" }),
    ).not.toBeInTheDocument();
    expect(before).toHaveFocus();
  });

  it("shows nothing for a dock that starts minimized with the button hidden", async () => {
    renderDock({ behavior: { initialOpen: false, hideMinimizedButton: true } });

    // Let the dock finish reading its stored state.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(dock()).toBeNull();
  });

  it("still shows the minimized button by default", async () => {
    const user = userEvent.setup();
    renderDock();

    await user.click(await screen.findByRole("button", { name: "Lukk" }));

    expect(
      await screen.findByRole("button", { name: "Gi tilbakemelding" }),
    ).toHaveFocus();
  });
});
