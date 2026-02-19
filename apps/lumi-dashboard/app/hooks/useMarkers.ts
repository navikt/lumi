import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import {
  createMarkerServerFn,
  deleteMarkerServerFn,
  fetchMarkersServerFn,
  updateMarkerServerFn,
} from "~/server/actions";
import type { CreateMarkerInput, UpdateMarkerInput } from "~/types/api";

export function useMarkers(
  surveyId?: string,
  fromDate?: string,
  toDate?: string,
) {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();

  const markersQuery = useQuery({
    queryKey: ["markers", surveyId, params.team, fromDate, toDate],
    queryFn: () =>
      fetchMarkersServerFn({
        data: {
          surveyId: surveyId ?? "",
          fromDate,
          toDate,
          team: params.team,
        },
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: Boolean(surveyId),
  });

  const invalidateMarkers = () => {
    queryClient.invalidateQueries({ queryKey: ["markers"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateMarkerInput) => {
      if (!surveyId) {
        throw new Error("surveyId is required");
      }
      return createMarkerServerFn({
        data: {
          surveyId,
          team: params.team,
          ...input,
        },
      });
    },
    onSuccess: invalidateMarkers,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
    } & UpdateMarkerInput) => {
      if (!surveyId) {
        throw new Error("surveyId is required");
      }
      return updateMarkerServerFn({
        data: {
          id,
          surveyId,
          team: params.team,
          ...input,
        },
      });
    },
    onSuccess: invalidateMarkers,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!surveyId) {
        throw new Error("surveyId is required");
      }
      return deleteMarkerServerFn({
        data: {
          id,
          surveyId,
          team: params.team,
        },
      });
    },
    onSuccess: invalidateMarkers,
  });

  return {
    markers: markersQuery.data ?? [],
    isLoading: markersQuery.isLoading,
    isFetching: markersQuery.isFetching,
    error: markersQuery.error,

    createMarker: createMutation.mutate,
    createMarkerAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateMarker: updateMutation.mutate,
    updateMarkerAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    deleteMarker: deleteMutation.mutate,
    deleteMarkerAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
