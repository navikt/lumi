import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LumiSurveyEvents } from "../../../core";
import type { StorageStrategy } from "../propTypes.js";
import { getStorageAdapter } from "./storageAdapters.js";

const MS_IN_DAY = 86_400_000;
const CONSENT_INITIAL_RENDER_GRACE_MS = 300;

interface PersistedDismissalState {
  version?: number;
  state?: "dismissed";
  dismissedAt?: string;
  resumeAt?: string | null;
  hideCompletely?: boolean;
}

const parsePersistedDismissal = (
  raw: string,
): PersistedDismissalState | null => {
  try {
    return JSON.parse(raw) as PersistedDismissalState;
  } catch {
    return null;
  }
};

const isResumeExpired = (resumeAt: string | null | undefined): boolean => {
  if (!resumeAt) {
    return false;
  }

  const resumeTime = Date.parse(resumeAt);
  if (Number.isNaN(resumeTime)) {
    return false;
  }

  return resumeTime <= Date.now();
};

export interface UsePersistedDismissalOptions {
  surveyId: string;
  initialOpen: boolean;
  dismissCooldownDays: number;
  events?: LumiSurveyEvents;
  resetOnClose: boolean;
  onReset: () => void;
  storageStrategy: StorageStrategy;
  /** Whether the open dock currently has renderable content. */
  viewEnabled?: boolean;
}

export interface UsePersistedDismissalReturn {
  dismissed: boolean;
  shouldHideCompletely: boolean;
  isLoading: boolean;
  markUserInteraction: () => void;
  closeDock: (hideCompletely?: boolean) => void;
  reopenDock: () => void;
  /** Persist the dismissal that closing after a successful submit would. */
  persistSubmission: (hideCompletely: boolean) => void;
}

export const usePersistedDismissal = (
  options: UsePersistedDismissalOptions,
): UsePersistedDismissalReturn => {
  const {
    surveyId,
    initialOpen,
    dismissCooldownDays,
    events,
    resetOnClose,
    onReset,
    storageStrategy,
    viewEnabled = true,
  } = options;

  const storageKey = useMemo(() => `lumi-dismissed-${surveyId}`, [surveyId]);

  const storageAdapter = useMemo(
    () => getStorageAdapter(storageStrategy),
    [storageStrategy],
  );

  const [dismissed, setDismissed] = useState<boolean>(() => !initialOpen);
  const [shouldHideCompletely, setShouldHideCompletely] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isLoadingRef = useRef(true);
  const userInteractedRef = useRef(false);
  // Reopening clears storage only when there is something to clear: a value
  // the read found, or a write from this session. Anything else would only
  // fail again for users without consent and report a false failure.
  const foundStoredValueRef = useRef(false);
  const writeAttemptedRef = useRef(false);
  const readPendingRef = useRef(true);
  // The user reopened before the read answered; clear what it finds.
  const clearWhenFoundRef = useRef(false);
  // Consumer examples use inline event objects. Their identity must not define
  // a new view, while future lifecycle transitions should use fresh callbacks.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const viewedSurveyIdRef = useRef<string | null>(null);
  // The `hideCompletely` flag already written for a successful submit. Closing
  // the receipt with the same flag then writes nothing new.
  const persistedSubmissionRef = useRef<boolean | null>(null);

  const notifyPersistenceFailure = useCallback((cause: unknown) => {
    try {
      eventsRef.current?.onDismissalPersistFailed?.(cause);
    } catch {
      // Consumer event handlers must not reject detached persistence work.
    }
  }, []);

  const markUserInteraction = useCallback(() => {
    userInteractedRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderGraceTimer: ReturnType<typeof setTimeout> | undefined;
    // Unknown again until this read answers.
    foundStoredValueRef.current = false;
    readPendingRef.current = true;
    clearWhenFoundRef.current = false;

    const finishLoading = () => {
      if (renderGraceTimer !== undefined) {
        clearTimeout(renderGraceTimer);
        renderGraceTimer = undefined;
      }
      isLoadingRef.current = false;
      setIsLoading(false);
    };

    if (storageStrategy === "consent") {
      renderGraceTimer = setTimeout(() => {
        renderGraceTimer = undefined;
        if (cancelled || !isLoadingRef.current) {
          return;
        }
        // It is still unknown whether a dismissal can be stored. Show the
        // minimized trigger: opening now and minimizing when the consent API
        // turns out to be missing would make the panel flash on every page.
        // Only a later empty read opens the survey.
        if (!userInteractedRef.current) {
          setDismissed(true);
        }
        isLoadingRef.current = false;
        setIsLoading(false);
      }, CONSENT_INITIAL_RENDER_GRACE_MS);
    }

    const removeStoredValue = async () => {
      let result: Awaited<ReturnType<typeof storageAdapter.remove>>;
      try {
        result = await storageAdapter.remove(storageKey);
      } catch (removeError) {
        notifyPersistenceFailure(removeError);
        return;
      }
      if (result.outcome === "failed") {
        notifyPersistenceFailure(result.error);
      }
    };

    const loadDismissedState = async () => {
      if (typeof window === "undefined") {
        finishLoading();
        return;
      }

      const readResult = await storageAdapter.read(storageKey);

      if (cancelled) {
        return;
      }

      readPendingRef.current = false;
      const foundValue =
        readResult.outcome === "found" && Boolean(readResult.value);
      foundStoredValueRef.current = foundValue;

      // Once the rendered survey has been touched, this load is stale. It must
      // neither replace UI state nor remove a newer dismissal written by that
      // interaction. A reopen before the read answered still clears an older
      // stored dismissal, as a reopen after it would have.
      if (userInteractedRef.current) {
        if (
          foundValue &&
          clearWhenFoundRef.current &&
          !writeAttemptedRef.current
        ) {
          void removeStoredValue();
        }
        finishLoading();
        return;
      }

      if (readResult.outcome === "unavailable") {
        // A dismissal could not be remembered either, so opening by itself
        // would repeat on every page load. Start minimized and let the user
        // open the survey.
        setDismissed(true);
        setShouldHideCompletely(false);
        finishLoading();
        return;
      }

      if (readResult.outcome === "empty" || !readResult.value) {
        // Storage works and holds nothing: the only case besides an expired
        // dismissal where the survey opens by itself.
        setDismissed(!initialOpen);
        finishLoading();
        return;
      }

      const parsed = parsePersistedDismissal(readResult.value);
      if (!parsed) {
        setDismissed(true);
        finishLoading();
        return;
      }

      if (isResumeExpired(parsed.resumeAt ?? null)) {
        const result = await storageAdapter.remove(storageKey);
        if (cancelled) {
          return;
        }
        if (result.outcome === "failed") {
          notifyPersistenceFailure(result.error);
        } else {
          foundStoredValueRef.current = false;
        }
        setDismissed(!initialOpen);
        setShouldHideCompletely(false);
        finishLoading();
        return;
      }

      setDismissed(true);
      setShouldHideCompletely(parsed.hideCompletely ?? false);
      finishLoading();
    };

    void loadDismissedState();

    return () => {
      cancelled = true;
      if (renderGraceTimer !== undefined) {
        clearTimeout(renderGraceTimer);
      }
    };
  }, [
    initialOpen,
    notifyPersistenceFailure,
    storageKey,
    storageAdapter,
    storageStrategy,
  ]);

  useEffect(() => {
    // A view counts once the open dock is shown, not while the stored state is
    // still loading and might keep it minimized or hidden.
    if (dismissed || !viewEnabled || isLoading) {
      viewedSurveyIdRef.current = null;
      return;
    }

    if (viewedSurveyIdRef.current === surveyId) {
      return;
    }

    viewedSurveyIdRef.current = surveyId;
    eventsRef.current?.onViewDock?.(surveyId);
  }, [dismissed, isLoading, surveyId, viewEnabled]);

  const persistDismissedState = useCallback(
    async (nextDismissed: boolean, hideCompletely?: boolean) => {
      if (nextDismissed) {
        const now = new Date();
        const resumeAt =
          dismissCooldownDays > 0
            ? new Date(
                now.getTime() + dismissCooldownDays * MS_IN_DAY,
              ).toISOString()
            : undefined;

        const payload: PersistedDismissalState = {
          version: 1,
          state: "dismissed",
          dismissedAt: now.toISOString(),
          resumeAt: resumeAt ?? null,
          hideCompletely: hideCompletely ?? false,
        };

        writeAttemptedRef.current = true;
        let result: Awaited<ReturnType<typeof storageAdapter.write>>;
        try {
          result = await storageAdapter.write(
            storageKey,
            JSON.stringify(payload),
          );
        } catch (persistError) {
          notifyPersistenceFailure(persistError);
          return;
        }
        if (result.outcome === "failed") {
          notifyPersistenceFailure(result.error);
        }
        return;
      }

      let result: Awaited<ReturnType<typeof storageAdapter.remove>>;
      try {
        result = await storageAdapter.remove(storageKey);
      } catch (persistError) {
        notifyPersistenceFailure(persistError);
        return;
      }
      if (result.outcome === "failed") {
        notifyPersistenceFailure(result.error);
      }
    },
    [dismissCooldownDays, notifyPersistenceFailure, storageKey, storageAdapter],
  );

  const closeDock = useCallback(
    (hideCompletely?: boolean) => {
      if (dismissed) {
        return;
      }

      if (resetOnClose) {
        onReset();
      }

      markUserInteraction();
      setDismissed(true);
      setShouldHideCompletely(hideCompletely ?? false);
      const alreadyPersisted =
        persistedSubmissionRef.current === (hideCompletely ?? false);
      persistedSubmissionRef.current = null;
      if (!alreadyPersisted) {
        void persistDismissedState(true, hideCompletely);
      }
    },
    [
      dismissed,
      markUserInteraction,
      persistDismissedState,
      resetOnClose,
      onReset,
    ],
  );

  const reopenDock = useCallback(() => {
    if (!dismissed) {
      return;
    }

    markUserInteraction();
    setDismissed(false);
    setShouldHideCompletely(false);
    persistedSubmissionRef.current = null;
    if (!foundStoredValueRef.current && !writeAttemptedRef.current) {
      if (readPendingRef.current) {
        clearWhenFoundRef.current = true;
      }
      return;
    }
    void persistDismissedState(false);
  }, [dismissed, markUserInteraction, persistDismissedState]);

  const persistSubmission = useCallback(
    (hideCompletely: boolean) => {
      // Store what closing the receipt stores, so the next page load does not
      // reopen a survey the user already answered. The receipt stays visible.
      markUserInteraction();
      persistedSubmissionRef.current = hideCompletely;
      void persistDismissedState(true, hideCompletely);
    },
    [markUserInteraction, persistDismissedState],
  );

  return {
    dismissed,
    shouldHideCompletely,
    isLoading,
    markUserInteraction,
    closeDock,
    reopenDock,
    persistSubmission,
  };
};
