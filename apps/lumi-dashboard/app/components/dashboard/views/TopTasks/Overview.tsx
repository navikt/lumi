import {
  BodyShort,
  Box,
  Heading,
  Hide,
  Table,
  Tooltip,
} from "@navikt/ds-react";
import { useId } from "react";
import { DashboardCard } from "~/components/dashboard";
import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { BlockerAnalysis } from "~/components/dashboard/views/Discovery/BlockerAnalysis";
import { TaskQuadrantChart } from "~/components/shared/Charts/TaskQuadrantChart";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useContextTags } from "~/hooks/useContextTags";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import {
  describeAnalysisBudget,
  isAnalysisBudgetError,
} from "~/utils/analysisBudget";
import { Skeleton as TopTasksSkeleton } from "./Skeleton";
import { TopTasksStatsCards } from "./StatsCards";
import styles from "./TopTasks.module.css";

export function TopTasksOverview() {
  const topTasksQuery = useTopTasksStats();
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;
  // The same query as in SegmentBreakdown, read here to place it.
  const segmentsQuery = useContextTags(surveyId ?? "");

  // Enheter and Segmentering have their own queries and stay useful when the
  // Top Tasks analysis fails. With a task, the analysis filters on it in the
  // database, while Segmentering filters on it in memory. Either can then
  // hit the limit. Segmentering waits until the analysis has loaded, and it
  // is left out when the API turns both down. The page then has one alert
  // about the period.
  const hideSegments =
    Boolean(params.task) &&
    (topTasksQuery.isPending ||
      (isAnalysisBudgetError(topTasksQuery.error) &&
        isAnalysisBudgetError(segmentsQuery.error)));

  return (
    <>
      <DataFetchBoundary
        title="Kunne ikke hente Top Tasks-data"
        analysisBudgetDescription={describeAnalysisBudget("Top Tasks-analysen")}
        queries={[topTasksQuery]}
      >
        <TopTasksOverviewContent topTasksQuery={topTasksQuery} />
      </DataFetchBoundary>
      {surveyId && !hideSegments && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}
      <DeviceBreakdownSection />
    </>
  );
}

function TopTasksOverviewContent({
  topTasksQuery,
}: {
  topTasksQuery: ReturnType<typeof useTopTasksStats>;
}) {
  const { data, isLoading } = topTasksQuery;
  const { params, setParams } = useSearchParams();

  // Task filter from URL (global filter, shown in ActiveFiltersChips)
  const selectedTask = params.task ?? null;
  const tableHeadingId = useId();

  const handleTaskSelect = (taskId: string | null) => {
    setParams({
      task: taskId ?? undefined,
      page: "1",
    });
  };

  // The sections below the analysis render right away. The skeleton keeps its
  // place.
  if (isLoading) return <TopTasksSkeleton />;
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
          <Heading size="small" level="2" id={tableHeadingId}>
            {data.questionText ? `Spørsmål: ${data.questionText}` : "Spørsmål"}
          </Heading>
        </Box>
        {/* A narrow screen scrolls the table sideways, so keyboards can
            focus the region. */}
        <Box
          overflowX="auto"
          tabIndex={0}
          role="region"
          aria-labelledby={tableHeadingId}
        >
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
    </>
  );
}
