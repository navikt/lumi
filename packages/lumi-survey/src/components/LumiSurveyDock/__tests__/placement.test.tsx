import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LumiSurveyTransport } from "../../../core/types.js";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";
import type { LumiSurveyBehavior, LumiSurveyStyle } from "../propTypes.js";

const SURVEY_ID = "placement";

const survey = createRatingSurvey({ ratingPrompt: "Hvor fornøyd er du?" });

const transport: LumiSurveyTransport = {
  submit: vi.fn().mockResolvedValue(undefined),
};

function dockElement({
  behavior,
  style,
}: {
  behavior?: LumiSurveyBehavior;
  style?: LumiSurveyStyle;
} = {}) {
  return (
    <>
      <button type="button">Før widgeten</button>
      <LumiSurveyDock
        surveyId={SURVEY_ID}
        survey={survey}
        transport={transport}
        behavior={{ storageStrategy: "none", ...behavior }}
        style={style}
      />
    </>
  );
}

const dock = () => document.querySelector(`[data-feedback-id="${SURVEY_ID}"]`);

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

describe("dock placement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the default stacking order", async () => {
    render(dockElement());

    await waitFor(() => expect(dock()).not.toBeNull());
    expect((dock() as HTMLElement).style.zIndex).toBe("1000");
  });

  it("lets the app lower the stacking order", async () => {
    render(dockElement({ style: { zIndex: 997 } }));

    await waitFor(() => expect(dock()).not.toBeNull());
    expect((dock() as HTMLElement).style.zIndex).toBe("997");
  });

  it("shows nothing after closing when the minimized button is hidden, and returns focus", async () => {
    const user = userEvent.setup();
    render(dockElement({ behavior: { hideMinimizedButton: true } }));

    const before = screen.getByRole("button", { name: "Før widgeten" });
    await user.click(before);
    await user.click(await screen.findByRole("button", { name: "Lukk" }));

    await waitFor(() => expect(dock()).toBeNull());
    expect(
      screen.queryByRole("button", { name: "Gi tilbakemelding" }),
    ).not.toBeInTheDocument();
    expect(before).toHaveFocus();
  });

  it("shows nothing and warns when the dock starts minimized with the button hidden", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = render(
      dockElement({
        behavior: { initialOpen: false, hideMinimizedButton: true },
      }),
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("hideMinimizedButton: true"),
    );
    // The same dock with the button proves it has settled as minimized, so
    // the empty result above is not just a dock that is still loading.
    rerender(dockElement({ behavior: { initialOpen: false } }));
    expect(
      await screen.findByRole("button", { name: "Gi tilbakemelding" }),
    ).toBeInTheDocument();
    rerender(
      dockElement({
        behavior: { initialOpen: false, hideMinimizedButton: true },
      }),
    );
    expect(dock()).toBeNull();
  });

  it("shows nothing to users without consent when the button is hidden", async () => {
    denySurveyConsent();
    const { rerender } = render(
      <LumiSurveyDock
        surveyId={SURVEY_ID}
        survey={survey}
        transport={transport}
        behavior={{ hideMinimizedButton: true }}
      />,
    );

    // Without the option these users see the minimized button.
    rerender(
      <LumiSurveyDock
        surveyId={SURVEY_ID}
        survey={survey}
        transport={transport}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Gi tilbakemelding" }),
    ).toBeInTheDocument();
    rerender(
      <LumiSurveyDock
        surveyId={SURVEY_ID}
        survey={survey}
        transport={transport}
        behavior={{ hideMinimizedButton: true }}
      />,
    );
    expect(dock()).toBeNull();
  });

  it("still shows the minimized button by default", async () => {
    const user = userEvent.setup();
    render(dockElement());

    await user.click(await screen.findByRole("button", { name: "Lukk" }));

    expect(
      await screen.findByRole("button", { name: "Gi tilbakemelding" }),
    ).toHaveFocus();
  });
});
