import {
  Link as AkselLink,
  Alert,
  BodyShort,
  Button,
  Heading,
  VStack,
} from "@navikt/ds-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";

interface FeedbackEmptyStateProps {
  /** Whether the team has any submissions at all; undefined while unknown. */
  hasAnyData: boolean | undefined;
  hasActiveNonPeriodFilters: boolean;
  onResetFilters: () => void;
  periodFromDate?: string;
  periodToDate?: string;
  /** First-to-last submission span across the team's surveys. */
  fullPeriod?: { fromDate: string; toDate: string };
  onShowFullPeriod: (period: { fromDate: string; toDate: string }) => void;
}

const formatDate = (date: string) => dayjs(date).format("DD.MM.YYYY");

const describeEmptyPeriod = (fromDate?: string, toDate?: string) => {
  if (fromDate && toDate) {
    return `Ingen tilbakemeldinger i perioden ${formatDate(fromDate)}–${formatDate(toDate)}.`;
  }
  if (fromDate) {
    return `Ingen tilbakemeldinger fra og med ${formatDate(fromDate)}.`;
  }
  if (toDate) {
    return `Ingen tilbakemeldinger til og med ${formatDate(toDate)}.`;
  }
  return undefined;
};

/**
 * Empty state for the feedback list. Distinguishes three situations the
 * generic "no results" message used to cover: the team has no data yet
 * (onboarding), active filters exclude everything (reset), or the selected
 * period is empty (show the full survey period).
 */
export function FeedbackEmptyState({
  hasAnyData,
  hasActiveNonPeriodFilters,
  onResetFilters,
  periodFromDate,
  periodToDate,
  fullPeriod,
  onShowFullPeriod,
}: FeedbackEmptyStateProps) {
  const emptyPeriodDescription = describeEmptyPeriod(
    periodFromDate,
    periodToDate,
  );

  if (hasAnyData === false) {
    return (
      <Alert variant="info">
        <VStack gap="space-8" align="start">
          <Heading size="xsmall" level="2">
            Ingen tilbakemeldinger ennå
          </Heading>
          <BodyShort>
            Når en app sender inn svar via survey-widgeten, dukker de opp her.
          </BodyShort>
          <BodyShort>
            <AkselLink href="https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi">
              Kom i gang med Lumi
            </AkselLink>
          </BodyShort>
          <BodyShort>
            <AkselLink as={Link} to="/surveyverksted">
              Lag en survey i Surveyverksted
            </AkselLink>
          </BodyShort>
        </VStack>
      </Alert>
    );
  }

  if (hasAnyData && hasActiveNonPeriodFilters) {
    return (
      <Alert variant="info">
        <VStack gap="space-8" align="start">
          <BodyShort>Ingen treff med gjeldende filtre</BodyShort>
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={onResetFilters}
          >
            Nullstill filtre
          </Button>
        </VStack>
      </Alert>
    );
  }

  if (hasAnyData && emptyPeriodDescription) {
    return (
      <Alert variant="info">
        <VStack gap="space-8" align="start">
          <BodyShort>{emptyPeriodDescription}</BodyShort>
          {fullPeriod && (
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => onShowFullPeriod(fullPeriod)}
            >
              Vis hele svarperioden
            </Button>
          )}
        </VStack>
      </Alert>
    );
  }

  return <Alert variant="info">Ingen tilbakemeldinger funnet</Alert>;
}
