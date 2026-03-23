import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { SearchParams } from "~/schemas/searchSchema";

export type { SearchParams } from "~/schemas/searchSchema";

function removeEmptyParams(
  params: Partial<SearchParams>,
): Partial<SearchParams> {
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
      void navigate({
        to: currentPath,
        search: removeEmptyParams({
          ...params,
          [key]: value || undefined,
        }),
        replace: true,
      });
    },
    [currentPath, navigate, params],
  );

  const setParams = useCallback(
    (newParams: Partial<SearchParams>) => {
      void navigate({
        to: currentPath,
        search: removeEmptyParams({
          ...params,
          ...newParams,
        }),
        replace: true,
      });
    },
    [currentPath, navigate, params],
  );

  const resetParams = useCallback(() => {
    void navigate({
      to: currentPath,
      search: {},
      replace: true,
    });
  }, [currentPath, navigate]);

  return { params, setParam, setParams, resetParams };
}
