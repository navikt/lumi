import { ChatElipsisIcon } from "@navikt/aksel-icons";
import { BodyShort, HStack, VStack } from "@navikt/ds-react";

import { DashboardCard } from "~/components/dashboard";
import type { ChoiceStats } from "~/types/api";

import { FieldCardHeader } from "./FieldCardHeader";
import type { FieldCardProps } from "./types";

const CHOICE_COLORS = [
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
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
    <DashboardCard
      padding="space-20"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <FieldCardHeader
        icon={<ChatElipsisIcon fontSize="1.25rem" aria-hidden />}
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        subtitle={`${totalResponses} av ${totalCount} har svart (${responsePct}%)`}
      />

      <VStack gap="space-8" marginBlock="space-12 space-0">
        {choices.map((choice, index) => {
          const barWidth = maxCount > 0 ? (choice.count / maxCount) * 100 : 0;
          const color = CHOICE_COLORS[index % CHOICE_COLORS.length];

          return (
            <VStack key={choice.id} gap="space-4">
              <HStack justify="space-between" align="center">
                <BodyShort
                  size="small"
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {choice.label}
                </BodyShort>
                <BodyShort
                  size="small"
                  style={{
                    color: "var(--ax-text-neutral-subtle)",
                    marginLeft: "0.5rem",
                  }}
                >
                  {choice.count} ({choice.percentage}%)
                </BodyShort>
              </HStack>
              <div
                style={{
                  height: 8,
                  background: "var(--ax-bg-neutral-moderate)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    borderRadius: 4,
                    backgroundColor: color,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </VStack>
          );
        })}
      </VStack>
    </DashboardCard>
  );
}
