import {
  ChatElipsisIcon,
  ChatExclamationmarkIcon,
  StarIcon,
} from "@navikt/aksel-icons";
import { BodyShort, HStack, Label, Tag, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import type {
  ChoiceStats,
  FieldStat,
  RatingStats,
  TextStats,
} from "~/types/api";
import { formatRelativeTime } from "~/utils/wordAnalysis";

// ============================================
// Shared types and utilities
// ============================================

export interface FieldCardProps {
  field: FieldStat;
  totalCount: number;
}

function getRatingEmoji(rating: number): string {
  if (Number.isNaN(rating)) return "";
  if (rating < 1.5) return "😡";
  if (rating < 2.5) return "🙁";
  if (rating < 3.5) return "😐";
  if (rating < 4.5) return "😀";
  return "😍";
}

function getRatingColor(rating: number): string {
  switch (rating) {
    case 5:
      return "#22C55E"; // Green
    case 4:
      return "#84CC16"; // Lime
    case 3:
      return "#EAB308"; // Yellow
    case 2:
      return "#F97316"; // Orange
    case 1:
      return "#EF4444"; // Red
    default:
      return "#9CA3AF";
  }
}

const CHOICE_COLORS = [
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
];

// ============================================
// RatingFieldCard
// ============================================

export function RatingFieldCard({ field, totalCount }: FieldCardProps) {
  const stats = field.stats as RatingStats;
  const distribution = stats.distribution;

  const fieldTotalResponses = Object.values(distribution).reduce(
    (sum, count) => sum + count,
    0,
  );
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <DashboardCard padding="space-20">
      <HStack gap="space-8" align="start" marginBlock="0 space-8">
        <StarIcon fontSize="1.25rem" aria-hidden />
        <VStack gap="0" style={{ flex: 1 }}>
          <Label size="small" style={{ flex: 1, minWidth: 0 }}>
            {field.label}
          </Label>
          <BodyShort
            size="small"
            style={{ color: "var(--ax-text-neutral-subtle)" }}
          >
            {fieldTotalResponses} av {totalCount} har svart (
            {Math.round((fieldTotalResponses / totalCount) * 100)}%)
          </BodyShort>
        </VStack>
      </HStack>

      <HStack gap="space-8" align="center" marginBlock="space-8">
        <span
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {stats.average.toFixed(1)}
        </span>
        <span style={{ fontSize: "1.5rem" }}>
          {getRatingEmoji(stats.average)}
        </span>
      </HStack>

      <VStack gap="space-4" marginBlock="space-12 0">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = distribution[rating] || 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <HStack
              key={rating}
              gap="space-8"
              align="center"
              style={{ fontSize: "0.875rem" }}
            >
              <span
                style={{
                  width: "1.25rem",
                  textAlign: "center",
                  fontWeight: 500,
                }}
              >
                {rating}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 10,
                  background: "var(--ax-bg-neutral-moderate)",
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    borderRadius: 5,
                    backgroundColor: getRatingColor(rating),
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span
                style={{
                  width: "2rem",
                  textAlign: "right",
                  color: "var(--ax-text-neutral-subtle)",
                  fontSize: "0.75rem",
                }}
              >
                {count}
              </span>
            </HStack>
          );
        })}
      </VStack>
    </DashboardCard>
  );
}

// ============================================
// TextFieldCard
// ============================================

export function TextFieldCard({ field, totalCount }: FieldCardProps) {
  const stats = field.stats as TextStats;
  const responseRate =
    totalCount > 0 ? Math.round((stats.responseCount / totalCount) * 100) : 0;

  const hasKeywords = stats.topKeywords && stats.topKeywords.length > 0;
  const hasRecentResponses =
    stats.recentResponses && stats.recentResponses.length > 0;

  return (
    <DashboardCard
      padding="space-20"
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <HStack gap="space-8" align="start" marginBlock="0 space-8">
        <ChatExclamationmarkIcon fontSize="1.25rem" aria-hidden />
        <VStack gap="0" style={{ flex: 1 }}>
          <Label size="small" style={{ flex: 1, minWidth: 0 }}>
            {field.label}
          </Label>
          <BodyShort
            size="small"
            style={{ color: "var(--ax-text-neutral-subtle)" }}
          >
            {stats.responseCount} av {totalCount} har svart ({responseRate}%)
          </BodyShort>
        </VStack>
      </HStack>

      {hasKeywords && (
        <VStack gap="space-8" marginBlock="space-12 0">
          <BodyShort
            size="small"
            weight="semibold"
            style={{ color: "var(--ax-text-neutral-subtle)" }}
          >
            Hyppigste ord
          </BodyShort>
          <HStack gap="space-8" wrap>
            {stats.topKeywords.map(({ word, count }) => (
              <Tag key={word} size="small" variant="neutral">
                {word}
                <span
                  style={{
                    opacity: 0.5,
                    marginLeft: "0.35rem",
                    fontSize: "0.75rem",
                  }}
                >
                  {count}
                </span>
              </Tag>
            ))}
          </HStack>
        </VStack>
      )}

      {hasRecentResponses && (
        <VStack gap="space-8" marginBlock="space-16 0">
          <BodyShort
            size="small"
            weight="semibold"
            style={{ color: "var(--ax-text-neutral-subtle)" }}
          >
            Siste svar
          </BodyShort>
          <VStack gap="space-8">
            {stats.recentResponses.map((response, index) => (
              <div
                key={`${response.submittedAt}-${index}`}
                style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--ax-bg-neutral-soft)",
                  borderRadius: "var(--ax-border-radius-medium)",
                  borderLeft: "3px solid var(--ax-border-info)",
                }}
              >
                <BodyShort
                  size="small"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  "{response.text}"
                </BodyShort>
                <BodyShort
                  size="small"
                  style={{
                    color: "var(--ax-text-neutral-subtle)",
                    marginTop: "0.25rem",
                    fontSize: "0.75rem",
                  }}
                >
                  {formatRelativeTime(response.submittedAt)}
                </BodyShort>
              </div>
            ))}
          </VStack>
        </VStack>
      )}

      {!hasKeywords && !hasRecentResponses && (
        <BodyShort
          size="small"
          style={{
            color: "var(--ax-text-neutral-subtle)",
            marginTop: "0.5rem",
            fontStyle: "italic",
          }}
        >
          Ingen tekstsvar ennå
        </BodyShort>
      )}
    </DashboardCard>
  );
}

// ============================================
// ChoiceFieldCard
// ============================================

export function ChoiceFieldCard({ field, totalCount }: FieldCardProps) {
  const stats = field.stats as ChoiceStats;
  const distribution = stats.distribution;

  const choices = Object.entries(distribution)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...choices.map((c) => c.count), 1);
  const totalResponses = choices.reduce((sum, c) => sum + c.count, 0);

  return (
    <DashboardCard
      padding="space-20"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <HStack gap="space-8" align="start" marginBlock="0 space-8">
        <ChatElipsisIcon fontSize="1.25rem" aria-hidden />
        <VStack gap="0" style={{ flex: 1 }}>
          <Label size="small" style={{ flex: 1, minWidth: 0 }}>
            {field.label}
          </Label>
          <BodyShort
            size="small"
            style={{ color: "var(--ax-text-neutral-subtle)" }}
          >
            {totalResponses} av {totalCount} har svart (
            {Math.round((totalResponses / totalCount) * 100)}%)
          </BodyShort>
        </VStack>
      </HStack>

      <VStack gap="space-8" marginBlock="space-12 0">
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
