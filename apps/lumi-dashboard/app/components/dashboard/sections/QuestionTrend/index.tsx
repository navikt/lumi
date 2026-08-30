import {
  Alert,
  BodyShort,
  Detail,
  Heading,
  Select,
  Skeleton,
  Table,
  ToggleGroup,
  VStack,
} from "@navikt/ds-react";
import { useEffect } from "react";
import { DashboardCard } from "~/components/dashboard/DashboardCard";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useQuestionTrend } from "~/hooks/useQuestionTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type { FieldStat, QuestionTrendBucket } from "~/types/api";
import { QuestionTrendChart } from "./QuestionTrendChart";
import styles from "./QuestionTrendSection.module.css";
import {
  fillQuestionTrendBuckets,
  formatQuestionTrendBucket,
} from "./questionTrendUtils";

const SUPPORTED_FIELD_TYPES = new Set([
  "RATING",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
]);

function TrendTable({
  buckets,
  fieldType,
  interval,
  measure,
  options,
}: {
  buckets: QuestionTrendBucket[];
  fieldType: FieldStat["fieldType"];
  interval: "day" | "week" | "month";
  measure: "count" | "percentage";
  options: Array<{ id: string; label: string }>;
}) {
  const isRating = fieldType === "RATING";
  const cellValue = (bucket: QuestionTrendBucket, optionId: string) => {
    if (bucket.masked) return "Skjult";
    const value = bucket.distribution[optionId]?.[measure] ?? 0;
    return measure === "percentage"
      ? `${value.toLocaleString("nb-NO")} %`
      : value;
  };

  return (
    <div className={styles.tableViewport}>
      <Table
        size="small"
        className={styles.table}
        aria-label="Data for utvikling over tid"
      >
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Periode</Table.HeaderCell>
            {isRating ? (
              <Table.HeaderCell align="right">Gjennomsnitt</Table.HeaderCell>
            ) : (
              options.map((option) => (
                <Table.HeaderCell key={option.id} align="right">
                  {option.label}
                </Table.HeaderCell>
              ))
            )}
            <Table.HeaderCell align="right">Svar</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {buckets.map((bucket) => (
            <Table.Row key={bucket.startDate}>
              <Table.HeaderCell scope="row">
                {formatQuestionTrendBucket(bucket.startDate, interval)}
              </Table.HeaderCell>
              {isRating ? (
                <Table.DataCell
                  align="right"
                  className={bucket.masked ? styles.maskedCell : undefined}
                >
                  {bucket.masked
                    ? "Skjult"
                    : (bucket.average?.toLocaleString("nb-NO", {
                        maximumFractionDigits: 2,
                      }) ?? "–")}
                </Table.DataCell>
              ) : (
                options.map((option) => (
                  <Table.DataCell
                    key={option.id}
                    align="right"
                    className={bucket.masked ? styles.maskedCell : undefined}
                  >
                    {cellValue(bucket, option.id)}
                  </Table.DataCell>
                ))
              )}
              <Table.DataCell
                align="right"
                className={bucket.masked ? styles.maskedCell : undefined}
              >
                {bucket.masked ? "Skjult" : (bucket.responseCount ?? 0)}
              </Table.DataCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

export function QuestionTrendSection() {
  const { params, setParams } = useSearchParams();
  const statsQuery = useStats();
  const structuredFields = (statsQuery.data?.fieldStats ?? []).filter((field) =>
    SUPPORTED_FIELD_TYPES.has(field.fieldType),
  );
  const selectedField = structuredFields.find(
    (field) => field.fieldId === params.trendField,
  );
  const trendQuery = useQuestionTrend(Boolean(selectedField));
  const interval = params.trendInterval ?? "week";
  const measure = params.trendMeasure ?? "percentage";

  useEffect(() => {
    if (
      !statsQuery.isPending &&
      params.trendField &&
      !structuredFields.some((field) => field.fieldId === params.trendField)
    ) {
      void setParams({
        trendField: undefined,
        trendInterval: undefined,
        trendMeasure: undefined,
      });
    }
  }, [params.trendField, setParams, statsQuery.isPending, structuredFields]);

  if (!params.surveyId) return null;

  const trend = trendQuery.data;
  const buckets = trend
    ? fillQuestionTrendBuckets(trend, params.fromDate, params.toDate)
    : [];

  return (
    <DashboardCard as="section" data-testid="question-trend-section">
      <VStack gap="space-20">
        <VStack gap="space-4">
          <Heading level="2" size="medium">
            Utvikling over tid
          </Heading>
          <BodyShort textColor="subtle">
            Følg svarene på ett strukturert spørsmål innenfor de aktive
            filtrene.
          </BodyShort>
        </VStack>

        {structuredFields.length === 0 && !statsQuery.isPending ? (
          <Alert variant="info" size="small">
            Denne surveyen har ingen rating- eller valgspørsmål med svar i den
            valgte perioden.
          </Alert>
        ) : (
          <div className={styles.controls}>
            <Select
              label="Spørsmål"
              size="small"
              value={params.trendField ?? ""}
              onChange={(event) => {
                const fieldId = event.target.value || undefined;
                const field = structuredFields.find(
                  (candidate) => candidate.fieldId === fieldId,
                );
                void setParams({
                  trendField: fieldId,
                  trendInterval: fieldId ? interval : undefined,
                  trendMeasure:
                    fieldId && field?.fieldType !== "RATING"
                      ? measure
                      : undefined,
                });
              }}
            >
              <option value="">Velg spørsmål</option>
              {structuredFields.map((field) => (
                <option key={field.fieldId} value={field.fieldId}>
                  {field.label}
                </option>
              ))}
            </Select>

            {selectedField ? (
              <ToggleGroup
                label="Tidsintervall"
                size="small"
                value={interval}
                onChange={(value) =>
                  void setParams({
                    trendInterval: value as "day" | "week" | "month",
                  })
                }
              >
                <ToggleGroup.Item value="day" label="Dag" />
                <ToggleGroup.Item value="week" label="Uke" />
                <ToggleGroup.Item value="month" label="Måned" />
              </ToggleGroup>
            ) : null}

            {selectedField && selectedField.fieldType !== "RATING" ? (
              <ToggleGroup
                label="Vis som"
                size="small"
                value={measure}
                onChange={(value) =>
                  void setParams({
                    trendMeasure: value as "count" | "percentage",
                  })
                }
              >
                <ToggleGroup.Item value="percentage" label="Andel" />
                <ToggleGroup.Item value="count" label="Antall" />
              </ToggleGroup>
            ) : null}
          </div>
        )}

        {selectedField ? (
          <DataFetchBoundary
            title="Kunne ikke hente utviklingen"
            queries={[trendQuery]}
          >
            {trendQuery.isPending && !trend ? (
              <Skeleton variant="rectangle" height={320} />
            ) : trend && buckets.length > 0 ? (
              <VStack gap="space-16">
                {trend.fieldType === "MULTI_CHOICE" &&
                measure === "percentage" ? (
                  <Detail>
                    Andelen beregnes av respondentene som svarte på spørsmålet.
                    Summen kan være over 100 prosent fordi flere valg er mulig.
                  </Detail>
                ) : null}
                {buckets.some((bucket) => bucket.masked) ? (
                  <Alert variant="info" size="small">
                    Perioder med færre enn {trend.privacyThreshold} svar er
                    skjult.
                  </Alert>
                ) : null}
                <QuestionTrendChart
                  trend={trend}
                  buckets={buckets}
                  measure={measure}
                />
                <TrendTable
                  buckets={buckets}
                  fieldType={trend.fieldType}
                  interval={trend.interval}
                  measure={measure}
                  options={trend.options}
                />
              </VStack>
            ) : trend ? (
              <Alert variant="info" size="small">
                Ingen svar på dette spørsmålet innenfor de aktive filtrene.
              </Alert>
            ) : null}
          </DataFetchBoundary>
        ) : null}
      </VStack>
    </DashboardCard>
  );
}
