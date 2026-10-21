import { ArrowRightIcon } from "@navikt/aksel-icons";
import { BodyShort, Detail, HStack } from "@navikt/ds-react";
import { Link } from "@tanstack/react-router";

import { stringifyPhraseFilter } from "~/utils/phraseFilterUtils";

import styles from "./PhraseList.module.css";

interface PhraseListItem {
  text: string;
  count: number;
}

interface PhraseListProps {
  phrases: PhraseListItem[];
  fieldId: string;
  maxItems?: number;
  ariaLabel?: string;
}

/**
 * Ranked, filterable phrases shared by summary cards and specialized surveys.
 * Counts are responses containing the phrase, not raw word occurrences.
 */
export function PhraseList({
  phrases,
  fieldId,
  maxItems = 5,
  ariaLabel = "Uttrykk som går igjen",
}: PhraseListProps) {
  const displayedPhrases = phrases.slice(0, maxItems);
  const maxCount = displayedPhrases[0]?.count ?? 1;

  if (displayedPhrases.length === 0) return null;

  return (
    <ol className={styles.phraseList} aria-label={ariaLabel}>
      {displayedPhrases.map((phrase, index) => (
        <li key={phrase.text} className={styles.phraseItem}>
          <Link
            to="/feedback"
            search={(prev) => ({
              ...prev,
              phrase: stringifyPhraseFilter(fieldId, phrase.text),
              query: undefined,
              page: "1",
              hasText: "true",
            })}
            className={styles.phraseLink}
          >
            {/* The link is named by its visible text, so people who use speech
                input can say what they see. The list already gives the rank. */}
            <HStack align="center" gap="space-8" wrap={false}>
              <span className={styles.phraseRank} aria-hidden>
                {index + 1}
              </span>
              <span className={styles.phraseBar}>
                <span
                  className={styles.phraseBarFill}
                  style={{
                    width: `${Math.round((phrase.count / maxCount) * 100)}%`,
                  }}
                />
                <HStack
                  align="center"
                  gap="space-8"
                  justify="space-between"
                  wrap={false}
                  className={styles.phraseContent}
                >
                  <BodyShort
                    size="small"
                    weight="semibold"
                    className={styles.phraseText}
                  >
                    {phrase.text}
                  </BodyShort>
                  <HStack
                    gap="space-8"
                    align="center"
                    className={styles.phraseMeta}
                  >
                    <Detail className={styles.phraseCount}>
                      {phrase.count} svar
                      <span className={styles.srOnly}>{" – åpne svarene"}</span>
                    </Detail>
                    <ArrowRightIcon
                      fontSize="var(--ax-font-size-medium)"
                      className={styles.phraseArrow}
                      aria-hidden
                    />
                  </HStack>
                </HStack>
              </span>
            </HStack>
          </Link>
        </li>
      ))}
    </ol>
  );
}
