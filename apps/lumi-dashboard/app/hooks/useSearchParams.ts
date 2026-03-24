import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { SearchParams } from "~/schemas/searchSchema";

export type { SearchParams } from "~/schemas/searchSchema";

export function useSearchParams() {
  const navigate = useNavigate();
  const params = useSearch({ strict: false }) as SearchParams;

  const setParam = useCallback(
    (key: keyof SearchParams, value: string | undefined) => {
      void navigate({
        // @ts-expect-error -- shared hook used across routes; strict typing not feasible
        search: (prev: Record<string, string | undefined>) => {
          const next = { ...prev };
          if (value) {
            next[key] = value;
          } else {
            delete next[key];
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const setParams = useCallback(
    (newParams: Partial<SearchParams>) => {
      void navigate({
        // @ts-expect-error -- shared hook used across routes; strict typing not feasible
        search: (prev: Record<string, string | undefined>) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(newParams)) {
            if (value === undefined || value === "") {
              delete next[key];
            } else {
              next[key] = value;
            }
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const resetParams = useCallback(() => {
    void navigate({
      // @ts-expect-error -- shared hook used across routes; strict typing not feasible
      search: {},
      replace: true,
    });
  }, [navigate]);

  return { params, setParam, setParams, resetParams };
}
