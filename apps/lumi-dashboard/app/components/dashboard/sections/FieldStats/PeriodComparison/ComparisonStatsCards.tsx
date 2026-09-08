import { ChatIcon, StarIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Button,
  Detail,
  HStack,
  Skeleton,
  VStack,
} from "@navikt/ds-react";
import type { ReactNode } from "react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import statsCardStyles from "~/components/dashboard/sections/StatsCards/StatsCards.module.css";
import { useStats } from "~/hooks/useStats";
import type { FieldStat } from "~/types/api";
import { getRatingSingleIcon, type RatingVariant } from "~/utils/ratingDisplay";
import {
  formatSigned,
  getRatingMetric,
  ratingFieldsAreComparable,
  ratingResponseCount,
} from "./model";
import styles from "./PeriodComparison.module.css";
import { usePreviousPeriodStats } from "./usePreviousPeriodStats";

interface TopMetric {
  icon: ReactNode;
  label: string;
  current: string;
  delta?: string;
  detail: string;
}

function countMetric({
  icon,
  label,
  current,
  previous,
  detail,
}: {
  icon: ReactNode;
  label: string;
  current: number;
  previous?: number;
  detail: string;
}): TopMetric {
  const difference = previous === undefined ? undefined : current - previous;

  return {
    icon,
    label,
    current: current.toLocaleString("nb-NO"),
    delta:
      difference === undefined
        ? undefined
        : difference === 0
          ? "Uendret"
          : formatSigned(difference, 0),
    detail,
  };
}

function findRatingField(fields: FieldStat[] | undefined) {
  const ratings = fields?.filter((field) => field.fieldType === "RATING");
  return ratings?.length === 1 &&
    getRatingMetric(ratings[0]).variant !== "unknown"
    ? ratings[0]
    : undefined;
}

function findPreviousRatingField(
  currentField: FieldStat | undefined,
  previousFields: FieldStat[] | undefined,
) {
  if (!currentField) return undefined;

  return previousFields?.find(
    (field) =>
      field.fieldId === currentField.fieldId && field.fieldType === "RATING",
  );
}

function compactRatingValue(field: FieldStat, variant?: RatingVariant) {
  const metric = getRatingMetric(field, variant);

  if (metric.variant === "thumbs") {
    return `${Math.round(metric.value)} %`;
  }

  if (metric.variant === "nps") {
    return formatSigned(metric.value, 0);
  }

  return metric.value.toLocaleString("nb-NO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function ratingTopMetric(
  currentField: FieldStat,
  previousField: FieldStat | undefined,
): TopMetric {
  const currentMetric = getRatingMetric(currentField);
  const currentCompact = ratingResponseCount(currentField)
    ? compactRatingValue(currentField)
    : "—";
  const comparablePrevious =
    previousField &&
    ratingResponseCount(currentField) > 0 &&
    ratingResponseCount(previousField) > 0 &&
    ratingFieldsAreComparable(currentField, previousField)
      ? previousField
      : undefined;
  const previousMetric = comparablePrevious
    ? getRatingMetric(comparablePrevious)
    : undefined;
  const digits =
    currentMetric.variant === "emoji" || currentMetric.variant === "stars"
      ? 1
      : 0;
  const roundedCurrent = Number(currentMetric.value.toFixed(digits));
  const roundedPrevious = previousMetric
    ? Number(previousMetric.value.toFixed(digits))
    : undefined;
  const difference =
    roundedPrevious === undefined
      ? undefined
      : roundedCurrent - roundedPrevious;
  const deltaUnit =
    currentMetric.variant === "thumbs"
      ? " pp"
      : currentMetric.variant === "nps"
        ? " NPS-poeng"
        : " poeng";
  const delta =
    difference === undefined
      ? undefined
      : difference === 0
        ? "Uendret"
        : `${formatSigned(difference, digits)}${deltaUnit}`;

  if (currentMetric.variant === "thumbs") {
    return {
      icon: <StarIcon fontSize="1.25rem" aria-hidden />,
      label: "Positiv rate",
      current: currentCompact,
      delta,
      detail: "andel positive svar",
    };
  }

  if (currentMetric.variant === "nps") {
    return {
      icon: <StarIcon fontSize="1.25rem" aria-hidden />,
      label: "NPS",
      current: `${currentCompact} NPS`,
      delta,
      detail: "fra −100 til +100",
    };
  }

  const icon = !ratingResponseCount(currentField)
    ? ""
    : currentMetric.variant === "stars"
      ? "⭐"
      : currentMetric.variant === "unknown"
        ? ""
        : getRatingSingleIcon(currentMetric.value, currentMetric.variant);

  return {
    icon: <StarIcon fontSize="1.25rem" aria-hidden />,
    label: "Snitt vurdering",
    current: `${currentCompact} ${icon}`.trim(),
    delta,
    detail: "av 5 mulige",
  };
}

function MetricHeader({ icon, label }: Pick<TopMetric, "icon" | "label">) {
  return (
    <HStack
      gap="space-8"
      align="center"
      className={statsCardStyles.statHeaderRow}
    >
      <span className={statsCardStyles.statIcon}>{icon}</span>
      <BodyShort weight="semibold" textColor="subtle" size="small">
        {label}
      </BodyShort>
    </HStack>
  );
}

function MicroDeltaCard({
  metric,
  comparisonPending,
  showComparison = true,
}: {
  metric: TopMetric;
  comparisonPending: boolean;
  showComparison?: boolean;
}) {
  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-20" }}>
      <MetricHeader icon={metric.icon} label={metric.label} />
      <HStack justify="space-between" align="end" gap="space-12" wrap>
        <div className={statsCardStyles.statValue}>{metric.current}</div>
        {showComparison ? (
          <VStack gap="space-0" align="end" className={styles.microDeltaValue}>
            <Detail>Endring</Detail>
            <BodyShort size="small" weight="semibold">
              {comparisonPending ? (
                <Skeleton variant="text" width={54} height={20} />
              ) : (
                (metric.delta ?? "—")
              )}
            </BodyShort>
          </VStack>
        ) : null}
      </HStack>
      <Detail>{metric.detail}</Detail>
    </DashboardCard>
  );
}

export function ComparisonStatsCards() {
  const { data: stats, isPending, isPlaceholderData } = useStats();
  const previousQuery = usePreviousPeriodStats(true, stats);
  const comparisonActive = previousQuery.comparisonEnabled;
  const comparisonPending = comparisonActive && previousQuery.isPending;

  if (!stats || isPending || isPlaceholderData) {
    return <Skeleton variant="rectangle" height={190} />;
  }

  if (stats.privacy?.masked) {
    return (
      <Alert variant="info" size="small">
        Tallene i den valgte perioden er skjult av personvernhensyn.
      </Alert>
    );
  }

  const periods = previousQuery.periods;
  const previousStats = comparisonActive
    ? previousQuery.comparisonData
    : undefined;
  const comparisonUnavailable = previousQuery.unavailableReason;

  const ratingField =
    stats.surveyType === "rating"
      ? findRatingField(stats.fieldStats)
      : undefined;
  const previousRatingField = findPreviousRatingField(
    ratingField,
    previousStats?.fieldStats,
  );
  const metrics = [
    countMetric({
      icon: <ChatIcon fontSize="1.25rem" aria-hidden />,
      label: "Tilbakemeldinger",
      current: stats.totalCount,
      previous: previousStats?.totalCount,
      detail: "alle innsendinger",
    }),
    ...(ratingField ? [ratingTopMetric(ratingField, previousRatingField)] : []),
  ];

  return (
    <VStack
      gap={{ xs: "space-12", md: "space-16" }}
      data-testid="comparison-key-metrics"
    >
      {periods && comparisonActive ? (
        <span id="period-comparison-periods" className={styles.srOnly}>
          Valgt: {periods.current.label}. Før: {periods.previous.label}. Samme
          filtre gjelder begge perioder.
        </span>
      ) : null}
      {periods &&
      comparisonActive &&
      periods.currentDays !== periods.previousDays ? (
        <Detail>
          Periodene har ulik lengde: {periods.currentDays} mot{" "}
          {periods.previousDays} dager. Det påvirker sammenligningen av antall
          svar.
        </Detail>
      ) : null}

      {comparisonUnavailable ? (
        <Alert
          variant={previousQuery.isError ? "warning" : "info"}
          size="small"
          role={previousQuery.isError ? "alert" : "status"}
        >
          <VStack gap="space-8">
            <BodyShort size="small">
              {comparisonUnavailable}. Tallene gjelder bare valgt periode.
            </BodyShort>
            {previousQuery.isError ? (
              <Button
                size="small"
                variant="secondary"
                onClick={() => void previousQuery.refetch()}
                loading={previousQuery.isFetching}
              >
                Prøv sammenligningen igjen
              </Button>
            ) : null}
          </VStack>
        </Alert>
      ) : null}

      {stats.totalCount === 0 ? (
        <Alert variant="info" size="small">
          Ingen svar i den valgte perioden med disse filtrene.
        </Alert>
      ) : null}

      <DashboardGrid
        columns={{ xs: 1, sm: metrics.length }}
        className={metrics.length === 1 ? styles.singleMetric : undefined}
        gap={{ xs: "space-12", md: "space-16" }}
      >
        {metrics.map((metric) => (
          <MicroDeltaCard
            key={metric.label}
            metric={metric}
            comparisonPending={comparisonPending}
            showComparison={previousQuery.comparisonAvailable}
          />
        ))}
      </DashboardGrid>
    </VStack>
  );
}
