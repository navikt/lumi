import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockTags } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import { TagActionSchema, TeamParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Fetch all available tags.
 */
export const fetchTagsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TeamParamsSchema))
  .handler(async ({ data, context }): Promise<string[]> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockTags(data.team);
    }

    const url = buildUrl(backendUrl, "/api/v1/intern/feedback/tags", {
      team: data.team,
    });
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<string[]>;
  });

/**
 * Add a tag to a feedback item.
 */
export const addTagServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TagActionSchema))
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay(300);
      return { success: true };
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/feedback/${encodeURIComponent(data.id)}/tags`,
      {
        team: data.team,
      },
    );
    const response = await fetch(url, {
      method: "POST",
      headers: getHeaders(oboToken),
      body: JSON.stringify({ tag: data.tag }),
    });

    await handleApiResponse(response);

    return { success: true };
  });

/**
 * Remove a tag from a feedback item.
 */
export const removeTagServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TagActionSchema))
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay(300);
      return { success: true };
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/feedback/${encodeURIComponent(data.id)}/tags`,
      { tag: data.tag, team: data.team },
    );
    const response = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return { success: true };
  });
