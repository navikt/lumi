import { ChatExclamationmarkIcon } from "@navikt/aksel-icons";
import { BodyShort, Detail, HStack, Tag, VStack } from "@navikt/ds-react";
import { Link } from "@tanstack/react-router";

import { DashboardCard } from "~/components/dashboard";
import type { TextStats } from "~/types/api";
import { formatRelativeTime } from "~/utils/wordAnalysis";

import { FieldCardHeader } from "./FieldCardHeader";
import styles from "./TextFieldCard.module.css";
import type { FieldCardProps } from "./types";

// Phrase rendering is intentionally inlined rather than reusing PhraseList,
// because PhraseList wraps itself in DashboardCard — and TextFieldCard IS a
// DashboardCard, which would cause visual nesting. Extract a shared
// "PhraseItems" sub-component if a third consumer appears.
export function TextFieldCard({ field, totalCount }: FieldCardProps) {
  const stats = field.stats as TextStats;
  const responseRate =
    totalCount > 0 ? Math.round((stats.responseCount / totalCount) * 100) : 0;

  const phrases = stats.topPhrases ?? [];
  const hasPhrases = phrases.length > 0;
  const displayedPhrases = phrases.slice(0, 5);
  const maxCount = displayedPhrases[0]?.count ?? 1;

  const hasKeywords = stats.topKeywords && stats.topKeywords.length > 0;
  const hasRecentResponses =
    stats.recentResponses && stats.recentResponses.length > 0;

  return (
    <DashboardCard padding="space-20" className={styles.cardContent}>
      <FieldCardHeader
        icon={<ChatExclamationmarkIcon fontSize="1.25rem" aria-hidden />}
        label={field.label}
        titleTestId={`field-stat-title-${field.fieldId}`}
        subtitle={`${stats.responseCount} av ${totalCount} har svart (${responseRate}%)`}
      />

      {hasPhrases ? (
        <VStack gap="space-8" marginBlock="space-12 space-0">
          <BodyShort
            size="small"
            weight="semibold"
            className={styles.sectionHeading}
          >
            Hyppigste fraser
          </BodyShort>
          <ol className={styles.phraseList} aria-label="Hyppigste fraser">
            {displayedPhrases.map((phrase) => (
              <li key={phrase.text}>
                <Link
                  to="/feedback"
                  search={(prev) => ({
                    ...prev,
                    query: phrase.text,
                    page: "1",
                    hasText: "true",
                  })}
                  className={styles.phraseLink}
                  aria-label={`Vis ${phrase.count} tilbakemeldinger som inneholder frasen «${phrase.text}»`}
                >
                  <HStack
                    align="center"
                    gap="space-8"
                    justify="space-between"
                    wrap={false}
                  >
                    <BodyShort size="small" weight="semibold" truncate>
                      {phrase.text}
                    </BodyShort>
                    <HStack
                      gap="space-8"
                      align="center"
                      className={styles.phraseMeta}
                    >
                      <progress
                        className={styles.phraseProgress}
                        value={phrase.count}
                        max={maxCount}
                        aria-hidden
                      />
                      <Detail>{phrase.count}</Detail>
                    </HStack>
                  </HStack>
                </Link>
              </li>
            ))}
          </ol>
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
            {stats.recentResponses.map((response) => (
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
