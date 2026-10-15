import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRatingSurvey } from "../../../presets/index.js";

// Consent readiness and the setup warning are remembered per page load, so
// each test loads the dock as a fresh page would.
const loadDock = async () =>
  (await import("../LumiSurveyDock.js")).LumiSurveyDock;

const survey = createRatingSurvey({
  ratingPrompt: "Hvor fornøyd er du?",
});

const dockState = (surveyId: string) =>
  document
    .querySelector(`[data-feedback-id="${surveyId}"]`)
    ?.getAttribute("data-state") ?? null;

const provideDecoratorWithConsent = () => {
  vi.stubGlobal("__DECORATOR_DATA__", { mock: true });
  vi.stubGlobal("webStorageController", {
    isStorageKeyAllowed: (key: string) => key.startsWith("lumi-"),
    getCurrentConsent: () => ({
      consent: { analytics: true, surveys: true },
      userActionTaken: true,
    }),
  });
};

describe("LumiSurveyDock consent loading", () => {
  // Warm the transform cache so the first fresh load fits the test timeout.
  beforeAll(async () => {
    await loadDock();
  }, 30_000);

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    vi.stubGlobal("__DECORATOR_DATA__", undefined);
    vi.stubGlobal("webStorageController", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the minimized trigger after a short grace period and still applies a late dismissal", async () => {
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

    const LumiSurveyDock = await loadDock();
    render(
      <LumiSurveyDock
        surveyId="consent-delay"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
      />,
    );

    expect(dockState("consent-delay")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(dockState("consent-delay")).toBe("dismissed");

    provideDecoratorWithConsent();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(
      document.querySelector('[data-feedback-id="consent-delay"]'),
    ).not.toBeInTheDocument();
  });

  it("keeps an answered survey hidden when the user opens it before a late lookup", async () => {
    const key = "lumi-dismissed-consent-answered";
    const stored = JSON.stringify({
      version: 1,
      state: "dismissed",
      dismissedAt: new Date().toISOString(),
      resumeAt: null,
      hideCompletely: true,
    });
    localStorage.setItem(key, stored);

    const LumiSurveyDock = await loadDock();
    render(
      <LumiSurveyDock
        surveyId="consent-answered"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "Gi tilbakemelding" }));

    provideDecoratorWithConsent();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(dockState("consent-answered")).toBe("open");
    expect(localStorage.getItem(key)).toBe(stored);
  });

  it("opens when a late decorator shows consent and nothing is stored", async () => {
    const onViewDock = vi.fn();
    const LumiSurveyDock = await loadDock();
    render(
      <LumiSurveyDock
        surveyId="consent-late-open"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
        events={{ onViewDock }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(dockState("consent-late-open")).toBe("dismissed");

    provideDecoratorWithConsent();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(dockState("consent-late-open")).toBe("open");
    expect(onViewDock).toHaveBeenCalledOnce();
  });

  it("reports no persistence failure when the user opens before the lookup ends", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onDismissalPersistFailed = vi.fn();
    const LumiSurveyDock = await loadDock();
    render(
      <LumiSurveyDock
        surveyId="consent-open-early"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
        events={{ onDismissalPersistFailed }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "Gi tilbakemelding" }));
    expect(dockState("consent-open-early")).toBe("open");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(dockState("consent-open-early")).toBe("open");
    expect(onDismissalPersistFailed).not.toHaveBeenCalled();
  });

  it("reports no persistence failure when a late decorator shows declined consent", async () => {
    const onDismissalPersistFailed = vi.fn();
    const LumiSurveyDock = await loadDock();
    render(
      <LumiSurveyDock
        surveyId="consent-declined-late"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
        events={{ onDismissalPersistFailed }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(screen.getByRole("button", { name: "Gi tilbakemelding" }));

    vi.stubGlobal("__DECORATOR_DATA__", { mock: true });
    vi.stubGlobal("webStorageController", {
      isStorageKeyAllowed: (key: string) => key.startsWith("lumi-"),
      getCurrentConsent: () => ({
        consent: { analytics: false, surveys: false },
        userActionTaken: true,
      }),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(dockState("consent-declined-late")).toBe("open");
    expect(onDismissalPersistFailed).not.toHaveBeenCalled();
  });

  it("stays minimized without the Nav decorator and never counts a view", async () => {
    const onViewDock = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const LumiSurveyDock = await loadDock();
    render(
      <LumiSurveyDock
        surveyId="consent-missing"
        survey={survey}
        transport={{ submit: vi.fn().mockResolvedValue(undefined) }}
        events={{ onViewDock }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(dockState("consent-missing")).toBe("dismissed");

    // The consent lookup gives up after five seconds.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4700);
    });
    expect(dockState("consent-missing")).toBe("dismissed");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(dockState("consent-missing")).toBe("dismissed");
    expect(onViewDock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/starts minimized/);
    expect(warn.mock.calls[0]?.[0]).toMatch(/storageStrategy.*localStorage/);
  });
});
