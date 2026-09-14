import { ChatExclamationmarkIcon } from "@navikt/aksel-icons";
import { BodyShort, Detail, HStack, Tag, VStack } from "@navikt/ds-react";

import { DashboardCard } from "~/components/dashboard";
import { PhraseList } from "~/components/shared/PhraseList";
import type { TextStats } from "~/types/api";
import { formatRelativeTime } from "~/utils/wordAnalysis";

import { FieldCardHeader } from "./FieldCardHeader";
import styles from "./TextFieldCard.module.css";
import type { FieldCardProps } from "./types";

export function TextFieldCard({
  field,
  semanticHeading = false,
}: FieldCardProps & {
  semanticHeading?: boolean;
}) {
  const stats = field.stats as TextStats;

  const phrases = stats.topPhrases ?? [];
  const hasPhrases = phrases.length > 0;
  const hasKeywords = stats.topKeywords && stats.topKeywords.length > 0;
  const hasRecentResponses =
    stats.recentResponses && stats.recentResponses.length > 0;
  const headingId = semanticHeading
    ? `comparison-field-${field.fieldId}`
    : undefined;

  return (
    <DashboardCard
      as={semanticHeading ? "section" : "div"}
      aria-labelledby={headingId}
      padding="space-20"
      className={styles.cardContent}
    >
      <FieldCardHeader
        icon={
          <ChatExclamationmarkIcon
            fontSize="var(--ax-font-size-xlarge)"
            aria-hidden
          />
        }
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        headingId={headingId}
        subtitle={`${stats.responseCount.toLocaleString("nb-NO")} tekstsvar i valgt periode`}
      />

      {stats.analysisSampleSize !== undefined &&
      stats.analysisSampleSize !== null &&
      stats.analysisSampleSize < stats.responseCount ? (
        <Detail>
          Ord og uttrykk er basert på de{" "}
          {stats.analysisSampleSize.toLocaleString("nb-NO")} siste tekstsvarene.
          Antall svar gjelder hele perioden.
        </Detail>
      ) : null}

      {hasPhrases ? (
        <VStack gap="space-8" marginBlock="space-12 space-0">
          <BodyShort
            size="small"
            weight="semibold"
            className={styles.sectionHeading}
          >
            Uttrykk som går igjen
          </BodyShort>
          <PhraseList
            phrases={phrases}
            fieldId={field.fieldId}
            ariaLabel="Uttrykk som går igjen"
          />
        </VStack>
      ) : (
        hasKeywords && (
          <VStack gap="space-8" marginBlock="space-12 space-0">
            <BodyShort
              size="small"
              weight="semibold"
              className={styles.sectionHeading}
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
                  <span className={styles.keywordCount}>{count}</span>
                </Tag>
              ))}
            </HStack>
          </VStack>
        )
      )}

      {hasRecentResponses && (
        <VStack gap="space-8" marginBlock="space-16 space-0">
          <BodyShort
            size="small"
            weight="semibold"
            className={styles.sectionHeading}
          >
            Siste svar
          </BodyShort>
          <VStack gap="space-8">
            {stats.recentResponses.slice(0, 3).map((response) => (
              <div
                key={`${response.text}-${response.submittedAt}`}
                className={styles.responseCard}
              >
                <BodyShort size="small" className={styles.responseText}>
                  "{response.text}"
                </BodyShort>
                <BodyShort size="small" className={styles.responseTime}>
                  {formatRelativeTime(response.submittedAt)}
                </BodyShort>
              </div>
            ))}
          </VStack>
        </VStack>
      )}

      {!hasPhrases && !hasKeywords && !hasRecentResponses && (
        <BodyShort size="small" className={styles.emptyState}>
          Ingen tekstsvar ennå
        </BodyShort>
      )}
    </DashboardCard>
  );
}
