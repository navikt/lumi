import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { TextTheme } from "~/types/api";
import { handleApiResponse } from "../fetchUtils";

// ============================================
// Schemas for theme operations
// ============================================

const ThemeIdSchema = z.object({
  themeId: z.string(),
  team: z.string().optional(),
});

const FetchThemesParamsSchema = z.object({
  context: z.enum(["GENERAL_FEEDBACK", "BLOCKER", "ALL"]).optional(),
  team: z.string().optional(),
});

const CreateThemeSchema = z.object({
  name: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  color: z.string().optional(),
  priority: z.number().optional(),
  analysisContext: z.enum(["GENERAL_FEEDBACK", "BLOCKER"]),
  team: z.string().optional(),
});

const UpdateThemeSchema = z.object({
  themeId: z.string(),
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  color: z.string().optional(),
  priority: z.number().optional(),
  analysisContext: z.enum(["GENERAL_FEEDBACK", "BLOCKER"]),
  team: z.string().optional(),
});

import { mockThemes } from "~/mock/themes";

// ============================================
// Server Functions
// ============================================

/**
 * Fetch themes for the current team.
 *
 * @param context - Optional filter: "GENERAL_FEEDBACK", "BLOCKER", or "ALL" (default)
 */
export const fetchThemesServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(FetchThemesParamsSchema))
  .handler(async ({ data, context: authContext }): Promise<TextTheme[]> => {
    const { backendUrl, oboToken } = authContext as AuthContext;
    const filterContext = data?.context;

    if (isMockMode()) {
      await mockDelay();
      let themes = [...mockThemes];

      // Filter by context if specified
      if (filterContext && filterContext !== "ALL") {
        themes = themes.filter((t) => t.analysisContext === filterContext);
      }

      return themes;
    }

    // Build URL with optional context filter
    const params: Record<string, string> = {};
    if (data.team) {
      params.team = data.team;
    }
    if (filterContext && filterContext !== "ALL") {
      params.context = filterContext;
    }

    const url = buildUrl(backendUrl, "/api/v1/intern/themes", params);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);
    const allThemes = (await response.json()) as TextTheme[];

    return allThemes;
  });

/**
 * Create a new theme
 */
export const createThemeServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(CreateThemeSchema))
  .handler(async ({ data, context }): Promise<TextTheme> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const newTheme: TextTheme = {
        id: crypto.randomUUID(),
        team: data.team ?? "team-esyfo",
        name: data.name,
        keywords: data.keywords,
        color: data.color,
        priority: data.priority ?? 0,
        analysisContext: data.analysisContext,
      };
      mockThemes.push(newTheme);
      return newTheme;
    }

    const { team, ...payload } = data;

    const url = buildUrl(backendUrl, "/api/v1/intern/themes", {
      team,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(oboToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await handleApiResponse(response);
    return response.json() as Promise<TextTheme>;
  });

/**
 * Update an existing theme
 */
export const updateThemeServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(UpdateThemeSchema))
  .handler(async ({ data, context }): Promise<TextTheme> => {
    const { backendUrl, oboToken } = context as AuthContext;
    const { themeId, team, ...updateData } = data;

    if (isMockMode()) {
      await mockDelay();
      const theme = mockThemes.find((t) => t.id === themeId);
      if (!theme) throw new Error("Theme not found");

      // Filter out undefined values to prevent overwriting existing data
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined),
      );
      Object.assign(theme, cleanUpdateData);
      return theme;
    }

    const url = buildUrl(backendUrl, `/api/v1/intern/themes/${themeId}`, {
      team,
    });
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...getHeaders(oboToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    await handleApiResponse(response);
    return response.json() as Promise<TextTheme>;
  });

/**
 * Delete a theme
 */
export const deleteThemeServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(ThemeIdSchema))
  .handler(async ({ data, context }): Promise<void> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const index = mockThemes.findIndex((t) => t.id === data.themeId);
      if (index !== -1) mockThemes.splice(index, 1);
      return;
    }

    const url = buildUrl(backendUrl, `/api/v1/intern/themes/${data.themeId}`, {
      team: data.team,
    });
    const response = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);
  });
