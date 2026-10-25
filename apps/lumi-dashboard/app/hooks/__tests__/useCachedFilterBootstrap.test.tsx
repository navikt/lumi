import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fetchFilterBootstrapServerFn } from "~/server/actions";
import {
  filterBootstrapQueryKey,
  useCachedFilterBootstrap,
} from "../useFilterBootstrap";

vi.mock("~/server/actions", () => ({
  fetchFilterBootstrapServerFn: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: { team: "flex" } }),
}));

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useCachedFilterBootstrap", () => {
  it("reads the bootstrap FilterBar has fetched without fetching it again", () => {
    const client = new QueryClient();
    const bootstrap = { selectedTeam: "flex" };
    client.setQueryData(filterBootstrapQueryKey("flex"), bootstrap);

    const { result } = renderHook(() => useCachedFilterBootstrap(), {
      wrapper: wrapper(client),
    });

    expect(result.current.data).toBe(bootstrap);
    expect(fetchFilterBootstrapServerFn).not.toHaveBeenCalled();
  });

  it("fetches nothing before FilterBar has the bootstrap", () => {
    const client = new QueryClient();

    const { result } = renderHook(() => useCachedFilterBootstrap(), {
      wrapper: wrapper(client),
    });

    expect(result.current.data).toBeUndefined();
    expect(fetchFilterBootstrapServerFn).not.toHaveBeenCalled();
  });
});
