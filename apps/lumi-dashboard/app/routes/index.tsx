import type { TagProps } from "@navikt/ds-react";
import { Box, Heading, HStack, Tag, Tooltip, VStack } from "@navikt/ds-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { type ReactNode, useEffect } from "react";
import { DiscoveryDashboard } from "~/components/dashboard/views/Discovery/Dashboard";
import { OverviewDashboard } from "~/components/dashboard/views/Overview/Dashboard";
import { RatingDashboard } from "~/components/dashboard/views/Rating/Dashboard";
import { TaskPriorityDashboard } from "~/components/dashboard/views/TaskPriority/Dashboard";
import { TopTasksOverview } from "~/components/dashboard/views/TopTasks/Overview";
import { ActiveFiltersChips } from "~/components/shared/ActiveFiltersChips";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
import { PrivacyMaskedNotice } from "~/components/shared/PrivacyMaskedNotice";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
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
  const statsQuery = useStats();
  const { data: stats, isPending } = statsQuery;
  const hasSurveyFilter = !!params.surveyId;
  const surveyType = stats?.surveyType;
  const isPrivacyMasked = stats?.privacy?.masked;

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

  const config = surveyType ? SURVEY_CONFIG[surveyType] : null;

  // Show generic skeleton during initial load when a survey is selected
  // This prevents showing the wrong dashboard type before we know the surveyType
  const showInitialSkeleton = hasSurveyFilter && isPending && !stats;

  // Render dashboard content based on privacy and survey type
  const renderDashboardContent = () => {
    if (showInitialSkeleton) return null;

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

          <DataFetchBoundary
            title="Kunne ikke hente dashboarddata"
            queries={[statsQuery]}
          >
            <FilterBar />

            {/* Active drill-down filters (global) */}
            <ActiveFiltersChips />

            {/* Type-specific dashboard view */}
            {renderDashboardContent()}
          </DataFetchBoundary>
        </VStack>
      </Box>
    </>
  );
}
