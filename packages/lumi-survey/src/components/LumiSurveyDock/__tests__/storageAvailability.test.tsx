import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LumiSurveyTransport } from "../../../core/types.js";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";
import type { LumiSurveyBehavior } from "../propTypes.js";

const SURVEY_ID = "storage-availability";
const STORAGE_KEY = `lumi-dismissed-${SURVEY_ID}`;

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

const renderDock = (
  behavior?: LumiSurveyBehavior,
  transport: LumiSurveyTransport = {
    submit: vi.fn().mockResolvedValue(undefined),
  },
) =>
  render(
    <LumiSurveyDock
      surveyId={SURVEY_ID}
      survey={survey}
      transport={transport}
      behavior={behavior}
    />,
  );

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

const submitRating = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("radio", { name: /5\./i }));
  await user.click(screen.getByRole("button", { name: "Send" }));
};

describe("LumiSurveyDock when the dismissal cannot be stored", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts minimized without survey consent, so the user opens it", async () => {
    denySurveyConsent();
    const user = userEvent.setup();

    renderDock();

    const trigger = await screen.findByRole("button", {
      name: "Gi tilbakemelding",
    });
    expect(dock()).toHaveAttribute("data-state", "dismissed");
    expect(
      screen.queryByRole("heading", { name: /hvor fornøyd er du/i }),
    ).not.toBeInTheDocument();

    await user.click(trigger);

    expect(dock()).toHaveAttribute("data-state", "open");
    expect(
      screen.getByRole("heading", { name: /hvor fornøyd er du/i }),
    ).toHaveFocus();
  });

  it("starts minimized when localStorage is blocked", async () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });

    renderDock({ storageStrategy: "localStorage" });

    expect(
      await screen.findByRole("button", { name: "Gi tilbakemelding" }),
    ).toBeInTheDocument();
    expect(dock()).toHaveAttribute("data-state", "dismissed");
  });

  it("keeps opening with the none strategy, which stores nothing on purpose", async () => {
    denySurveyConsent();

    renderDock({ storageStrategy: "none" });

    await waitFor(() => {
      expect(dock()).toHaveAttribute("data-state", "open");
    });
  });

  it("keeps opening with working localStorage and no stored dismissal", async () => {
    renderDock({ storageStrategy: "localStorage" });

    await waitFor(() => {
      expect(dock()).toHaveAttribute("data-state", "open");
    });
  });
});

describe("LumiSurveyDock after a successful submit", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    "consent",
    "localStorage",
  ] as const)("stores the submit with %s storage before the receipt is closed", async (storageStrategy) => {
    const user = userEvent.setup();
    const { unmount } = renderDock({ storageStrategy });

    await submitRating(user);
    expect(
      await screen.findByRole("heading", {
        name: /takk for tilbakemeldingen/i,
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored).toMatchObject({
      version: 1,
      state: "dismissed",
      hideCompletely: true,
    });
    // The default cooldown of 30 days still applies.
    expect(Date.parse(stored.resumeAt) - Date.parse(stored.dismissedAt)).toBe(
      30 * 86_400_000,
    );

    // Leaving the page without pressing close must not reopen the survey.
    unmount();
    renderDock({ storageStrategy });

    await waitFor(() => {
      expect(dock()).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Gi tilbakemelding" }),
    ).not.toBeInTheDocument();
  });

  it("shows the minimized trigger on the next page when hideAfterSubmit is off", async () => {
    const user = userEvent.setup();
    const behavior: LumiSurveyBehavior = {
      storageStrategy: "localStorage",
      hideAfterSubmit: false,
      dismissCooldownDays: 0,
    };
    const { unmount } = renderDock(behavior);

    await submitRating(user);
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      { hideCompletely: false, resumeAt: null },
    );

    unmount();
    renderDock(behavior);

    expect(
      await screen.findByRole("button", { name: "Gi tilbakemelding" }),
    ).toBeInTheDocument();
    expect(dock()).toHaveAttribute("data-state", "dismissed");
  });

  it("stores nothing when the submit fails", async () => {
    const user = userEvent.setup();
    renderDock(
      { storageStrategy: "localStorage" },
      { submit: vi.fn().mockRejectedValue(new Error("network")) },
    );

    await submitRating(user);

    expect(
      await screen.findByText(/kunne ikke sende tilbakemeldingen/i),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
