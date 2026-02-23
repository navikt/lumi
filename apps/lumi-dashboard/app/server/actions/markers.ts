import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { RatingMarker } from "~/types/api";
import {
  CreateMarkerSchema,
  DeleteMarkerSchema,
  FetchMarkersParamsSchema,
  UpdateMarkerSchema,
} from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

const mockMarkers: RatingMarker[] = [];

function sortMarkers(a: RatingMarker, b: RatingMarker): number {
  const byDate = a.markerDate.localeCompare(b.markerDate);
  if (byDate !== 0) return byDate;
  return a.createdAt.localeCompare(b.createdAt);
}

function filterMockMarkers(
  markers: RatingMarker[],
  params: {
    surveyId: string;
    team?: string;
    fromDate?: string;
    toDate?: string;
  },
): RatingMarker[] {
  return markers
    .filter((marker) => marker.surveyId === params.surveyId)
    .filter((marker) => !params.team || marker.team === params.team)
    .filter(
      (marker) => !params.fromDate || marker.markerDate >= params.fromDate,
    )
    .filter((marker) => !params.toDate || marker.markerDate <= params.toDate)
    .sort(sortMarkers);
}

/**
 * Fetch markers for a survey (team-scoped).
 */
export const fetchMarkersServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(FetchMarkersParamsSchema))
  .handler(async ({ data, context }): Promise<RatingMarker[]> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return filterMockMarkers(mockMarkers, data);
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(data.surveyId)}/markers`,
      {
        team: data.team,
        fromDate: data.fromDate,
        toDate: data.toDate,
      },
    );
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);
    return response.json() as Promise<RatingMarker[]>;
  });

/**
 * Create marker for a survey.
 */
export const createMarkerServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(CreateMarkerSchema))
  .handler(async ({ data, context }): Promise<RatingMarker> => {
    const { backendUrl, oboToken } = context as AuthContext;
    const { surveyId, team, ...payload } = data;

    if (isMockMode()) {
      await mockDelay();
      const now = new Date().toISOString();
      const marker: RatingMarker = {
        id: crypto.randomUUID(),
        team: team ?? "team-esyfo",
        surveyId,
        markerDate: payload.markerDate,
        label: payload.label.trim(),
        description: payload.description?.trim(),
        color: payload.color,
        createdBy: "mock-user",
        createdAt: now,
        updatedAt: now,
      };
      mockMarkers.push(marker);
      return marker;
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(surveyId)}/markers`,
      { team },
    );
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(oboToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await handleApiResponse(response);
    return response.json() as Promise<RatingMarker>;
  });

/**
 * Update marker for a survey.
 * Uses POST server function to perform backend PUT.
 */
export const updateMarkerServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(UpdateMarkerSchema))
  .handler(async ({ data, context }): Promise<RatingMarker> => {
    const { backendUrl, oboToken } = context as AuthContext;
    const { id, surveyId, team, ...payload } = data;

    if (isMockMode()) {
      await mockDelay();
      if (payload.description !== undefined && payload.clearDescription) {
        throw new Error(
          "description cannot be set when clearDescription is true",
        );
      }
      if (payload.color !== undefined && payload.clearColor) {
        throw new Error("color cannot be set when clearColor is true");
      }

      const index = mockMarkers.findIndex(
        (marker) =>
          marker.id === id &&
          marker.surveyId === surveyId &&
          (!team || marker.team === team),
      );

      if (index < 0) {
        throw new Error("Marker not found");
      }

      const existing = mockMarkers[index];
      if (!existing) {
        throw new Error("Marker not found");
      }

      const updated: RatingMarker = {
        ...existing,
        markerDate: payload.markerDate ?? existing.markerDate,
        label: payload.label?.trim() ?? existing.label,
        description:
          payload.clearDescription === true
            ? null
            : payload.description !== undefined
              ? payload.description.trim()
              : existing.description,
        color:
          payload.clearColor === true
            ? null
            : payload.color !== undefined
              ? payload.color
              : existing.color,
        updatedAt: new Date().toISOString(),
      };

      mockMarkers[index] = updated;
      return updated;
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(surveyId)}/markers/${encodeURIComponent(id)}`,
      { team },
    );
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...getHeaders(oboToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await handleApiResponse(response);
    return response.json() as Promise<RatingMarker>;
  });

/**
 * Delete marker for a survey.
 * Uses POST server function to perform backend DELETE.
 */
export const deleteMarkerServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(DeleteMarkerSchema))
  .handler(async ({ data, context }): Promise<void> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const index = mockMarkers.findIndex(
        (marker) =>
          marker.id === data.id &&
          marker.surveyId === data.surveyId &&
          (!data.team || marker.team === data.team),
      );
      if (index < 0) {
        throw new Error("Marker not found");
      }
      mockMarkers.splice(index, 1);
      return;
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(data.surveyId)}/markers/${encodeURIComponent(data.id)}`,
      { team: data.team },
    );
    const response = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);
  });
