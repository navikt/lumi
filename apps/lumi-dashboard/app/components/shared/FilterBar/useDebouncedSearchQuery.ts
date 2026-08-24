import { useCallback, useEffect, useRef, useState } from "react";

export const SEARCH_QUERY_DEBOUNCE_MS = 400;

interface UseDebouncedSearchQueryOptions {
  query?: string;
  resetVersion?: number;
  onCommit: (query: string) => void | Promise<void>;
}

export function useDebouncedSearchQuery({
  query,
  resetVersion = 0,
  onCommit,
}: UseDebouncedSearchQueryOptions) {
  const committedQuery = query ?? "";
  const committedQueryRef = useRef(committedQuery);
  const queryDraftRef = useRef(committedQuery);
  const inFlightQueryRef = useRef<{ query: string } | undefined>(undefined);
  const discardedQueryRef = useRef<{ query: string } | undefined>(undefined);
  const resetVersionRef = useRef(resetVersion);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [queryDraft, setQueryDraft] = useState(committedQuery);

  const cancelPendingQuery = useCallback(() => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const startQueryCommit = useCallback(
    (nextQuery: string) => {
      const request = { query: nextQuery };
      inFlightQueryRef.current = request;
      const navigation = onCommit(nextQuery);

      if (navigation) {
        const clearDiscardedRequest = () => {
          if (discardedQueryRef.current === request) {
            discardedQueryRef.current = undefined;
          }
        };
        void navigation.then(clearDiscardedRequest, clearDiscardedRequest);
      }
    },
    [onCommit],
  );

  useEffect(() => {
    const queryChanged = committedQueryRef.current !== committedQuery;
    if (!queryChanged) {
      return;
    }

    const isOwnCommit = inFlightQueryRef.current?.query === committedQuery;
    const isDiscardedCommit =
      !isOwnCommit && discardedQueryRef.current?.query === committedQuery;
    committedQueryRef.current = committedQuery;

    if (isDiscardedCommit) {
      discardedQueryRef.current = undefined;
      if (
        queryDraftRef.current !== committedQuery &&
        inFlightQueryRef.current === undefined &&
        timeoutRef.current === undefined
      ) {
        const latestQuery = queryDraftRef.current;
        startQueryCommit(latestQuery);
      }
      return;
    }

    discardedQueryRef.current = undefined;

    if (!isOwnCommit) {
      inFlightQueryRef.current = undefined;
      cancelPendingQuery();
      queryDraftRef.current = committedQuery;
      setQueryDraft(committedQuery);
      return;
    }

    inFlightQueryRef.current = undefined;
    if (queryDraftRef.current === committedQuery) {
      cancelPendingQuery();
      return;
    }

    // A newer draft can outlive the request it was typed after. If its timer
    // already elapsed while navigation was in flight, commit it now that the
    // router has acknowledged the previous value.
    if (timeoutRef.current === undefined) {
      const latestQuery = queryDraftRef.current;
      startQueryCommit(latestQuery);
    }
  }, [cancelPendingQuery, committedQuery, startQueryCommit]);

  useEffect(() => cancelPendingQuery, [cancelPendingQuery]);

  useEffect(() => {
    if (resetVersionRef.current === resetVersion) {
      return;
    }

    resetVersionRef.current = resetVersion;
    cancelPendingQuery();
    discardedQueryRef.current = inFlightQueryRef.current;
    inFlightQueryRef.current = undefined;
    queryDraftRef.current = "";
    setQueryDraft("");
  }, [cancelPendingQuery, resetVersion]);

  const updateQueryDraft = useCallback(
    (nextQuery: string) => {
      queryDraftRef.current = nextQuery;
      setQueryDraft(nextQuery);
      cancelPendingQuery();

      const effectiveQuery =
        inFlightQueryRef.current?.query ?? committedQueryRef.current;
      if (nextQuery === effectiveQuery) {
        return;
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        if (
          inFlightQueryRef.current === undefined &&
          nextQuery !== committedQueryRef.current
        ) {
          startQueryCommit(nextQuery);
        }
      }, SEARCH_QUERY_DEBOUNCE_MS);
    },
    [cancelPendingQuery, startQueryCommit],
  );

  const clearQueryDraft = useCallback(() => {
    cancelPendingQuery();
    discardedQueryRef.current = inFlightQueryRef.current;
    inFlightQueryRef.current = undefined;
    queryDraftRef.current = "";
    setQueryDraft("");
  }, [cancelPendingQuery]);

  return {
    queryDraft,
    updateQueryDraft,
    clearQueryDraft,
  };
}
