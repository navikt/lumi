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
import { useEffect, useMemo } from "react";
import { DashboardCard } from "~/components/dashboard/DashboardCard";
import {
  PARTIAL_DOT_LOOK,
  PARTIAL_DOTS_LOOK,
} from "~/components/shared/Charts/timeSeriesParts";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useQuestionTrend } from "~/hooks/useQuestionTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSeriesWindow } from "~/hooks/useSeriesWindow";
import { useStats } from "~/hooks/useStats";
import type { QuestionTrendBucket, QuestionTrendResponse } from "~/types/api";
import {
  buildTimeAxis,
  describePartialBuckets,
  INTERVAL_NOUNS,
} from "~/utils/timeBuckets";
import { QuestionTrendChart } from "./QuestionTrendChart";
import styles from "./QuestionTrendSection.module.css";
import {
  type QuestionPoint,
  questionPointHasValue,
  questionSeries,
  questionTrendChoiceValue,
  questionTrendRatingMetric,
  questionTrendRatingValue,
} from "./questionTrendUtils";

const SUPPORTED_FIELD_TYPES = new Set([
  "RATING",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
]);

function TrendTable({
  points,
  trend,
  measure,
  options,
}: {
  points: QuestionPoint[];
  trend: QuestionTrendResponse;
  measure: "count" | "percentage";
  options: Array<{ id: string; label: string }>;
}) {
  const isRating = trend.fieldType === "RATING";
  const metric = questionTrendRatingMetric(trend);
  const cellValue = (bucket: QuestionTrendBucket, optionId: string) => {
    if (bucket.masked) return "Skjult";
    const value = questionTrendChoiceValue(bucket, optionId, measure);
    if (value === null) return "–";
    return measure === "percentage"
      ? `${value.toLocaleString("nb-NO")} %`
      : value;
  };

  return (
    <div className={styles.tableViewport}>
      <Table
        size="small"
        className={styles.table}
        aria-label={`Utvikling per ${INTERVAL_NOUNS[trend.interval].one}`}
      >
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Periode</Table.HeaderCell>
            {isRating ? (
              <Table.HeaderCell align="right">{metric.label}</Table.HeaderCell>
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
          {points.map(({ bucket, label, start }) => (
            <Table.Row key={start}>
              <Table.HeaderCell scope="row">{label}</Table.HeaderCell>
              {isRating ? (
                <Table.DataCell
                  align="right"
                  className={bucket.masked ? styles.maskedCell : undefined}
                >
                  {bucket.masked
                    ? "Skjult"
                    : (questionTrendRatingValue(trend, bucket)?.toLocaleString(
                        "nb-NO",
                        {
                          maximumFractionDigits: 2,
                        },
                      ) ?? "–")}
                  {!bucket.masked &&
                  questionTrendRatingValue(trend, bucket) !== null
                    ? metric.unit
                    : null}
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

export function QuestionTrendSection({
  surface = "card",
  showHeading = true,
}: {
  surface?: "card" | "plain";
  showHeading?: boolean;
} = {}) {
  const { params, setParams } = useSearchParams();
  const statsQuery = useStats();
  const structuredFields = (statsQuery.data?.fieldStats ?? []).filter((field) =>
    SUPPORTED_FIELD_TYPES.has(field.fieldType),
  );
  const selectedField = structuredFields.find(
    (field) => field.fieldId === params.trendField,
  );
  const { window, interval: periodInterval } = useSeriesWindow();
  // Without a choice of their own, viewers get the same resolution as the
  // other time series for this period.
  const interval = params.trendInterval ?? periodInterval;
  const measure = params.trendMeasure ?? "percentage";
  const trendEnabled =
    Boolean(selectedField && window) && !statsQuery.isPlaceholderData;
  const trendQuery = useQuestionTrend(trendEnabled, undefined, interval);
  const trend = trendQuery.data;
  const series = useMemo(
    () =>
      trend && window
        ? questionSeries(buildTimeAxis(window, trend.interval), trend)
        : undefined,
    [trend, window],
  );
  // The sentence names exactly the buckets that get a hollow point.
  const partialNote = useMemo(
    () =>
      trend && series
        ? describePartialBuckets(
            series.points.filter(
              (point) =>
                point.partial &&
                questionPointHasValue(trend, point.bucket, measure),
            ),
            series.interval,
            trend.fieldType === "RATING" || trend.options.length === 1
              ? PARTIAL_DOT_LOOK
              : PARTIAL_DOTS_LOOK,
            series.withYear,
          )
        : undefined,
    [trend, series, measure],
  );

  useEffect(() => {
    if (
      !statsQuery.isPending &&
      !statsQuery.isPlaceholderData &&
      params.trendField &&
      !structuredFields.some((field) => field.fieldId === params.trendField)
    ) {
      void setParams({
        trendField: undefined,
        trendInterval: undefined,
        trendMeasure: undefined,
      });
    }
  }, [
    params.trendField,
    setParams,
    statsQuery.isPending,
    statsQuery.isPlaceholderData,
    structuredFields,
  ]);

  if (!params.surveyId) return null;

  const content = (
    <VStack gap="space-20">
      {showHeading ? (
        <VStack gap="space-4">
          <Heading level="2" size="medium">
            Utvikling over tid
          </Heading>
          <BodyShort textColor="subtle">
            Følg svarene på ett strukturert spørsmål innenfor de aktive
            filtrene.
          </BodyShort>
        </VStack>
      ) : (
        <BodyShort textColor="subtle">
          Følg svarene på ett strukturert spørsmål innenfor de aktive
          analysefiltrene.
        </BodyShort>
      )}

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
                // Only an interval the viewer chose is kept in the link.
                trendInterval: fieldId ? params.trendInterval : undefined,
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
          {statsQuery.isPending ||
          statsQuery.isPlaceholderData ||
          (trendEnabled && trendQuery.isPending) ? (
            <Skeleton variant="rectangle" height={320} />
          ) : trend &&
            series?.points.some(
              (point) =>
                point.bucket.masked || (point.bucket.responseCount ?? 0) > 0,
            ) ? (
            <VStack gap="space-16">
              {trend.fieldType === "MULTI_CHOICE" &&
              measure === "percentage" ? (
                <Detail>
                  Andelen beregnes av respondentene som svarte på spørsmålet.
                  Summen kan være over 100 prosent fordi flere valg er mulig.
                </Detail>
              ) : null}
              {series.points.some((point) => point.bucket.masked) ? (
                <Alert variant="info" size="small">
                  Perioder med færre enn {trend.privacyThreshold} svar er
                  skjult.
                </Alert>
              ) : null}
              <QuestionTrendChart
                trend={trend}
                points={series.points}
                measure={measure}
              />
              {partialNote ? (
                <Detail textColor="subtle">{partialNote}</Detail>
              ) : null}
              <TrendTable
                points={series.points}
                trend={trend}
                measure={measure}
                options={trend.options}
              />
            </VStack>
          ) : (
            <Alert variant="info" size="small">
              Ingen svar på dette spørsmålet innenfor de aktive filtrene.
            </Alert>
          )}
        </DataFetchBoundary>
      ) : null}
    </VStack>
  );

  if (surface === "plain") {
    return <div data-testid="question-trend-section">{content}</div>;
  }

  return (
    <DashboardCard as="section" data-testid="question-trend-section">
      {content}
    </DashboardCard>
  );
}
