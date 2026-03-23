import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { SearchParams } from "~/schemas/searchSchema";

export type { SearchParams } from "~/schemas/searchSchema";

type LooseSearchParams = Record<string, unknown>;

function removeEmptyParams(params: LooseSearchParams): LooseSearchParams {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as Partial<SearchParams>;
}

export function useSearchParams() {
  const navigate = useNavigate();
  const router = useRouter();
  const params: SearchParams = useSearch({ strict: false });
  const currentPath = router.state.location.pathname;

  const setParam = useCallback(
    (key: keyof SearchParams, value: string | undefined) => {
      const search = ((prev: LooseSearchParams) =>
        removeEmptyParams({
          ...prev,
          [key]: value || undefined,
        })) as never;

      void navigate({
        to: currentPath,
        search,
        replace: true,
      });
    },
    [currentPath, navigate],
  );

  const setParams = useCallback(
    (newParams: Partial<SearchParams>) => {
      const search = ((prev: LooseSearchParams) =>
        removeEmptyParams({
          ...prev,
          ...newParams,
        })) as never;

      void navigate({
        to: currentPath,
        search,
        replace: true,
      });
    },
    [currentPath, navigate],
  );

  const resetParams = useCallback(() => {
    void navigate({
      to: currentPath,
      search: {} as never,
      replace: true,
    });
  }, [currentPath, navigate]);

  return { params, setParam, setParams, resetParams };
}
