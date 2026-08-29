import {
  Alert,
  BodyShort,
  Heading,
  HStack,
  Select,
  Skeleton,
  Table,
  ToggleGroup,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardCard } from "~/components/dashboard";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type {
  FieldStat,
  FieldTrendGranularity,
  FieldTrendPoint,
} from "~/types/api";
import styles from "./FieldTrend.module.css";

dayjs.extend(isoWeek);

type TrendMeasure = "count" | "percentage";

interface FieldTrendSectionProps {
  /** Standard rating surveys already have a richer marker-enabled trend. */
  excludeRatingFields?: boolean;
}

const LIGHT_SERIES_COLORS = [
  "#005B82",
  "#A86400",
  "#007C2E",
  "#C30000",
  "#634689",
  "#0067C5",
  "#8B5C00",
  "#4C6C00",
];
const DARK_SERIES_COLORS = [
  "#66CBEC",
  "#FFB45B",
  "#5EE082",
  "#FF8C8C",
  "#C8A9FF",
  "#8AC7FF",
  "#F5CE6A",
  "#B4D46A",
];

export function FieldTrendSection({
  excludeRatingFields = false,
}: FieldTrendSectionProps) {
  const statsQuery = useStats();
  const { data: stats, isFetching, isPlaceholderData } = statsQuery;
  const { params, setParams } = useSearchParams();

  const fields = useMemo(
    () =>
      (stats?.fieldStats ?? []).filter(
        (field) =>
          (field.fieldType === "RATING" ||
            field.fieldType === "SINGLE_CHOICE" ||
            field.fieldType === "MULTI_CHOICE") &&
          !(excludeRatingFields && field.fieldType === "RATING"),
      ),
    [excludeRatingFields, stats?.fieldStats],
  );

  const selectedField =
    fields.find((field) => field.fieldId === params.trendFieldId) ?? fields[0];
  const granularity: FieldTrendGranularity = params.trendGranularity ?? "week";
  const measure: TrendMeasure = params.trendMeasure ?? "percentage";

  useEffect(() => {
    if (isPlaceholderData || !selectedField) return;

    const next: {
      trendFieldId?: string;
      trendGranularity?: FieldTrendGranularity;
      trendMeasure?: TrendMeasure;
    } = {};
    if (params.trendFieldId !== selectedField.fieldId) {
      next.trendFieldId = selectedField.fieldId;
    }
    if (!params.trendGranularity) next.trendGranularity = "week";
    if (!params.trendMeasure) next.trendMeasure = "percentage";
    if (Object.keys(next).length > 0) void setParams(next);
  }, [
    isPlaceholderData,
    params.trendFieldId,
    params.trendGranularity,
    params.trendMeasure,
    selectedField,
    setParams,
  ]);

  if (fields.length === 0 || !selectedField) return null;

  const trend = stats?.fieldTrend;
  const trendMatchesSelection =
    trend?.fieldId === selectedField.fieldId &&
    trend.granularity === granularity;
  const showLoading =
    isFetching ||
    !trendMatchesSelection ||
    params.trendFieldId !== selectedField.fieldId;

  return (
    <section aria-labelledby="field-trend-heading">
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-20">
          <VStack gap="space-4">
            <Heading id="field-trend-heading" level="2" size="medium">
              Utvikling per spørsmål
            </Heading>
            <BodyShort textColor="subtle">
              Se hvordan strukturerte svar endrer seg innenfor filtrene og
              perioden du allerede har valgt.
            </BodyShort>
          </VStack>

          <HStack gap="space-16" align="end" wrap className={styles.controls}>
            <Select
              label="Spørsmål"
              size="small"
              value={selectedField.fieldId}
              onChange={(event) =>
                void setParams({ trendFieldId: event.target.value })
              }
              className={styles.fieldSelect}
            >
              {fields.map((field) => (
                <option key={field.fieldId} value={field.fieldId}>
                  {field.label}
                </option>
              ))}
            </Select>

            <ToggleGroup
              label="Tidsoppløsning"
              size="small"
              value={granularity}
              onChange={(value) =>
                void setParams({
                  trendGranularity: value as FieldTrendGranularity,
                })
              }
            >
              <ToggleGroup.Item value="day" label="Dag" />
              <ToggleGroup.Item value="week" label="Uke" />
              <ToggleGroup.Item value="month" label="Måned" />
            </ToggleGroup>

            {selectedField.stats.type === "choice" && (
              <ToggleGroup
                label="Visning"
                size="small"
                value={measure}
                onChange={(value) =>
                  void setParams({ trendMeasure: value as TrendMeasure })
                }
              >
                <ToggleGroup.Item value="percentage" label="Andel" />
                <ToggleGroup.Item value="count" label="Antall" />
              </ToggleGroup>
            )}
          </HStack>

          {showLoading ? (
            <Skeleton variant="rectangle" height={340} />
          ) : (
            <FieldTrendContent
              field={selectedField}
              points={trend?.points ?? []}
              granularity={granularity}
              measure={measure}
            />
          )}
        </VStack>
      </DashboardCard>
    </section>
  );
}

interface FieldTrendContentProps {
  field: FieldStat;
  points: FieldTrendPoint[];
  granularity: FieldTrendGranularity;
  measure: TrendMeasure;
}

type ChartPoint = {
  periodStart: string;
  masked: boolean;
  responseCount: number | null;
  average: number | null;
  [seriesId: string]: string | number | boolean | null;
};

function FieldTrendContent({
  field,
  points,
  granularity,
  measure,
}: FieldTrendContentProps) {
  const { theme } = useTheme();
  const colors = theme === "light" ? LIGHT_SERIES_COLORS : DARK_SERIES_COLORS;
  const choiceDistribution =
    field.stats.type === "choice" ? field.stats.distribution : null;
  const options = choiceDistribution
    ? [
        ...new Set([
          ...Object.keys(choiceDistribution),
          ...points.flatMap((point) => Object.keys(point.distribution)),
        ]),
      ].map((id) => ({
        id,
        label: choiceDistribution[id]?.label ?? id,
      }))
    : [];
  const hasMaskedPoints = points.some((point) => point.masked);
  const visiblePoints = points.filter((point) => !point.masked);
  const chartData: ChartPoint[] = points.map((point) => ({
    periodStart: point.periodStart,
    masked: point.masked,
    responseCount: point.responseCount,
    average: point.average,
    ...Object.fromEntries(
      options.map((option) => {
        const count = point.distribution[option.id] ?? 0;
        const value =
          point.masked || point.responseCount === null
            ? null
            : measure === "percentage"
              ? Math.round((count / point.responseCount) * 1000) / 10
              : count;
        return [option.id, value];
      }),
    ),
  }));

  if (points.length === 0) {
    return (
      <Alert variant="info" size="small">
        Ingen svar på dette spørsmålet i den valgte perioden.
      </Alert>
    );
  }

  if (visiblePoints.length === 0) {
    return (
      <Alert variant="info" size="small">
        Det er for få svar i hvert tidsintervall til å vise utviklingen.
      </Alert>
    );
  }

  const isRating = field.stats.type === "rating";
  const ratingValues =
    field.stats.type === "rating"
      ? Object.keys(field.stats.distribution)
          .map(Number)
          .filter(Number.isFinite)
      : [];
  const ratingMin = ratingValues.includes(0) ? 0 : 1;
  const ratingMax = Math.max(5, ...ratingValues);

  return (
    <VStack gap="space-16">
      {hasMaskedPoints && (
        <Alert variant="info" size="small">
          Noen tidsintervaller er skjult fordi de har færre enn fem svar.
        </Alert>
      )}

      {!isRating && (
        <ul className={styles.legend} aria-label="Svaralternativer">
          {options.map((option, index) => (
            <li key={option.id}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: colors[index % colors.length] }}
                aria-hidden
              />
              {option.label}
            </li>
          ))}
        </ul>
      )}

      {field.fieldType === "MULTI_CHOICE" && measure === "percentage" && (
        <BodyShort size="small" textColor="subtle">
          Andelen viser hvor mange respondenter som valgte hvert alternativ.
          Fordi flere valg er mulig, kan summen være høyere enn 100 prosent.
        </BodyShort>
      )}

      <div className={styles.chart}>
        <ResponsiveContainerWithInitialSize
          width="100%"
          height="100%"
          minWidth={2}
          minHeight={2}
        >
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 20, bottom: 16, left: 4 }}
            role="img"
            aria-label={chartAriaLabel(field, granularity, measure)}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--ax-border-neutral-subtle)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="periodStart"
              tickFormatter={(value) => formatPeriod(value, granularity)}
              tick={{ fill: "var(--ax-text-neutral-subtle)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={isRating ? [ratingMin, ratingMax] : [0, "auto"]}
              tickFormatter={(value) =>
                !isRating && measure === "percentage" ? `${value}%` : `${value}`
              }
              tick={{ fill: "var(--ax-text-neutral-subtle)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const point = payload[0].payload as ChartPoint;
                return (
                  <div className={styles.tooltip}>
                    <strong>
                      {formatPeriodLong(point.periodStart, granularity)}
                    </strong>
                    {point.masked ? (
                      <span>For få svar til å vise verdier</span>
                    ) : isRating ? (
                      <>
                        <span>Gjennomsnitt: {point.average?.toFixed(1)}</span>
                        <span>{point.responseCount} svar</span>
                      </>
                    ) : (
                      options.map((option) => (
                        <span key={option.id}>
                          {option.label}:{" "}
                          {formatChoiceValue(point[option.id], measure)}
                        </span>
                      ))
                    )}
                  </div>
                );
              }}
            />
            {isRating ? (
              <Line
                type="monotone"
                dataKey="average"
                name="Gjennomsnitt"
                connectNulls={false}
                stroke={colors[0]}
                strokeWidth={3}
                dot={{ r: 4, fill: colors[0], strokeWidth: 0 }}
                activeDot={{ r: 6, fill: colors[0] }}
              />
            ) : (
              options.map((option, index) => (
                <Line
                  key={option.id}
                  type="monotone"
                  dataKey={option.id}
                  name={option.label}
                  connectNulls={false}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2.5}
                  dot={{
                    r: 3.5,
                    fill: colors[index % colors.length],
                    strokeWidth: 0,
                  }}
                  activeDot={{ r: 5, fill: colors[index % colors.length] }}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainerWithInitialSize>
      </div>

      <details className={styles.tableDisclosure}>
        <summary>Vis data som tabell</summary>
        <div className={styles.tableScroll}>
          <TrendTable
            field={field}
            points={points}
            options={options}
            granularity={granularity}
            measure={measure}
          />
        </div>
      </details>
    </VStack>
  );
}

interface TrendTableProps extends FieldTrendContentProps {
  options: Array<{ id: string; label: string }>;
}

function TrendTable({
  field,
  points,
  options,
  granularity,
  measure,
}: TrendTableProps) {
  const isRating = field.stats.type === "rating";
  return (
    <Table size="small">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Periode</Table.HeaderCell>
          {isRating ? (
            <>
              <Table.HeaderCell align="right">Gjennomsnitt</Table.HeaderCell>
              <Table.HeaderCell align="right">Svar</Table.HeaderCell>
            </>
          ) : (
            options.map((option) => (
              <Table.HeaderCell key={option.id} align="right">
                {option.label}
              </Table.HeaderCell>
            ))
          )}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {points.map((point) => (
          <Table.Row key={point.periodStart}>
            <Table.HeaderCell scope="row">
              {formatPeriodLong(point.periodStart, granularity)}
            </Table.HeaderCell>
            {point.masked ? (
              <Table.DataCell
                colSpan={isRating ? 2 : Math.max(1, options.length)}
              >
                Skjult – færre enn fem svar
              </Table.DataCell>
            ) : isRating ? (
              <>
                <Table.DataCell align="right">
                  {point.average?.toLocaleString("no-NO", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </Table.DataCell>
                <Table.DataCell align="right">
                  {point.responseCount?.toLocaleString("no-NO")}
                </Table.DataCell>
              </>
            ) : (
              options.map((option) => {
                const count = point.distribution[option.id] ?? 0;
                const value =
                  measure === "percentage" && point.responseCount
                    ? (count / point.responseCount) * 100
                    : count;
                return (
                  <Table.DataCell key={option.id} align="right">
                    {measure === "percentage"
                      ? `${value.toLocaleString("no-NO", { maximumFractionDigits: 1 })} %`
                      : value.toLocaleString("no-NO")}
                  </Table.DataCell>
                );
              })
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function chartAriaLabel(
  field: FieldStat,
  granularity: FieldTrendGranularity,
  measure: TrendMeasure,
): string {
  const interval = { day: "dag", week: "uke", month: "måned" }[granularity];
  if (field.stats.type === "rating") {
    return `Linjediagram med gjennomsnittlig vurdering per ${interval} for ${field.label}`;
  }
  return `Linjediagram med ${measure === "percentage" ? "andel" : "antall"} svar per ${interval} for ${field.label}`;
}

function formatChoiceValue(value: unknown, measure: TrendMeasure): string {
  if (typeof value !== "number") return "–";
  return measure === "percentage"
    ? `${value.toLocaleString("no-NO", { maximumFractionDigits: 1 })} %`
    : value.toLocaleString("no-NO");
}

function formatPeriod(value: string, granularity: FieldTrendGranularity) {
  if (granularity === "month") return dayjs(value).format("MM.YY");
  if (granularity === "week") return `Uke ${dayjs(value).isoWeek()}`;
  return dayjs(value).format("DD.MM");
}

function formatPeriodLong(value: string, granularity: FieldTrendGranularity) {
  if (granularity === "month") {
    return new Intl.DateTimeFormat("no-NO", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Oslo",
    }).format(new Date(`${value}T12:00:00Z`));
  }
  if (granularity === "week") {
    return `${dayjs(value).format("DD.MM.YYYY")}–${dayjs(value).add(6, "day").format("DD.MM.YYYY")}`;
  }
  return dayjs(value).format("DD.MM.YYYY");
}
