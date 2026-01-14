import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import {
  createThemeServerFn,
  deleteThemeServerFn,
  fetchThemesServerFn,
  updateThemeServerFn,
} from "~/server/actions/themes";
import type {
  AnalysisContext,
  CreateThemeInput,
  UpdateThemeInput,
} from "~/types/api";

export type ThemeContext = AnalysisContext | "ALL";

export interface UseThemesOptions {
  /**
   * Filter themes by analysis context.
   * - "GENERAL_FEEDBACK": Discovery themes only
   * - "BLOCKER": Blocker themes only (for Top Tasks)
   * - "ALL": All themes (default)
   */
  context?: ThemeContext;
}

/**
 * Hook for managing text themes (CRUD operations).
 * Provides queries and mutations with automatic cache invalidation.
 *
 * @example
 * // Get only discovery themes
 * const { themes } = useThemes({ context: "GENERAL_FEEDBACK" });
 *
 * // Get only blocker themes
 * const { themes } = useThemes({ context: "BLOCKER" });
 *
 * // Get all themes (default)
 * const { themes } = useThemes();
 */
export function useThemes(options: UseThemesOptions = {}) {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();
  const context = options.context ?? "ALL";

  const themesQuery = useQuery({
    queryKey: ["themes", { team: params.team, context }],
    queryFn: () =>
      fetchThemesServerFn({ data: { context, team: params.team } }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateThemeInput) => {
      if (context === "ALL") {
        // Creating a theme without an explicit context is ambiguous.
        // Callers should use useThemes({ context: ... }) when creating.
        throw new Error("Theme context is required when creating a theme");
      }

      return createThemeServerFn({
        data: {
          team: params.team,
          ...input,
          analysisContext: input.analysisContext ?? context,
        },
      });
    },
    onSuccess: () => {
      // Invalidate all theme queries regardless of context
      queryClient.invalidateQueries({ queryKey: ["themes"] });
      queryClient.invalidateQueries({ queryKey: ["discoveryStats"] });
      queryClient.invalidateQueries({ queryKey: ["blockerStats"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      themeId,
      ...input
    }: UpdateThemeInput & { themeId: string }) => {
      const analysisContext =
        input.analysisContext ?? (context === "ALL" ? undefined : context);

      if (!analysisContext) {
        throw new Error("Theme context is required when updating a theme");
      }

      return updateThemeServerFn({
        data: {
          team: params.team,
          themeId,
          ...input,
          analysisContext,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
      queryClient.invalidateQueries({ queryKey: ["discoveryStats"] });
      queryClient.invalidateQueries({ queryKey: ["blockerStats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (themeId: string) =>
      deleteThemeServerFn({ data: { themeId, team: params.team } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] });
      queryClient.invalidateQueries({ queryKey: ["discoveryStats"] });
      queryClient.invalidateQueries({ queryKey: ["blockerStats"] });
    },
  });

  return {
    themes: themesQuery.data ?? [],
    isLoading: themesQuery.isLoading,
    error: themesQuery.error,

    createTheme: createMutation.mutate,
    isCreating: createMutation.isPending,

    updateTheme: updateMutation.mutate,
    isUpdating: updateMutation.isPending,

    deleteTheme: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
