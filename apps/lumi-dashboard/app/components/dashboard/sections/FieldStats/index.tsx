import { Heading, VStack } from "@navikt/ds-react";
import { DashboardGrid } from "~/components/dashboard";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { ChoiceFieldCard, RatingFieldCard, TextFieldCard } from "./FieldCards";
import { Skeleton } from "./Skeleton";

export function FieldStatsSection() {
  const { data: stats, isPending } = useStats();
  const { params } = useSearchParams();
  const hasSurveyFilter = !!params.surveyId;

  if (isPending && hasSurveyFilter) {
    return <Skeleton />;
  }

  if (!stats?.fieldStats?.length) {
    return null;
  }

  const ratingFields = stats.fieldStats.filter((f) => f.fieldType === "RATING");
  const textFields = stats.fieldStats.filter((f) => f.fieldType === "TEXT");
  const choiceFields = stats.fieldStats.filter(
    (f) => f.fieldType === "SINGLE_CHOICE" || f.fieldType === "MULTI_CHOICE",
  );

  return (
    <VStack gap="space-16" marginBlock="space-24 space-16">
      <Heading level="3" size="small">
        Statistikk per felt
      </Heading>

      <DashboardGrid
        minColumnWidth="280px"
        gap={{ xs: "space-16", md: "space-24" }}
      >
        {ratingFields.map((field) => (
          <RatingFieldCard
            key={field.fieldId}
            field={field}
            totalCount={stats.totalCount}
          />
        ))}
        {textFields.map((field) => (
          <TextFieldCard
            key={field.fieldId}
            field={field}
            totalCount={stats.totalCount}
          />
        ))}
        {choiceFields.map((field) => (
          <ChoiceFieldCard
            key={field.fieldId}
            field={field}
            totalCount={stats.totalCount}
          />
        ))}
      </DashboardGrid>
    </VStack>
  );
}
