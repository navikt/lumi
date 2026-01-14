import {
  BodyShort,
  Box,
  HStack,
  Heading,
  Hide,
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
import { TopTasksStatsCards } from "./StatsCards";

export function TopTasksOverview() {
  const { data, isLoading } = useTopTasksStats();
  const { params, setParam } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  // Task filter from URL (global filter, shown in ActiveFiltersChips)
  const selectedTask = params.task ?? null;

  const handleTaskSelect = (taskName: string | null) => {
    setParam("task", taskName ?? undefined);
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
    ? sortedTasks.filter((t) => t.task === selectedTask)
    : sortedTasks;

  return (
    <>
      <TopTasksStatsCards data={data} />

      <TimelineSection title="Suksessrate over tid" variant="topTasks" />

      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <Box.New paddingBlock="0 space-16">
          <Heading size="small">Oppgavekvadrant</Heading>
          <p
            style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", opacity: 0.7 }}
          >
            Volum vs suksessrate. Klikk på et punkt for å filtrere hele
            dashboardet.
          </p>
        </Box.New>
        <div style={{ height: "clamp(280px, 50vw, 400px)", width: "100%" }}>
          <TaskQuadrantChart
            selectedTask={selectedTask}
            onTaskSelect={handleTaskSelect}
          />
        </div>
      </DashboardCard>

      <DashboardCard padding="0" style={{ overflow: "hidden" }}>
        <Box.New
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <Heading size="small">
            {data.questionText ? `Spørsmål: ${data.questionText}` : "Spørsmål"}
          </Heading>
        </Box.New>
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
                    <Table.HeaderCell align="right" style={{ cursor: "help" }}>
                      Delvis
                    </Table.HeaderCell>
                  </Tooltip>
                </Hide>
                <Hide below="md" asChild>
                  <Table.HeaderCell align="right">Feil</Table.HeaderCell>
                </Hide>
                <Table.HeaderCell /> {/* For expand button on right */}
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
                    key={task.task}
                    togglePlacement="right"
                    expansionDisabled={!hasBlockers}
                    content={
                      hasBlockers ? (
                        <div
                          style={{
                            padding: "1rem",
                            backgroundColor: "var(--ax-bg-neutral-soft)",
                          }}
                        >
                          <Heading size="xsmall" level="4" spacing>
                            Årsaker til at oppgaven stoppet
                          </Heading>
                          <VStack gap="space-12">
                            {sortedThemes.map(([themeId, theme]) => {
                              const isAnnet = themeId === "annet";
                              return (
                                <div
                                  key={themeId}
                                  style={{
                                    opacity: isAnnet ? 0.7 : 1,
                                  }}
                                >
                                  <HStack gap="space-8" align="center">
                                    {/* Color dot */}
                                    <span
                                      style={{
                                        width: "10px",
                                        height: "10px",
                                        borderRadius: "50%",
                                        backgroundColor: theme.color,
                                        flexShrink: 0,
                                      }}
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
                                      style={{
                                        marginLeft: "18px",
                                        fontStyle: "italic",
                                        marginTop: "0.25rem",
                                      }}
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
                        style={{
                          color:
                            task.successRate >= 0.8
                              ? "var(--ax-text-success)"
                              : task.successRate >= 0.5
                                ? "var(--ax-text-warning)"
                                : "var(--ax-text-danger)",
                          fontWeight: "bold",
                        }}
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
