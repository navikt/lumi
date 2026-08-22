import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const survey = createRatingSurvey({
  ratingPrompt: "Hvor fornøyd er du?",
});

describe("LumiSurveyDock late consent interaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.stubGlobal("__DECORATOR_DATA__", undefined);
    vi.stubGlobal("webStorageController", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps an in-progress answer when a late dismissal arrives", async () => {
    localStorage.setItem(
      "lumi-dismissed-consent-interaction",
      JSON.stringify({
        version: 1,
        state: "dismissed",
        dismissedAt: new Date().toISOString(),
        resumeAt: null,
        hideCompletely: true,
      }),
    );

    render(
      <LumiSurveyDock
        surveyId="consent-interaction"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const answer = screen.getAllByRole("radio")[0];
    fireEvent.click(answer);
    expect(answer).toBeChecked();

    vi.stubGlobal("__DECORATOR_DATA__", { mock: true });
    vi.stubGlobal("webStorageController", {
      isStorageKeyAllowed: (key: string) => key.startsWith("lumi-"),
      getCurrentConsent: () => ({
        consent: { analytics: true, surveys: true },
        userActionTaken: true,
      }),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(
      document.querySelector('[data-feedback-id="consent-interaction"]'),
    ).toHaveAttribute("data-state", "open");
    expect(answer).toBeChecked();
  });
});
