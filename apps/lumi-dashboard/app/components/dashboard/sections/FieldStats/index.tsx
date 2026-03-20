import { Heading, VStack } from "@navikt/ds-react";
import { DashboardGrid } from "~/components/dashboard";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { ChoiceFieldCard, RatingFieldCard, TextFieldCard } from "./FieldCards";
import { Skeleton } from "./Skeleton";

export function FieldStatsSection() {
  const { data: stats, isPending } = useStats();
  const { params, setParams } = useSearchParams();
  const hasSurveyFilter = !!params.surveyId;
  const activeChoiceFieldId = params.choiceFieldId;
  const activeChoiceValue = params.choiceValue;

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
            case "MULTI_CHOICE": {
              const isFilteringThisField =
                activeChoiceFieldId === field.fieldId;
              const activeValueForField = isFilteringThisField
                ? activeChoiceValue
                : undefined;

              const onChoiceSelect = (optionId: string) => {
                const isAlreadySelected =
                  isFilteringThisField && activeChoiceValue === optionId;

                setParams({
                  choiceFieldId: isAlreadySelected ? undefined : field.fieldId,
                  choiceValue: isAlreadySelected ? undefined : optionId,
                  page: "1",
                });
              };

              const onChoiceClear = () => {
                setParams({
                  choiceFieldId: undefined,
                  choiceValue: undefined,
                  page: "1",
                });
              };

              return (
                <ChoiceFieldCard
                  key={field.fieldId}
                  field={field}
                  totalCount={stats.totalCount}
                  activeChoiceValue={activeValueForField}
                  onChoiceSelect={onChoiceSelect}
                  onChoiceClear={onChoiceClear}
                />
              );
            }
            default:
              return null;
          }
        })}
      </DashboardGrid>
    </VStack>
  );
}
