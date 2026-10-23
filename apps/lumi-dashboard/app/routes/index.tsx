import type { TagProps } from "@navikt/ds-react";
import { Box, Heading, HStack, Tag, Tooltip, VStack } from "@navikt/ds-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { type ReactNode, useEffect } from "react";
import { ComparisonPeriodControl } from "~/components/dashboard/sections/FieldStats/PeriodComparison/ComparisonPeriodControl";
import { QuestionTrendSection } from "~/components/dashboard/sections/QuestionTrend";
import { DiscoveryDashboard } from "~/components/dashboard/views/Discovery/Dashboard";
import { OverviewDashboard } from "~/components/dashboard/views/Overview/Dashboard";
import { RatingDashboard } from "~/components/dashboard/views/Rating/Dashboard";
import { TaskPriorityDashboard } from "~/components/dashboard/views/TaskPriority/Dashboard";
import { TopTasksOverview } from "~/components/dashboard/views/TopTasks/Overview";
import { ActiveFiltersChips } from "~/components/shared/ActiveFiltersChips";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { FilterBar } from "~/components/shared/FilterBar";
import { GetStartedEmptyState } from "~/components/shared/GetStartedEmptyState";
import { Header } from "~/components/shared/Header";
import { PrivacyMaskedNotice } from "~/components/shared/PrivacyMaskedNotice";
import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { useTeamAccessDenied } from "~/hooks/useTeamAccessDenied";
import { searchSchema } from "~/schemas/searchSchema";
import type { SurveyType } from "~/types/api";
import { applyDashboardSearchDefaults } from "~/utils/dashboardSearchDefaults";
import styles from "./index.module.css";

/**
 * Survey type descriptions - educates users about each methodology
 */
const SURVEY_DESCRIPTIONS: Record<SurveyType, string> = {
  rating:
    "Måler brukertilfredshet og sentiment. Brukes for å ta pulsen på løsningen over tid.",
  topTasks:
    "Måler suksessraten på brukernes kjerneoppgaver. Brukes for å finne tekniske eller designmessige hindringer.",
  taskPriority:
    "Lar brukerne stemme på hva som er viktigst for dem. Brukes strategisk for å prioritere utvikling ('Long Neck').",
  discovery:
    "Åpne spørsmål for å avdekke ukjente behov. Brukes i utforskningsfasen for å finne 'unknown unknowns'.",
  custom:
    "Egendefinert undersøkelse med fritt valg av spørsmålstyper. Brukes når standardtypene ikke dekker behovet.",
};

/**
 * Survey type configuration - centralizes labels, variants, and dashboards
 */
const SURVEY_CONFIG: Record<
  SurveyType,
  {
    label: string;
    variant: TagProps["variant"];
    dashboard: (hasSurveyFilter: boolean, isRatingSurvey: boolean) => ReactNode;
  }
> = {
  topTasks: {
    label: "Top Tasks",
    variant: "info",
    dashboard: (_hasSurveyFilter, _isRatingSurvey) => <TopTasksOverview />,
  },
  rating: {
    label: "Vurdering",
    variant: "success",
    dashboard: (hasSurveyFilter, isRatingSurvey) => (
      <RatingDashboard
        hasSurveyFilter={hasSurveyFilter}
        isRatingSurvey={isRatingSurvey}
      />
    ),
  },
  discovery: {
    label: "Discovery",
    variant: "warning",
    dashboard: (_hasSurveyFilter, _isRatingSurvey) => <DiscoveryDashboard />,
  },
  taskPriority: {
    label: "Task Priority",
    variant: "alt1",
    dashboard: (_hasSurveyFilter, _isRatingSurvey) => <TaskPriorityDashboard />,
  },
  custom: {
    label: "Custom",
    variant: "neutral",
    dashboard: (hasSurveyFilter, isRatingSurvey) => (
      <RatingDashboard
        hasSurveyFilter={hasSurveyFilter}
        isRatingSurvey={isRatingSurvey}
      />
    ),
  },
};

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ location }) => {
    // Ensure broad default filters are present before route components render.
    // This prevents initial unbounded stats queries followed by narrower refetches.
    const currentSearch = location.search as
      | Record<string, unknown>
      | undefined;
    const defaults = applyDashboardSearchDefaults(currentSearch);

    if (defaults.changed) {
      throw redirect({
        to: "/",
        search: defaults.search,
        replace: true,
      });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { params, setParams } = useSearchParams();
  // FilterBar explains why the team's data cannot be fetched.
  const teamAccessDenied = useTeamAccessDenied();
  const statsQuery = useStats();
  const { data: stats, isPending } = statsQuery;
  // Shares the FilterBar query.
  const bootstrapQuery = useFilterBootstrap();
  const bootstrap = bootstrapQuery.data;
  const hasSurveyFilter = !!params.surveyId;
  const surveyType = stats?.surveyType;
  const isPrivacyMasked = stats?.privacy?.masked;
  // A masked response from an older backend may hide the count.
  const statsHasAnswers = (stats?.totalCount ?? 0) > 0 || !!isPrivacyMasked;
  // Apps come from the team's answers, but the backend caches them for five
  // minutes and stats for two. Trust stats when it already has answers.
  const teamHasNoAnswers = bootstrap?.apps.length === 0 && !statsHasAnswers;
  // Empty stats would show "Ingen data" cards before the empty state replaces
  // them. Wait for the team's apps before showing those cards.
  const awaitingTeamApps =
    !!stats && !statsHasAnswers && bootstrapQuery.isPending;
  const supportsComparison =
    hasSurveyFilter && (surveyType === "rating" || surveyType === "custom");

  // Clean up params that are only used on the feedback route (not the dashboard).
  // page/size are kept because filter changes set page=1, and theme is used by discovery.
  useEffect(() => {
    const hasUnsupported =
      !!params.hasText || !!params.lowRating || !!params.query || !!params.tag;

    if (!hasUnsupported) return;

    setParams({
      hasText: undefined,
      lowRating: undefined,
      query: undefined,
      tag: undefined,
    });
  }, [params.hasText, params.lowRating, params.query, params.tag, setParams]);

  // A mixed result set can report the type of its newest response. Only a
  // selected survey should choose a type-specific dashboard.
  const config =
    hasSurveyFilter && surveyType ? SURVEY_CONFIG[surveyType] : null;

  // Show generic skeleton during initial load when a survey is selected
  // This prevents showing the wrong dashboard type before we know the surveyType
  const showInitialSkeleton = hasSurveyFilter && isPending && !stats;

  // Render dashboard content based on privacy and survey type
  const renderDashboardContent = () => {
    if (showInitialSkeleton || awaitingTeamApps) return null;

    // Show privacy notice if data is masked
    if (isPrivacyMasked && stats?.privacy) {
      return <PrivacyMaskedNotice privacy={stats.privacy} />;
    }

    if (config) {
      return config.dashboard(hasSurveyFilter, surveyType === "rating");
    }

    return <OverviewDashboard />;
  };

  return (
    <>
      <Header />

      <Box
        paddingBlock={{ xs: "space-16", md: "space-24" }}
        paddingInline={{ xs: "space-12", sm: "space-16" }}
        className="main-container"
        as="main"
      >
        <VStack gap={{ xs: "space-16", md: "space-24" }}>
          {/* Page header */}
          <HStack justify="space-between" align="center" wrap gap="space-8">
            <HStack align="center" gap={{ xs: "space-8", md: "space-16" }}>
              <Heading size="large" level="1">
                Dashboard
              </Heading>
              {hasSurveyFilter && config && surveyType && (
                <Tooltip content={SURVEY_DESCRIPTIONS[surveyType]}>
                  <Tag
                    variant={config.variant}
                    size="small"
                    className={styles.surveyTypeTag}
                  >
                    {config.label}
                  </Tag>
                </Tooltip>
              )}
            </HStack>
          </HStack>

          <FilterBar
            periodControl={
              supportsComparison ? <ComparisonPeriodControl /> : undefined
            }
          />

          {/* Keep recovery controls available when a broad query exceeds the analysis budget. */}
          <ActiveFiltersChips />

          {teamAccessDenied ? null : teamHasNoAnswers ? (
            <GetStartedEmptyState
              heading="Ingen svar ennå"
              description="Når appene deres sender inn svar via survey-widgeten, vises grafene her."
              team={bootstrap?.selectedTeam}
            />
          ) : (
            <DataFetchBoundary
              title="Kunne ikke hente dashboarddata"
              queries={[statsQuery]}
            >
              {/* Type-specific dashboard view */}
              {renderDashboardContent()}
              {hasSurveyFilter &&
              !isPrivacyMasked &&
              !showInitialSkeleton &&
              !awaitingTeamApps &&
              !supportsComparison ? (
                <QuestionTrendSection />
              ) : null}
            </DataFetchBoundary>
          )}
        </VStack>
      </Box>
    </>
  );
}
