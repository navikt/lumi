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
import { useFieldTrend } from "~/hooks/useFieldTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import type {
  FieldTrendField,
  FieldTrendGranularity,
  FieldTrendPoint,
} from "~/types/api";
import styles from "./FieldTrend.module.css";

dayjs.extend(isoWeek);

type TrendMeasure = "count" | "percentage";

const MAX_VISIBLE_SERIES = 8;
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

export function FieldTrendSection() {
  const trendQuery = useFieldTrend();
  const { data, error, isPending, isFetching, isPlaceholderData } = trendQuery;
  const { params, setParams } = useSearchParams();
  const fields = data?.fields ?? [];
  const granularity: FieldTrendGranularity = params.trendGranularity ?? "week";
  const measure: TrendMeasure = params.trendMeasure ?? "percentage";
  const selectedField = useMemo(
    () =>
      fields.find((field) => field.fieldId === data?.trend?.fieldId) ??
      fields[0],
    [data?.trend?.fieldId, fields],
  );

  useEffect(() => {
    if (isPlaceholderData || !selectedField) return;

    const next: {
      trendFieldId?: string;
      trendGranularity?: FieldTrendGranularity;
      trendMeasure?: TrendMeasure;
      trendOptionId?: string;
    } = {};
    if (params.trendFieldId !== selectedField.fieldId) {
      next.trendFieldId = selectedField.fieldId;
      next.trendOptionId = undefined;
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

  const blockingError = error && !data;
  if (!isPending && !blockingError && fields.length === 0) return null;

  const trendMatchesSelection = Boolean(
    data?.trend &&
      selectedField &&
      data.trend.fieldId === selectedField.fieldId &&
      data.trend.granularity === granularity,
  );
  const showLoading =
    isPending || isPlaceholderData || (isFetching && !trendMatchesSelection);

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

          {blockingError ? (
            <Alert variant="error" size="small">
              Vi klarte ikke å hente utviklingen akkurat nå. Prøv igjen senere.
            </Alert>
          ) : showLoading || !selectedField ? (
            <Skeleton variant="rectangle" height={340} />
          ) : (
            <>
              {error && data && (
                <Alert variant="warning" size="small">
                  Oppdateringen feilet. Vi viser sist hentede utvikling.
                </Alert>
              )}
              <HStack
                gap="space-16"
                align="end"
                wrap
                className={styles.controls}
              >
                <Select
                  label="Spørsmål"
                  size="small"
                  value={selectedField.fieldId}
                  onChange={(event) =>
                    void setParams({
                      trendFieldId: event.target.value,
                      trendOptionId: undefined,
                    })
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

                {selectedField.fieldType !== "RATING" && (
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

              <FieldTrendContent
                key={selectedField.fieldId}
                field={selectedField}
                points={data?.trend?.points ?? []}
                granularity={granularity}
                measure={measure}
                privacyThreshold={data?.privacyThreshold ?? 5}
                selectedOptionId={params.trendOptionId}
                onSelectedOptionChange={(trendOptionId) =>
                  void setParams({ trendOptionId })
                }
              />
            </>
          )}
        </VStack>
      </DashboardCard>
    </section>
  );
}

interface FieldTrendContentProps {
  field: FieldTrendField;
  points: FieldTrendPoint[];
  granularity: FieldTrendGranularity;
  measure: TrendMeasure;
  privacyThreshold: number;
  selectedOptionId?: string;
  onSelectedOptionChange: (optionId: string | undefined) => void;
}

type TrendOption = {
  id: string;
  label: string;
  seriesKey: string;
};

type ChartPoint = Record<string, string | number | boolean | null> & {
  periodStart: string;
  masked: boolean;
  empty: boolean;
  responseCount: number | null;
  average: number | null;
};

function FieldTrendContent({
  field,
  points,
  granularity,
  measure,
  privacyThreshold,
  selectedOptionId,
  onSelectedOptionChange,
}: FieldTrendContentProps) {
  const { theme } = useTheme();
  const colors = theme === "light" ? LIGHT_SERIES_COLORS : DARK_SERIES_COLORS;
  const allOptions = useMemo(() => {
    const labels = new Map(
      field.options.map((option) => [option.id, option.label]),
    );
    for (const point of points) {
      for (const optionId of Object.keys(point.distribution)) {
        if (!labels.has(optionId)) labels.set(optionId, optionId);
      }
    }
    return [...labels].map(([id, label], index) => ({
      id,
      label,
      seriesKey: `series_${index}`,
    }));
  }, [field.options, points]);
  const selectedOption =
    allOptions.find((option) => option.id === selectedOptionId) ??
    allOptions[0];
  const visibleOptions =
    allOptions.length > MAX_VISIBLE_SERIES
      ? selectedOption
        ? [selectedOption]
        : []
      : allOptions;
  useEffect(() => {
    const canonicalOptionId =
      allOptions.length > MAX_VISIBLE_SERIES ? selectedOption?.id : undefined;
    if (selectedOptionId !== canonicalOptionId) {
      onSelectedOptionChange(canonicalOptionId);
    }
  }, [
    allOptions.length,
    onSelectedOptionChange,
    selectedOption,
    selectedOptionId,
  ]);
  const hasMaskedPoints = points.some((point) => point.masked);
  const hasDataPoints = points.some((point) => !point.masked && !point.empty);
  const hasAnyAnswers = points.some((point) => !point.empty);
  const chartData: ChartPoint[] = points.map((point) => ({
    periodStart: point.periodStart,
    masked: point.masked,
    empty: point.empty,
    responseCount: point.responseCount,
    average: point.empty ? null : point.average,
    ...Object.fromEntries(
      allOptions.map((option) => {
        const count = point.distribution[option.id] ?? 0;
        const value =
          point.masked || point.empty || point.responseCount === null
            ? null
            : measure === "percentage"
              ? Math.round((count / point.responseCount) * 1000) / 10
              : count;
        return [option.seriesKey, value];
      }),
    ),
  }));

  if (!hasAnyAnswers) {
    return (
      <Alert variant="info" size="small">
        Ingen svar på dette spørsmålet i den valgte perioden.
      </Alert>
    );
  }

  if (!hasDataPoints) {
    return (
      <Alert variant="info" size="small">
        Det er for få svar i hvert tidsintervall til å vise utviklingen.
      </Alert>
    );
  }

  const isRating = field.fieldType === "RATING";

  return (
    <VStack gap="space-16">
      {hasMaskedPoints && (
        <Alert variant="info" size="small">
          Noen tidsintervaller er skjult fordi de har færre enn{" "}
          {privacyThreshold} svar.
        </Alert>
      )}

      {!isRating && allOptions.length > MAX_VISIBLE_SERIES && (
        <Select
          label="Svaralternativ i grafen"
          description={`Grafen viser ett alternativ om gangen fordi spørsmålet har ${allOptions.length} alternativer. Tabellen viser alle.`}
          size="small"
          value={selectedOption?.id}
          onChange={(event) => onSelectedOptionChange(event.target.value)}
          className={styles.seriesSelect}
        >
          {allOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      )}

      {!isRating && (
        <ul className={styles.legend} aria-label="Svaralternativer">
          {visibleOptions.map((option, index) => (
            <li key={option.id}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: colors[index] }}
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
            aria-label={chartAriaLabel(
              field,
              granularity,
              measure,
              allOptions.length > MAX_VISIBLE_SERIES
                ? selectedOption?.label
                : undefined,
            )}
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
              allowDecimals={isRating || measure === "percentage"}
              domain={
                isRating
                  ? [field.ratingMin ?? 1, field.ratingMax ?? 5]
                  : [0, "auto"]
              }
              tickFormatter={(value) =>
                !isRating && measure === "percentage" ? `${value}%` : `${value}`
              }
              tick={{ fill: "var(--ax-text-neutral-subtle)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              filterNull={false}
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
                    ) : point.empty ? (
                      <span>Ingen svar</span>
                    ) : isRating ? (
                      <>
                        <span>Gjennomsnitt: {point.average?.toFixed(1)}</span>
                        <span>{point.responseCount} svar</span>
                      </>
                    ) : (
                      visibleOptions.map((option) => (
                        <span key={option.id}>
                          {option.label}:{" "}
                          {formatChoiceValue(point[option.seriesKey], measure)}
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
              visibleOptions.map((option, index) => (
                <Line
                  key={option.id}
                  type="monotone"
                  dataKey={option.seriesKey}
                  name={option.label}
                  connectNulls={false}
                  stroke={colors[index]}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: colors[index], strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: colors[index] }}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainerWithInitialSize>
      </div>

      <details className={styles.tableDisclosure}>
        <summary>Vis data som tabell</summary>
        <section className={styles.tableScroll} aria-label="Trenddata i tabell">
          <TrendTable
            field={field}
            points={points}
            options={allOptions}
            granularity={granularity}
            measure={measure}
            privacyThreshold={privacyThreshold}
          />
        </section>
      </details>
    </VStack>
  );
}

interface TrendTableProps
  extends Omit<
    FieldTrendContentProps,
    "selectedOptionId" | "onSelectedOptionChange"
  > {
  options: TrendOption[];
}

function TrendTable({
  field,
  points,
  options,
  granularity,
  measure,
  privacyThreshold,
}: TrendTableProps) {
  const isRating = field.fieldType === "RATING";
  return (
    <Table size="small" tabIndex={0}>
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
            {point.empty ? (
              <Table.DataCell
                colSpan={isRating ? 2 : Math.max(1, options.length)}
              >
                Ingen svar
              </Table.DataCell>
            ) : point.masked ? (
              <Table.DataCell
                colSpan={isRating ? 2 : Math.max(1, options.length)}
              >
                Skjult – færre enn {privacyThreshold} svar
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
  field: FieldTrendField,
  granularity: FieldTrendGranularity,
  measure: TrendMeasure,
  visibleOptionLabel?: string,
): string {
  const interval = { day: "dag", week: "uke", month: "måned" }[granularity];
  if (field.fieldType === "RATING") {
    return `Linjediagram med gjennomsnittlig vurdering per ${interval} for ${field.label}`;
  }
  const option = visibleOptionLabel
    ? `, svaralternativ ${visibleOptionLabel}`
    : "";
  return `Linjediagram med ${measure === "percentage" ? "andel" : "antall"} svar per ${interval} for ${field.label}${option}`;
}

function formatChoiceValue(value: unknown, measure: TrendMeasure): string {
  if (typeof value !== "number") return "–";
  return measure === "percentage"
    ? `${value.toLocaleString("no-NO", { maximumFractionDigits: 1 })} %`
    : value.toLocaleString("no-NO");
}

function formatPeriod(value: string, granularity: FieldTrendGranularity) {
  if (granularity === "month") return dayjs(value).format("MM.YY");
  if (granularity === "week") {
    const period = dayjs(value);
    return `Uke ${period.isoWeek()}, ${period.isoWeekYear()}`;
  }
  return dayjs(value).format("DD.MM.YY");
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
