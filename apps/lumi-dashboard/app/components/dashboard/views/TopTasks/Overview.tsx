import {
  BodyShort,
  Box,
  Heading,
  Hide,
  Table,
  Tooltip,
} from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { BlockerAnalysis } from "~/components/dashboard/views/Discovery/BlockerAnalysis";
import { TaskQuadrantChart } from "~/components/shared/Charts/TaskQuadrantChart";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import { TopTasksStatsCards } from "./StatsCards";
import styles from "./TopTasks.module.css";

export function TopTasksOverview() {
  const topTasksQuery = useTopTasksStats();

  return (
    <DataFetchBoundary
      title="Kunne ikke hente Top Tasks-data"
      queries={[topTasksQuery]}
    >
      <TopTasksOverviewContent topTasksQuery={topTasksQuery} />
    </DataFetchBoundary>
  );
}

function TopTasksOverviewContent({
  topTasksQuery,
}: {
  topTasksQuery: ReturnType<typeof useTopTasksStats>;
}) {
  const { data, isLoading } = topTasksQuery;
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
                <Table.HeaderCell>Oppgave</Table.HeaderCell>
                <Table.HeaderCell>Suksessrate</Table.HeaderCell>
                <Table.HeaderCell align="right">Svar</Table.HeaderCell>
                <Table.HeaderCell align="right">Ja</Table.HeaderCell>
                {/* Extra columns hidden on mobile. Hide must wrap the cell
                    itself so its classes land on the <th>. describesChild
                    keeps "Delvis" as the column name for screen readers. */}
                <Hide below="md" asChild>
                  <Table.HeaderCell align="right">
                    <Tooltip
                      content="Brukeren kom delvis i mål med oppgaven"
                      describesChild
                    >
                      <span className={styles.cursorHelp}>Delvis</span>
                    </Tooltip>
                  </Table.HeaderCell>
                </Hide>
                <Hide below="md" asChild>
                  <Table.HeaderCell align="right">Nei</Table.HeaderCell>
                </Hide>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {displayTasks.map((task) => (
                <Table.Row key={task.taskId}>
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
                </Table.Row>
              ))}
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
