import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchSurveyTypeDistributionServerFn } from "~/server/actions/fetchSurveyTypeDistribution";
import type { SurveyType } from "~/types/api";

export interface SurveyTypeCount {
  type: SurveyType;
  count: number;
  percentage: number;
}

export interface SurveyTypeDistributionData {
  totalSurveys: number;
  distribution: SurveyTypeCount[];
}

export function useSurveyTypeDistribution() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: ["surveyTypeDistribution", { team: params.team }],
    queryFn: () =>
      fetchSurveyTypeDistributionServerFn({ data: { team: params.team } }),
    placeholderData: keepPreviousData,
  });
}
