import {
  CalendarIcon,
  ChatExclamationmarkIcon,
  ChatIcon,
  StarIcon,
} from "@navikt/aksel-icons";
import { BodyShort, HStack } from "@navikt/ds-react";
import type { ReactNode } from "react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type { RatingStats, TextStats } from "~/types/api";
import { Skeleton as StatsCardsSkeleton } from "./Skeleton";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
}

export function StatCard({ icon, label, value, subtitle }: StatCardProps) {
  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-20" }}>
      <HStack gap="space-8" align="center" style={{ marginBottom: "0.5rem" }}>
        <span
          style={{ color: "var(--ax-text-neutral-subtle)", display: "flex" }}
        >
          {icon}
        </span>
        <BodyShort weight="semibold" textColor="subtle" size="small">
          {label}
        </BodyShort>
      </HStack>
      <div
        style={{
          fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
          fontWeight: 700,
          lineHeight: 1,
          marginBottom: "0.2rem",
        }}
      >
        {value}
      </div>
      <BodyShort size="small" textColor="subtle">
        {subtitle}
      </BodyShort>
    </DashboardCard>
  );
}

interface StatsCardsProps {
  /** Whether to show the rating card. Defaults to false. */
  showRating?: boolean;
}

export function StatsCards({ showRating = false }: StatsCardsProps) {
  const { data: stats, isPending } = useStats();
  const { params } = useSearchParams();
  const hasSurveyFilter = !!params.surveyId;

  // isPending: no cached data AND fetching (TanStack Query v5 best practice)
  // With placeholderData: keepPreviousData, isPending stays false during refetches
  if (isPending) {
    return <StatsCardsSkeleton showRating={showRating} />;
  }

  const totalCount = stats?.totalCount || 0;
  const periodDays = stats?.period?.days || 30;
  const countWithText = stats?.countWithText || 0;
  const textPercentage =
    totalCount > 0 ? Math.round((countWithText / totalCount) * 100) : 0;

  // Kun vis detaljert felt-statistikk når én survey er valgt
  if (hasSurveyFilter) {
    // Find first rating field from fieldStats
    const ratingField = stats?.fieldStats?.find(
      (f) => f.fieldType === "RATING",
    );
    const ratingStats = ratingField?.stats as RatingStats | undefined;
    const avgRating = ratingStats?.average?.toFixed(1) || "–";

    // Count text fields with responses
    const textFields =
      stats?.fieldStats?.filter((f) => f.fieldType === "TEXT") || [];
    const totalTextResponses = textFields.reduce((sum, f) => {
      const textStats = f.stats as TextStats;
      return sum + textStats.responseCount;
    }, 0);

    return (
      <DashboardGrid
        columns={{ xs: 1, sm: 2, md: showRating ? 4 : 3 }}
        gap={{ xs: "space-12", md: "space-16" }}
      >
        <StatCard
          icon={<CalendarIcon fontSize="1.25rem" aria-hidden />}
          label="Periode"
          value={`${periodDays}d`}
          subtitle={`${stats?.period?.fromDate || "–"} → ${stats?.period?.toDate || "nå"}`}
        />

        <StatCard
          icon={<ChatIcon fontSize="1.25rem" aria-hidden />}
          label="Tilbakemeldinger"
          value={totalCount.toLocaleString("no-NO")}
          subtitle={`Siste ${periodDays} dager`}
        />

        {showRating &&
          (ratingStats ? (
            <StatCard
              icon={<StarIcon fontSize="1.25rem" aria-hidden />}
              label="Snitt vurdering"
              value={`${avgRating} ${getRatingEmoji(Number(avgRating))}`}
              subtitle="av 5 mulige"
            />
          ) : (
            <StatCard
              icon={<StarIcon fontSize="1.25rem" aria-hidden />}
              label="Vurdering"
              value="–"
              subtitle="Ingen rating"
            />
          ))}

        <StatCard
          icon={<ChatExclamationmarkIcon fontSize="1.25rem" aria-hidden />}
          label="Tekstsvar"
          value={totalTextResponses.toLocaleString("no-NO")}
          subtitle={`${textFields.length} felt`}
        />
      </DashboardGrid>
    );
  }

  // Aggregert visning når "alle surveys" er valgt
  return (
    <DashboardGrid
      columns={{ xs: 1, sm: 2, md: 3 }}
      gap={{ xs: "space-12", md: "space-16" }}
    >
      <StatCard
        icon={<CalendarIcon fontSize="1.25rem" aria-hidden />}
        label="Periode"
        value={`${periodDays}d`}
        subtitle={`${stats?.period?.fromDate || "–"} → ${stats?.period?.toDate || "nå"}`}
      />

      <StatCard
        icon={<ChatIcon fontSize="1.25rem" aria-hidden />}
        label="Tilbakemeldinger"
        value={totalCount.toLocaleString("no-NO")}
        subtitle={`Siste ${periodDays} dager`}
      />

      <StatCard
        icon={<ChatExclamationmarkIcon fontSize="1.25rem" aria-hidden />}
        label="Med tekst"
        value={countWithText.toLocaleString("no-NO")}
        subtitle={`${textPercentage}% av totalt`}
      />
    </DashboardGrid>
  );
}

function getRatingEmoji(rating: number): string {
  if (Number.isNaN(rating)) return "";
  if (rating < 1.5) return "😡";
  if (rating < 2.5) return "🙁";
  if (rating < 3.5) return "😐";
  if (rating < 4.5) return "😀";
  return "😍";
}
