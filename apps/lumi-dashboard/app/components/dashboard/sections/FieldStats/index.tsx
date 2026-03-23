import { Heading, VStack } from "@navikt/ds-react";
import { DashboardGrid } from "~/components/dashboard";
import { useChoiceFilter } from "~/hooks/useChoiceFilter";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { ChoiceFieldCard, RatingFieldCard, TextFieldCard } from "./FieldCards";
import { Skeleton } from "./Skeleton";

export function FieldStatsSection() {
  const { data: stats, isPending } = useStats();
  const { params } = useSearchParams();
  const { activeFilters: activeChoiceFilters, toggleChoice } =
    useChoiceFilter();
  const hasSurveyFilter = !!params.surveyId;

  if (isPending && hasSurveyFilter) {
    return <Skeleton />;
  }

  if (!stats?.fieldStats?.length) {
    return null;
  }

  return (
    <VStack
      data-testid="field-stats-section"
      gap="space-16"
      marginBlock="space-24 space-16"
    >
      <Heading level="3" size="small">
        Statistikk per felt
      </Heading>

      <DashboardGrid
        minColumnWidth="280px"
        gap={{ xs: "space-16", md: "space-24" }}
      >
        {stats.fieldStats.map((field) => {
          switch (field.fieldType) {
            case "RATING":
              return (
                <RatingFieldCard
                  key={field.fieldId}
                  field={field}
                  totalCount={stats.totalCount}
                />
              );
            case "TEXT":
              return (
                <TextFieldCard
                  key={field.fieldId}
                  field={field}
                  totalCount={stats.totalCount}
                />
              );
            case "SINGLE_CHOICE":
            case "MULTI_CHOICE":
              return (
                <ChoiceFieldCard
                  key={field.fieldId}
                  field={field}
                  totalCount={stats.totalCount}
                  activeChoiceFilters={activeChoiceFilters}
                  onChoiceSelect={(optionId) =>
                    toggleChoice(field.fieldId, optionId)
                  }
                  onChoiceClear={() => {
                    const activeOptionId = activeChoiceFilters[field.fieldId];
                    if (activeOptionId) {
                      toggleChoice(field.fieldId, activeOptionId);
                    }
                  }}
                />
              );
            default:
              return null;
          }
        })}
      </DashboardGrid>
    </VStack>
  );
}
