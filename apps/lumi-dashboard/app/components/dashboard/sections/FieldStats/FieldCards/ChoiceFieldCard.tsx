import { ChatElipsisIcon } from "@navikt/aksel-icons";
import { BodyShort, HStack, VStack } from "@navikt/ds-react";

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

export function ChoiceFieldCard({ field, totalCount }: FieldCardProps) {
  const stats = field.stats as ChoiceStats;
  const distribution = stats.distribution;

  const choices = Object.entries(distribution)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...choices.map((c) => c.count), 1);
  const totalResponses = choices.reduce((sum, c) => sum + c.count, 0);

  const responsePct =
    totalCount > 0 ? Math.round((totalResponses / totalCount) * 100) : 0;

  return (
    <DashboardCard padding="space-20" className={styles.cardContent}>
      <FieldCardHeader
        icon={<ChatElipsisIcon fontSize="1.25rem" aria-hidden />}
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        subtitle={`${totalResponses} av ${totalCount} har svart (${responsePct}%)`}
      />

      <VStack gap="space-8" marginBlock="space-12 space-0">
        {choices.map((choice, index) => {
          const barColorClass =
            CHOICE_BAR_COLOR_CLASSES[index % CHOICE_BAR_COLOR_CLASSES.length];

          return (
            <VStack key={choice.id} gap="space-4">
              <HStack justify="space-between" align="center">
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
          );
        })}
      </VStack>
    </DashboardCard>
  );
}
