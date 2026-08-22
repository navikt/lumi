import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LumiSurveyEvents } from "../../../core";
import type { StorageStrategy } from "../propTypes.js";
import { getStorageAdapter } from "./storageAdapters.js";

const MS_IN_DAY = 86_400_000;

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
  closeDock: (hideCompletely?: boolean) => void;
  reopenDock: () => void;
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
  const userInteractedRef = useRef(false);
  // Consumer examples use inline event objects. Their identity must not define
  // a new view, while future lifecycle transitions should use fresh callbacks.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const viewedSurveyIdRef = useRef<string | null>(null);

  const notifyPersistenceFailure = useCallback((cause: unknown) => {
    try {
      eventsRef.current?.onDismissalPersistFailed?.(cause);
    } catch {
      // Consumer event handlers must not reject detached persistence work.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDismissedState = async () => {
      if (typeof window === "undefined") {
        setIsLoading(false);
        return;
      }

      const persistedValue = await storageAdapter.read(storageKey);

      if (cancelled) {
        return;
      }

      if (!persistedValue) {
        if (!userInteractedRef.current) {
          setDismissed(!initialOpen);
        }
        setIsLoading(false);
        return;
      }

      const parsed = parsePersistedDismissal(persistedValue);
      if (!parsed) {
        if (!userInteractedRef.current) {
          setDismissed(true);
        }
        setIsLoading(false);
        return;
      }

      if (isResumeExpired(parsed.resumeAt ?? null)) {
        const result = await storageAdapter.remove(storageKey);
        if (cancelled) {
          return;
        }
        if (result.outcome === "failed") {
          notifyPersistenceFailure(result.error);
        }
        if (!userInteractedRef.current) {
          setDismissed(!initialOpen);
          setShouldHideCompletely(false);
        }
        setIsLoading(false);
        return;
      }

      if (!userInteractedRef.current) {
        setDismissed(true);
        setShouldHideCompletely(parsed.hideCompletely ?? false);
      }
      setIsLoading(false);
    };

    void loadDismissedState();

    return () => {
      cancelled = true;
    };
  }, [initialOpen, notifyPersistenceFailure, storageKey, storageAdapter]);

  useEffect(() => {
    if (dismissed || !viewEnabled) {
      viewedSurveyIdRef.current = null;
      return;
    }

    if (viewedSurveyIdRef.current === surveyId) {
      return;
    }

    viewedSurveyIdRef.current = surveyId;
    eventsRef.current?.onViewDock?.(surveyId);
  }, [dismissed, surveyId, viewEnabled]);

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

      userInteractedRef.current = true;
      setDismissed(true);
      setShouldHideCompletely(hideCompletely ?? false);
      void persistDismissedState(true, hideCompletely);
    },
    [dismissed, persistDismissedState, resetOnClose, onReset],
  );

  const reopenDock = useCallback(() => {
    if (!dismissed) {
      return;
    }

    userInteractedRef.current = true;
    setDismissed(false);
    setShouldHideCompletely(false);
    void persistDismissedState(false);
  }, [dismissed, persistDismissedState]);

  return {
    dismissed,
    shouldHideCompletely,
    isLoading,
    closeDock,
    reopenDock,
  };
};
