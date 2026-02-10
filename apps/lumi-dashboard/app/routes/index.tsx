import type { TagProps } from "@navikt/ds-react";
import { Box, Heading, HStack, Tag, Tooltip, VStack } from "@navikt/ds-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import dayjs from "dayjs";
import { type ReactNode, useEffect } from "react";
import { DiscoveryDashboard } from "~/components/dashboard/views/Discovery/Dashboard";
import { OverviewDashboard } from "~/components/dashboard/views/Overview/Dashboard";
import { RatingDashboard } from "~/components/dashboard/views/Rating/Dashboard";
import { TaskPriorityDashboard } from "~/components/dashboard/views/TaskPriority/Dashboard";
import { TopTasksOverview } from "~/components/dashboard/views/TopTasks/Overview";
import { ActiveFiltersChips } from "~/components/shared/ActiveFiltersChips";
import { FilterBar } from "~/components/shared/FilterBar";
import { Header } from "~/components/shared/Header";
import { PrivacyMaskedNotice } from "~/components/shared/PrivacyMaskedNotice";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { fetchFilterBootstrapServerFn } from "~/server/actions";
import type { SurveyType } from "~/types/api";
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
    dashboard: (hasSurveyFilter: boolean) => ReactNode;
  }
> = {
  topTasks: {
    label: "Top Tasks",
    variant: "info",
    dashboard: () => <TopTasksOverview />,
  },
  rating: {
    label: "Vurdering",
    variant: "success",
    dashboard: (hasSurveyFilter) => (
      <RatingDashboard hasSurveyFilter={hasSurveyFilter} />
    ),
  },
  discovery: {
    label: "Discovery",
    variant: "warning",
    dashboard: () => <DiscoveryDashboard />,
  },
  taskPriority: {
    label: "Task Priority",
    variant: "alt1",
    dashboard: () => <TaskPriorityDashboard />,
  },
  custom: {
    label: "Custom",
    variant: "neutral",
    dashboard: (hasSurveyFilter) => (
      <RatingDashboard hasSurveyFilter={hasSurveyFilter} />
    ),
  },
};

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    // Ensure `team` is present before route components render.
    // This prevents an initial fetch with team=undefined followed by a second fetch after `team` is injected.
    const currentTeamRaw = (
      location.search as Record<string, unknown> | undefined
    )?.team;
    const currentTeam =
      typeof currentTeamRaw === "string" ? currentTeamRaw.trim() : undefined;
    if (currentTeam) return;

    try {
      const bootstrap = await fetchFilterBootstrapServerFn({
        data: { team: undefined },
      });
      const selectedTeam = bootstrap?.selectedTeam?.trim();
      if (!selectedTeam) return;

      throw redirect({
        to: "/",
        search: {
          ...(location.search as Record<string, unknown> | undefined),
          team: selectedTeam,
        },
        replace: true,
      });
    } catch {
      // If we're not authenticated yet (or bootstrap fails), don't block rendering.
      // The UI and existing FilterBar fallback behavior will still work.
      return;
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { params, setParams } = useSearchParams();
  const { data: stats, isPending } = useStats();
  const hasSurveyFilter = !!params.surveyId;
  const surveyType = stats?.surveyType;
  const isPrivacyMasked = stats?.privacy?.masked;

  useEffect(() => {
    if (params.fromDate && params.toDate) return;

    const end = dayjs();
    const start = end.subtract(29, "day");

    setParams({
      fromDate: params.fromDate ?? start.format("YYYY-MM-DD"),
      toDate: params.toDate ?? end.format("YYYY-MM-DD"),
      page: "1",
    });
  }, [params.fromDate, params.toDate, setParams]);

  useEffect(() => {
    const hasUnsupported =
      !!params.hasText ||
      !!params.lowRating ||
      !!params.query ||
      !!params.tag ||
      !!params.theme ||
      !!params.page ||
      !!params.size;

    if (!hasUnsupported) return;

    setParams({
      hasText: undefined,
      lowRating: undefined,
      query: undefined,
      tag: undefined,
      theme: undefined,
      page: undefined,
      size: undefined,
    });
  }, [
    params.hasText,
    params.lowRating,
    params.query,
    params.tag,
    params.theme,
    params.page,
    params.size,
    setParams,
  ]);

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
      return config.dashboard(hasSurveyFilter);
    }

    return <OverviewDashboard />;
  };

  return (
    <>
      <Header />

      <Box
        paddingBlock={{ xs: "space-16", md: "space-24" }}
        paddingInline={{ xs: "space-12", sm: "space-16" }}
        className={styles.mainContainer}
        as="main"
      >
        <VStack gap={{ xs: "space-16", md: "space-24" }}>
          {/* Page header */}
          <HStack justify="space-between" align="center" wrap gap="space-8">
            <HStack align="center" gap={{ xs: "space-8", md: "space-16" }}>
              <Heading size="large">Dashboard</Heading>
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

          <FilterBar />

          {/* Active drill-down filters (global) */}
          <ActiveFiltersChips />

          {/* Type-specific dashboard view */}
          {renderDashboardContent()}
        </VStack>
      </Box>
    </>
  );
}
