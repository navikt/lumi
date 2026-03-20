import { ChatElipsisIcon } from "@navikt/aksel-icons";
import { BodyShort, Button, HStack, VStack } from "@navikt/ds-react";

import { DashboardCard } from "~/components/dashboard";
import type { ChoiceStats } from "~/types/api";
import styles from "./ChoiceFieldCard.module.css";
import { FieldCardHeader } from "./FieldCardHeader";
import type { FieldCardProps } from "./types";

const CHOICE_BAR_COLOR_CLASSES = [
  styles.choiceBarBlue,
  styles.choiceBarGreen,
  styles.choiceBarAmber,
  styles.choiceBarPurple,
  styles.choiceBarPink,
  styles.choiceBarCyan,
];

export interface ChoiceFieldCardProps extends FieldCardProps {
  activeChoiceValue?: string;
  onChoiceSelect?: (optionId: string) => void;
  onChoiceClear?: () => void;
}

export function ChoiceFieldCard({
  field,
  totalCount,
  activeChoiceValue,
  onChoiceSelect,
  onChoiceClear,
}: ChoiceFieldCardProps) {
  const stats = field.stats as ChoiceStats;
  const distribution = stats.distribution;

  const choices = Object.entries(distribution)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...choices.map((c) => c.count), 1);
  const selectionSum = choices.reduce((sum, choice) => sum + choice.count, 0);
  const totalSelections = stats.totalSelections ?? selectionSum;
  // Dashboard and API deploy separately, so keep one rollout window compatible with older payloads.
  const responseCount =
    stats.responseCount ??
    (field.fieldType === "MULTI_CHOICE"
      ? Math.min(totalSelections, totalCount)
      : totalSelections);
  const responsePct =
    totalCount > 0 ? Math.round((responseCount / totalCount) * 100) : 0;
  const showSelectionsSummary =
    field.fieldType === "MULTI_CHOICE" &&
    stats.totalSelections != null &&
    totalSelections > 0 &&
    totalSelections !== responseCount;

  const isFiltering = !!activeChoiceValue;

  return (
    <DashboardCard padding="space-20" className={styles.cardContent}>
      <FieldCardHeader
        icon={<ChatElipsisIcon fontSize="1.25rem" aria-hidden />}
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        subtitle={`${responseCount} av ${totalCount} har svart (${responsePct}%)`}
      />

      <VStack gap="space-8" marginBlock="space-12 space-0">
        {showSelectionsSummary ? (
          <BodyShort size="small">{totalSelections} valg totalt</BodyShort>
        ) : null}
        {choices.map((choice, index) => {
          const barColorClass =
            CHOICE_BAR_COLOR_CLASSES[index % CHOICE_BAR_COLOR_CLASSES.length];
          const isActive = activeChoiceValue === choice.id;
          const isInactive = isFiltering && !isActive;

          return (
            <button
              key={choice.id}
              type="button"
              className={`${styles.choiceButton} ${isInactive ? styles.choiceButtonInactive : ""}`}
              onClick={() => onChoiceSelect?.(choice.id)}
              aria-pressed={isActive}
            >
              <VStack gap="space-4" width="100%">
                <HStack justify="space-between" align="center" width="100%">
                  <BodyShort size="small" className={styles.choiceLabel}>
                    {choice.label}
                  </BodyShort>
                  <BodyShort size="small" className={styles.choiceValue}>
                    {choice.count} ({choice.percentage}%)
                  </BodyShort>
                </HStack>
                <progress
                  className={`${styles.choiceBar} ${barColorClass}`}
                  value={choice.count}
                  max={maxCount}
                  aria-hidden="true"
                />
              </VStack>
            </button>
          );
        })}
        {isFiltering && (
          <Button
            variant="tertiary"
            size="xsmall"
            onClick={onChoiceClear}
            style={{ alignSelf: "flex-start" }}
          >
            Nullstill filter
          </Button>
        )}
      </VStack>
    </DashboardCard>
  );
}
