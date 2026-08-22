import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const survey = createRatingSurvey({
  ratingPrompt: "Hvor fornøyd er du?",
});

describe("LumiSurveyDock consent loading", () => {
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

  it("renders after a short grace period and still applies a late dismissal", async () => {
    localStorage.setItem(
      "lumi-dismissed-consent-delay",
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
        surveyId="consent-delay"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
      />,
    );

    expect(
      document.querySelector('[data-feedback-id="consent-delay"]'),
    ).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(
      document.querySelector('[data-feedback-id="consent-delay"]'),
    ).toHaveAttribute("data-state", "open");

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
      document.querySelector('[data-feedback-id="consent-delay"]'),
    ).not.toBeInTheDocument();
  });
});
