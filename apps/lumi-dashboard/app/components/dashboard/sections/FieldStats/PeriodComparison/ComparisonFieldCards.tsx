import { ChatElipsisIcon, LineGraphIcon, StarIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  Detail,
  Heading,
  HStack,
  Skeleton,
  Tag,
  VStack,
} from "@navikt/ds-react";
import type { ReactNode } from "react";
import { DashboardCard } from "~/components/dashboard";
import { useRatingFilter } from "~/hooks/useRatingFilter";
import type {
  ChoiceStats,
  FieldStat,
  RatingStats,
  TextStats,
} from "~/types/api";
import choiceStyles from "../FieldCards/ChoiceFieldCard.module.css";
import { RatingBars } from "../FieldCards/Rating/RatingBars";
import { ThumbsDrilldown } from "../FieldCards/Rating/ThumbsDrilldown";
import { TextFieldCard } from "../FieldCards/TextFieldCard";
import {
  choiceResponseCount,
  formatSigned,
  getRatingMetric,
  ratingFieldsAreComparable,
  ratingResponseCount,
} from "./model";
import styles from "./PeriodComparison.module.css";

interface ComparisonCardProps {
  field: FieldStat;
  previousField?: FieldStat;
  currentTotalCount: number;
  previousTotalCount: number;
  comparisonEnabled: boolean;
  comparisonPending: boolean;
  onShowTrend: (field: FieldStat) => void;
}

function responseBasisSubtitle(
  current: number,
  previous: number | undefined,
  pending: boolean,
) {
  const label = `${current.toLocaleString("nb-NO")} svar`;
  return pending || previous === undefined
    ? label
    : `${label} · før ${previous.toLocaleString("nb-NO")}`;
}

function FieldCardHeader({
  headingId,
  icon,
  label,
  subtitle,
}: {
  headingId: string;
  icon: ReactNode;
  label: string;
  subtitle: string;
}) {
  return (
    <HStack gap="space-8" align="start" marginBlock="space-0 space-8">
      {icon}
      <VStack gap="space-0">
        <Heading id={headingId} level="3" size="xsmall">
          {label}
        </Heading>
        <BodyShort size="small" textColor="subtle">
          {subtitle}
        </BodyShort>
      </VStack>
    </HStack>
  );
}

function TrendAction({
  field,
  onClick,
}: {
  field: FieldStat;
  onClick: (field: FieldStat) => void;
}) {
  return (
    <Button
      type="button"
      variant="tertiary"
      size="small"
      icon={<LineGraphIcon aria-hidden />}
      onClick={() => onClick(field)}
      className={styles.trendAction}
      aria-label={`Se utvikling for ${field.label}`}
    >
      Se utvikling
    </Button>
  );
}

function PendingValue({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return pending ? (
    <Skeleton variant="text" width={44} height={20} />
  ) : (
    children
  );
}

function FieldComparisonMatrix({
  label,
  row,
}: {
  label: string;
  row: {
    label: string;
    current: ReactNode;
    previous: ReactNode;
    delta: ReactNode;
  };
}) {
  return (
    <table
      className={styles.fieldMatrix}
      aria-label={label}
      aria-describedby="period-comparison-periods"
    >
      <thead>
        <tr>
          <th scope="col">Måling</th>
          <th scope="col">Valgt</th>
          <th scope="col">Før</th>
          <th scope="col">Endring</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">{row.label}</th>
          <td className={styles.fieldMatrixCurrent} data-label="Valgt">
            {row.current}
          </td>
          <td data-label="Før">{row.previous}</td>
          <td data-label="Endring">{row.delta}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function ComparisonRatingFieldCard({
  field,
  previousField,
  currentTotalCount: _currentTotalCount,
  comparisonEnabled,
  comparisonPending,
  onShowTrend,
}: ComparisonCardProps) {
  const { activeFilters, toggleRating, removeRating } = useRatingFilter();
  const stats = field.stats as RatingStats;
  const metric = getRatingMetric(field);
  const count = ratingResponseCount(field);
  const previousCount = previousField
    ? ratingResponseCount(previousField)
    : undefined;
  const comparable =
    count > 0 &&
    previousCount &&
    previousField &&
    ratingFieldsAreComparable(field, previousField)
      ? getRatingMetric(previousField)
      : undefined;
  const digits =
    metric.variant === "nps" || metric.variant === "thumbs" ? 0 : 1;
  const difference = comparable
    ? Number(metric.value.toFixed(digits)) -
      Number(comparable.value.toFixed(digits))
    : undefined;
  const unit = metric.unit === "prosentpoeng" ? "pp" : metric.unit;
  const delta =
    difference === undefined
      ? "—"
      : difference === 0
        ? "Uendret"
        : `${formatSigned(difference, digits)} ${unit}`;
  const activeRating = activeFilters[field.fieldId];
  const parsedActiveRating = Number(activeRating);
  const values =
    metric.variant === "nps"
      ? [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      : metric.variant === "thumbs"
        ? [2, 1]
        : [5, 4, 3, 2, 1];
  const headingId = `comparison-field-${field.fieldId}`;

  return (
    <DashboardCard
      as="section"
      aria-labelledby={headingId}
      padding="space-20"
      className={styles.fieldCard}
    >
      <FieldCardHeader
        headingId={headingId}
        icon={<StarIcon fontSize="var(--ax-font-size-xlarge)" aria-hidden />}
        label={field.label}
        subtitle={responseBasisSubtitle(
          count,
          comparisonEnabled ? previousCount : undefined,
          comparisonPending,
        )}
      />
      {comparisonEnabled ? (
        <FieldComparisonMatrix
          label={`Sammenligning: ${metric.label}`}
          row={{
            label: metric.label,
            current: count ? metric.formatted : "—",
            previous: (
              <PendingValue pending={comparisonPending}>
                {comparable?.formatted ?? "—"}
              </PendingValue>
            ),
            delta: (
              <PendingValue pending={comparisonPending}>{delta}</PendingValue>
            ),
          }}
        />
      ) : (
        <VStack gap="space-2" marginBlock="space-4 space-0">
          <Detail>{metric.label}</Detail>
          <span className={styles.summaryValue}>
            {count ? metric.formatted : "—"}
          </span>
        </VStack>
      )}
      {activeRating !== undefined ? (
        <Detail>
          Filtrert til vurdering {activeRating}. Sammenligningen gjelder bare
          denne verdien.
        </Detail>
      ) : null}
      {metric.variant === "unknown" ? (
        <VStack gap="space-4">
          <Detail>Skalaen er ukjent for disse svarene.</Detail>
          {Object.entries(stats.distribution)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([value, responses]) => (
              <Button
                key={value}
                size="small"
                variant="tertiary"
                aria-pressed={activeRating === value}
                onClick={() => toggleRating(field.fieldId, value)}
              >
                Verdi {value}: {responses.toLocaleString("nb-NO")} svar
              </Button>
            ))}
        </VStack>
      ) : metric.variant === "thumbs" ? (
        <ThumbsDrilldown
          fieldId={field.fieldId}
          distribution={stats.distribution}
          fieldTotalResponses={count}
          activeRatingValue={activeRating}
          isFilteringThisField={activeRating !== undefined}
          onSelect={(value) => toggleRating(field.fieldId, value)}
          onClear={() => removeRating(field.fieldId)}
        />
      ) : (
        <RatingBars
          variant={metric.variant}
          distribution={stats.distribution}
          ratingValues={values}
          activeRatingValue={
            Number.isFinite(parsedActiveRating) ? parsedActiveRating : undefined
          }
          onRatingSelect={(value) => toggleRating(field.fieldId, String(value))}
          onRatingClear={() => removeRating(field.fieldId)}
        />
      )}
      <TrendAction field={field} onClick={onShowTrend} />
    </DashboardCard>
  );
}

const CHOICE_BAR_CLASSES = [
  choiceStyles.choiceBarBlue,
  choiceStyles.choiceBarGreen,
  choiceStyles.choiceBarAmber,
  choiceStyles.choiceBarPurple,
  choiceStyles.choiceBarPink,
  choiceStyles.choiceBarCyan,
];

export function ComparisonChoiceFieldCard({
  field,
  previousField,
  currentTotalCount,
  previousTotalCount,
  comparisonEnabled,
  comparisonPending,
  onShowTrend,
  activeChoiceValue,
  onChoiceSelect,
  onChoiceClear,
}: ComparisonCardProps & {
  activeChoiceValue?: string;
  onChoiceSelect: (id: string) => void;
  onChoiceClear: () => void;
}) {
  const stats = field.stats as ChoiceStats;
  const previousStats = previousField?.stats as ChoiceStats | undefined;
  const count = choiceResponseCount(field, currentTotalCount);
  const previousCount = previousField
    ? choiceResponseCount(previousField, previousTotalCount)
    : undefined;
  const choices = Object.entries(stats.distribution).map(([id, value]) => ({
    id,
    ...value,
  }));
  const activeLabel = choices.find(
    (choice) => choice.id === activeChoiceValue,
  )?.label;
  const headingId = `comparison-field-${field.fieldId}`;
  return (
    <DashboardCard
      as="section"
      aria-labelledby={headingId}
      padding="space-20"
      className={styles.fieldCard}
    >
      <FieldCardHeader
        headingId={headingId}
        icon={
          <ChatElipsisIcon fontSize="var(--ax-font-size-xlarge)" aria-hidden />
        }
        label={field.label}
        subtitle={responseBasisSubtitle(
          count,
          comparisonEnabled ? previousCount : undefined,
          comparisonPending,
        )}
      />
      <HStack gap="space-8" wrap marginBlock="space-0 space-8">
        {field.fieldType === "MULTI_CHOICE" ? (
          <Tag data-color="neutral" variant="outline" size="small">
            Flere svar mulig
          </Tag>
        ) : null}
        {activeChoiceValue ? (
          <Detail>Filtrert til «{activeLabel ?? activeChoiceValue}»</Detail>
        ) : null}
      </HStack>
      {comparisonEnabled ? (
        <div
          className={`${styles.matrixChoiceGrid} ${styles.choiceColumnHeader}`}
          aria-hidden
        >
          <span />
          <Detail>Valgt</Detail>
          <Detail>Før</Detail>
          <Detail>Endring</Detail>
        </div>
      ) : null}
      <VStack gap="space-8">
        {choices.map((choice, index) => {
          const previous = previousCount
            ? previousStats?.distribution[choice.id]
            : undefined;
          const difference =
            count && previous
              ? choice.percentage - previous.percentage
              : undefined;
          const delta =
            difference === undefined
              ? "—"
              : Math.round(difference) === 0
                ? "Uendret"
                : `${formatSigned(difference, 0)} pp`;
          const isActive = activeChoiceValue === choice.id;
          const accessibleComparison =
            comparisonEnabled && previous
              ? ` Perioden før: ${previous.count} svar, ${previous.percentage} prosent. Forskjell ${delta}.`
              : "";
          return (
            <button
              key={choice.id}
              type="button"
              className={`${choiceStyles.choiceButton} ${styles.comparisonChoiceButton} ${activeChoiceValue && !isActive ? choiceStyles.choiceButtonInactive : ""}`}
              onClick={() => onChoiceSelect(choice.id)}
              aria-pressed={isActive}
              aria-label={`Filtrer på ${choice.label}. Valgt periode: ${choice.count} svar, ${count ? choice.percentage : "ingen"} prosent.${accessibleComparison}`}
            >
              <VStack gap="space-4" width="100%">
                <div
                  className={
                    comparisonEnabled
                      ? styles.matrixChoiceGrid
                      : styles.layerChoiceGrid
                  }
                >
                  <BodyShort
                    size="small"
                    className={styles.comparisonChoiceLabel}
                  >
                    {choice.label}
                  </BodyShort>
                  <BodyShort size="small" weight="semibold">
                    {count ? `${choice.percentage} %` : "—"}
                  </BodyShort>
                  {comparisonEnabled ? (
                    <>
                      <BodyShort size="small" textColor="subtle">
                        <PendingValue pending={comparisonPending}>
                          {previous ? `${previous.percentage} %` : "—"}
                        </PendingValue>
                      </BodyShort>
                      <BodyShort size="small">
                        <PendingValue pending={comparisonPending}>
                          {delta}
                        </PendingValue>
                      </BodyShort>
                    </>
                  ) : null}
                </div>
                {!comparisonEnabled ? (
                  <progress
                    className={`${choiceStyles.choiceBar} ${CHOICE_BAR_CLASSES[index % CHOICE_BAR_CLASSES.length]}`}
                    value={choice.percentage}
                    max={100}
                    aria-hidden
                  />
                ) : null}
              </VStack>
            </button>
          );
        })}
      </VStack>
      <HStack
        justify="space-between"
        align="center"
        marginBlock="space-8 space-0"
      >
        {activeChoiceValue ? (
          <Button variant="tertiary" size="xsmall" onClick={onChoiceClear}>
            Nullstill filter
          </Button>
        ) : (
          <span />
        )}
        <TrendAction field={field} onClick={onShowTrend} />
      </HStack>
    </DashboardCard>
  );
}

export function ComparisonTextFieldCard({
  field,
  previousField,
  currentTotalCount,
  comparisonEnabled,
  comparisonPending,
}: Omit<ComparisonCardProps, "onShowTrend">) {
  const stats = field.stats as TextStats;
  const previousStats = previousField?.stats as TextStats | undefined;
  const difference = previousStats
    ? stats.responseCount - previousStats.responseCount
    : undefined;
  const delta =
    difference === undefined
      ? "—"
      : difference === 0
        ? "Uendret"
        : formatSigned(difference, 0);
  const comparison = comparisonEnabled ? (
    <FieldComparisonMatrix
      label={`Sammenligning av tekstsvar: ${field.label}`}
      row={{
        label: "Tekstsvar",
        current: stats.responseCount.toLocaleString("nb-NO"),
        previous: (
          <PendingValue pending={comparisonPending}>
            {previousStats?.responseCount.toLocaleString("nb-NO") ?? "—"}
          </PendingValue>
        ),
        delta: <PendingValue pending={comparisonPending}>{delta}</PendingValue>,
      }}
    />
  ) : undefined;
  return (
    <TextFieldCard
      field={field}
      totalCount={currentTotalCount}
      comparison={comparison}
      headerSubtitle={
        comparisonEnabled
          ? "Antall svar på dette spørsmålet"
          : `${stats.responseCount.toLocaleString("nb-NO")} tekstsvar`
      }
      semanticHeading
    />
  );
}
