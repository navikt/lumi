import {
  BodyShort,
  Box,
  Heading,
  Hide,
  HStack,
  Table,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { BlockerAnalysis } from "~/components/dashboard/views/Discovery/BlockerAnalysis";
import { TaskQuadrantChart } from "~/components/shared/Charts/TaskQuadrantChart";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import {
  THEME_COLOR_AMBER,
  THEME_COLOR_BLUE,
  THEME_COLOR_CYAN,
  THEME_COLOR_EMERALD,
  THEME_COLOR_GRAY,
  THEME_COLOR_LIME,
  THEME_COLOR_ORANGE,
  THEME_COLOR_PINK,
  THEME_COLOR_RED,
  THEME_COLOR_VIOLET,
} from "~/utils/colors";
import { TopTasksStatsCards } from "./StatsCards";
import styles from "./TopTasks.module.css";

const THEME_DOT_CLASS_BY_HEX: Record<string, string> = {
  [THEME_COLOR_BLUE]: styles.themeBlue,
  [THEME_COLOR_EMERALD]: styles.themeEmerald,
  [THEME_COLOR_AMBER]: styles.themeAmber,
  [THEME_COLOR_RED]: styles.themeRed,
  [THEME_COLOR_VIOLET]: styles.themeViolet,
  [THEME_COLOR_PINK]: styles.themePink,
  [THEME_COLOR_CYAN]: styles.themeCyan,
  [THEME_COLOR_LIME]: styles.themeLime,
  [THEME_COLOR_ORANGE]: styles.themeOrange,
  [THEME_COLOR_GRAY]: styles.themeGray,
};

export function TopTasksOverview() {
  const { data, isLoading } = useTopTasksStats();
  const { params, setParams } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  // Task filter from URL (global filter, shown in ActiveFiltersChips)
  const selectedTask = params.task ?? null;

  const handleTaskSelect = (taskId: string | null) => {
    setParams({
      task: taskId ?? undefined,
      page: "1",
    });
  };

  if (isLoading) return null;
  if (!data) return null;

  // Sort tasks by problem degree (high volume + low success = high priority)
  const sortedTasks = [...data.tasks].sort((a, b) => {
    const aScore = a.totalCount * (1 - a.successRate);
    const bScore = b.totalCount * (1 - b.successRate);
    return bScore - aScore;
  });

  // Filter tasks if a quadrant point is selected
  const displayTasks = selectedTask
    ? sortedTasks.filter((t) => t.taskId === selectedTask)
    : sortedTasks;

  return (
    <>
      <TopTasksStatsCards data={data} />
      <TimelineSection title="Suksessrate over tid" variant="topTasks" />
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <Box paddingBlock="space-0 space-16">
          <Heading size="small" level="2">
            Oppgavekvadrant
          </Heading>
          <BodyShort size="small" className={styles.quadrantDescription}>
            Volum vs suksessrate. Klikk på et punkt for å filtrere hele
            dashboardet.
          </BodyShort>
        </Box>
        <div className={styles.quadrantChartContainer}>
          <TaskQuadrantChart
            selectedTask={selectedTask}
            onTaskSelect={handleTaskSelect}
          />
        </div>
      </DashboardCard>
      <DashboardCard padding="0" className={styles.overflowHidden}>
        <Box
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <Heading size="small" level="2">
            {data.questionText ? `Spørsmål: ${data.questionText}` : "Spørsmål"}
          </Heading>
        </Box>
        <Box overflowX="auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Svaralternativer</Table.HeaderCell>
                <Table.HeaderCell>Suksessrate</Table.HeaderCell>
                <Table.HeaderCell align="right">Svar</Table.HeaderCell>
                <Table.HeaderCell align="right">Suksess</Table.HeaderCell>
                {/* Extra columns hidden on mobile */}
                <Hide below="md" asChild>
                  <Tooltip content="Brukeren kom delvis i mål med oppgaven">
                    <Table.HeaderCell
                      align="right"
                      className={styles.cursorHelp}
                    >
                      Delvis
                    </Table.HeaderCell>
                  </Tooltip>
                </Hide>
                <Hide below="md" asChild>
                  <Table.HeaderCell align="right">Feil</Table.HeaderCell>
                </Hide>
                {/* For expand button on right */}
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {displayTasks.map((task) => {
                const hasBlockers =
                  task.blockersByTheme &&
                  Object.keys(task.blockersByTheme).length > 0;

                // Sort themed blockers: regular themes first by count, "Annet" last
                const sortedThemes =
                  hasBlockers && task.blockersByTheme
                    ? Object.entries(task.blockersByTheme).sort(
                        ([keyA, a], [keyB, b]) => {
                          // "Annet" always last
                          if (keyA === "annet") return 1;
                          if (keyB === "annet") return -1;
                          return b.count - a.count;
                        },
                      )
                    : [];

                return (
                  <Table.ExpandableRow
                    key={task.taskId}
                    togglePlacement="right"
                    expansionDisabled={!hasBlockers}
                    content={
                      hasBlockers ? (
                        <div className={styles.expandableContent}>
                          <Heading size="xsmall" level="3" spacing>
                            Årsaker til at oppgaven stoppet
                          </Heading>
                          <VStack gap="space-12">
                            {sortedThemes.map(([themeId, theme]) => {
                              const isAnnet = themeId === "annet";
                              return (
                                <div
                                  key={themeId}
                                  className={
                                    isAnnet ? styles.themeRowDimmed : undefined
                                  }
                                >
                                  <HStack gap="space-8" align="center">
                                    {/* Color dot */}
                                    <span
                                      className={[
                                        styles.themeDot,
                                        THEME_DOT_CLASS_BY_HEX[
                                          theme.color.toLowerCase()
                                        ] ?? styles.themeGray,
                                      ].join(" ")}
                                    />
                                    <BodyShort weight="semibold">
                                      {theme.themeName} ({theme.count})
                                    </BodyShort>
                                  </HStack>
                                  {/* Example quote */}
                                  {theme.examples.length > 0 && (
                                    <BodyShort
                                      size="small"
                                      textColor="subtle"
                                      className={styles.themeExample}
                                    >
                                      "{theme.examples[0]}"
                                    </BodyShort>
                                  )}
                                </div>
                              );
                            })}
                          </VStack>
                        </div>
                      ) : null
                    }
                  >
                    <Table.DataCell>
                      <strong>{task.task}</strong>
                    </Table.DataCell>
                    <Table.DataCell>
                      <span
                        className={[
                          styles.successRate,
                          task.successRate >= 0.8
                            ? styles.successRateGood
                            : task.successRate >= 0.5
                              ? styles.successRateMedium
                              : styles.successRateLow,
                        ].join(" ")}
                      >
                        {task.formattedSuccessRate}
                      </span>
                    </Table.DataCell>
                    <Table.DataCell align="right">
                      {task.totalCount}
                    </Table.DataCell>
                    <Table.DataCell align="right">
                      {task.successCount}
                    </Table.DataCell>
                    <Hide below="md" asChild>
                      <Table.DataCell align="right">
                        {task.partialCount}
                      </Table.DataCell>
                    </Hide>
                    <Hide below="md" asChild>
                      <Table.DataCell align="right">
                        {task.failureCount}
                      </Table.DataCell>
                    </Hide>
                  </Table.ExpandableRow>
                );
              })}
            </Table.Body>
          </Table>
        </Box>
      </DashboardCard>
      <BlockerAnalysis />
      {/* Segment breakdown */}
      {surveyId && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}
      {/* Device breakdown */}
      <DeviceBreakdownSection />
    </>
  );
}
