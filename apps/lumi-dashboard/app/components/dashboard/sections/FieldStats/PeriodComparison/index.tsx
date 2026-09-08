import {
  Detail,
  Heading,
  HelpText,
  HStack,
  Modal,
  VStack,
} from "@navikt/ds-react";
import { DashboardGrid } from "~/components/dashboard";
import { QuestionTrendSection } from "~/components/dashboard/sections/QuestionTrend";
import { useChoiceFilter } from "~/hooks/useChoiceFilter";
import { useSearchParams } from "~/hooks/useSearchParams";
import type { FeedbackStats, FieldStat } from "~/types/api";
import {
  ComparisonChoiceFieldCard,
  ComparisonRatingFieldCard,
  ComparisonTextFieldCard,
} from "./ComparisonFieldCards";
import { usePreviousPeriodStats } from "./usePreviousPeriodStats";

function findPreviousField(
  previousStats: FeedbackStats | undefined,
  currentField: FieldStat,
) {
  return previousStats?.fieldStats?.find(
    (field) =>
      field.fieldId === currentField.fieldId &&
      field.fieldType === currentField.fieldType,
  );
}

export function FieldStatsPeriodComparison({
  stats,
}: {
  stats: FeedbackStats;
}) {
  const { params, setParams } = useSearchParams();
  const {
    activeFilters: activeChoiceFilters,
    toggleChoice,
    removeChoice,
  } = useChoiceFilter();
  const previousQuery = usePreviousPeriodStats(true, stats);

  const selectedTrendField = stats.fieldStats?.find(
    (field) => field.fieldId === params.trendField,
  );

  const showTrend = (field: FieldStat) => {
    void setParams({
      trendField: field.fieldId,
      trendInterval: "week",
      trendMeasure: field.fieldType === "RATING" ? undefined : "percentage",
    });
  };

  const closeTrend = () => {
    void setParams({
      trendField: undefined,
      trendInterval: undefined,
      trendMeasure: undefined,
    });
  };

  return (
    <>
      <VStack
        data-testid="field-stats-section"
        gap="space-16"
        marginBlock="space-24 space-16"
      >
        <VStack gap="space-8">
          <HStack align="center" wrap gap="space-8">
            <Heading level="2" size="small">
              Statistikk per felt
            </Heading>
            {previousQuery.comparisonEnabled && previousQuery.periods ? (
              <HelpText title="Perioder som sammenlignes">
                Valgt: {previousQuery.periods.current.label}. Før:{" "}
                {previousQuery.periods.previous.label}. Samme filtre gjelder
                begge perioder.
              </HelpText>
            ) : null}
          </HStack>
        </VStack>

        <DashboardGrid
          minColumnWidth="360px"
          gap={{ xs: "space-16", md: "space-24" }}
        >
          {stats.fieldStats.map((field) => {
            const previousField = findPreviousField(
              previousQuery.comparisonData,
              field,
            );

            if (field.fieldType === "RATING") {
              return (
                <ComparisonRatingFieldCard
                  key={field.fieldId}
                  field={field}
                  previousField={previousField}
                  currentTotalCount={stats.totalCount}
                  previousTotalCount={previousQuery.data?.totalCount ?? 0}
                  comparisonEnabled={previousQuery.comparisonAvailable}
                  comparisonPending={
                    previousQuery.comparisonEnabled && previousQuery.isPending
                  }
                  onShowTrend={showTrend}
                />
              );
            }

            if (
              field.fieldType === "SINGLE_CHOICE" ||
              field.fieldType === "MULTI_CHOICE"
            ) {
              return (
                <ComparisonChoiceFieldCard
                  key={field.fieldId}
                  field={field}
                  previousField={previousField}
                  currentTotalCount={stats.totalCount}
                  previousTotalCount={previousQuery.data?.totalCount ?? 0}
                  comparisonEnabled={previousQuery.comparisonAvailable}
                  comparisonPending={
                    previousQuery.comparisonEnabled && previousQuery.isPending
                  }
                  onShowTrend={showTrend}
                  activeChoiceValue={activeChoiceFilters[field.fieldId]}
                  onChoiceSelect={(optionId) =>
                    toggleChoice(field.fieldId, optionId)
                  }
                  onChoiceClear={() => removeChoice(field.fieldId)}
                />
              );
            }

            if (field.fieldType === "TEXT") {
              return (
                <ComparisonTextFieldCard
                  key={field.fieldId}
                  field={field}
                  previousField={previousField}
                  currentTotalCount={stats.totalCount}
                  previousTotalCount={previousQuery.data?.totalCount ?? 0}
                  comparisonEnabled={previousQuery.comparisonAvailable}
                  comparisonPending={
                    previousQuery.comparisonEnabled && previousQuery.isPending
                  }
                />
              );
            }

            return null;
          })}
        </DashboardGrid>
      </VStack>

      <Modal
        open={Boolean(params.trendField && selectedTrendField)}
        onClose={closeTrend}
        header={{
          heading: selectedTrendField
            ? `Utvikling: ${selectedTrendField.label}`
            : "Utvikling over tid",
          closeButton: true,
        }}
        width="64rem"
      >
        <Modal.Body>
          <VStack gap="space-12">
            <Detail>
              Tidsserien viser den valgte perioden.
              {previousQuery.comparisonEnabled &&
                " Sammenligningen er oppsummert i feltkortet."}
            </Detail>
            <QuestionTrendSection surface="plain" showHeading={false} />
          </VStack>
        </Modal.Body>
      </Modal>
    </>
  );
}
