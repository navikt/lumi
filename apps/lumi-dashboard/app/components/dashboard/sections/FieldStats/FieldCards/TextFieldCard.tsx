import { ChatExclamationmarkIcon } from "@navikt/aksel-icons";
import { BodyShort, HStack, Tag, VStack } from "@navikt/ds-react";

import { DashboardCard } from "~/components/dashboard";
import type { TextStats } from "~/types/api";
import { formatRelativeTime } from "~/utils/wordAnalysis";

import { FieldCardHeader } from "./FieldCardHeader";
import type { FieldCardProps } from "./types";

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
      <FieldCardHeader
        icon={<ChatExclamationmarkIcon fontSize="1.25rem" aria-hidden />}
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        subtitle={`${stats.responseCount} av ${totalCount} har svart (${responseRate}%)`}
      />

      {hasKeywords && (
        <VStack gap="space-8" marginBlock="space-12 space-0">
          <BodyShort
            size="small"
            weight="semibold"
            style={{ color: "var(--ax-text-neutral-subtle)" }}
          >
            Hyppigste ord
          </BodyShort>
          <HStack gap="space-8" wrap>
            {stats.topKeywords.map(({ word, count }) => (
              <Tag
                data-color="neutral"
                key={word}
                size="small"
                variant="outline"
              >
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
        <VStack gap="space-8" marginBlock="space-16 space-0">
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
