import { TasklistIcon } from "@navikt/aksel-icons";
import { BodyShort, Box, HStack, Heading, VStack } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { StatCard } from "~/components/dashboard/sections/StatsCards";
import type { TaskPriorityResponse } from "~/types/api";

interface TaskPriorityAnalysisProps {
  data: TaskPriorityResponse;
}

/**
 * Visualizes Task Priority survey results with the "long neck" distribution.
 * Shows which tasks users consider most important.
 */
export function TaskPriorityAnalysis({ data }: TaskPriorityAnalysisProps) {
  const { tasks, totalSubmissions, longNeckCutoff, cumulativePercentageAt5 } =
    data;

  if (totalSubmissions === 0) {
    return (
      <DashboardCard>
        <BodyShort textColor="subtle">
          Ingen priority-data tilgjengelig ennå. For statistisk signifikans
          trenger du 400+ svar.
        </BodyShort>
      </DashboardCard>
    );
  }

  const maxVotes = tasks[0]?.votes ?? 1;

  return (
    <>
      {/* Stats Cards */}
      <DashboardGrid columns={{ xs: 2, sm: 3 }} gap="space-16">
        <StatCard
          icon={<TasklistIcon fontSize="1.25rem" aria-hidden />}
          label="Antall svar"
          value={totalSubmissions.toLocaleString("no-NO")}
          subtitle="Statistisk signifikans: 400+"
        />
        <StatCard
          icon={<TasklistIcon fontSize="1.25rem" aria-hidden />}
          label="Long Neck"
          value={`${longNeckCutoff} oppgaver`}
          subtitle="Utgjør 80% av stemmene"
        />
        <StatCard
          icon={<TasklistIcon fontSize="1.25rem" aria-hidden />}
          label="Top 5 dekning"
          value={`${cumulativePercentageAt5}%`}
          subtitle="Av alle stemmer"
        />
      </DashboardGrid>

      {/* Long Neck Chart */}
      <DashboardCard padding="0" style={{ overflow: "hidden" }}>
        <Box.New
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <HStack gap="space-8" align="center">
            <span
              style={{
                color: "var(--ax-text-neutral-subtle)",
                display: "flex",
              }}
            >
              <TasklistIcon fontSize="1.25rem" aria-hidden />
            </span>
            <Heading size="small">Task Priority - "Long Neck"</Heading>
          </HStack>
          <BodyShort
            size="small"
            textColor="subtle"
            style={{ marginTop: "0.25rem" }}
          >
            Oppgavene brukerne mener er viktigst. Prosent = andel av alle
            stemmer.
          </BodyShort>
        </Box.New>

        <Box.New padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            {tasks.slice(0, 15).map((task, index) => {
              const barWidth = (task.votes / maxVotes) * 100;
              const isTopTask = index < longNeckCutoff;

              return (
                <div key={task.task}>
                  <HStack justify="space-between" align="baseline" wrap={false}>
                    <BodyShort
                      size="small"
                      weight={isTopTask ? "semibold" : "regular"}
                      truncate
                      style={{ flex: 1 }}
                    >
                      {index + 1}. {task.task}
                    </BodyShort>
                    <BodyShort
                      size="small"
                      textColor="subtle"
                      style={{ flexShrink: 0, marginLeft: "0.5rem" }}
                    >
                      {task.votes} ({task.percentage}%)
                    </BodyShort>
                  </HStack>

                  {/* Progress bar */}
                  <div
                    style={{
                      marginTop: "0.25rem",
                      height: "8px",
                      borderRadius: "4px",
                      backgroundColor: "var(--ax-bg-neutral-moderate)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        borderRadius: "4px",
                        backgroundColor: isTopTask
                          ? "var(--ax-status-success)"
                          : "var(--ax-border-neutral-subtle)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Long neck cutoff line */}
                  {index === longNeckCutoff - 1 && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.75rem",
                        borderTop: "2px dashed var(--ax-border-warning)",
                      }}
                    >
                      <BodyShort size="small" textColor="subtle">
                        ↑ "Long Neck" - disse {longNeckCutoff} oppgavene utgjør
                        80% av stemmene
                      </BodyShort>
                    </div>
                  )}
                </div>
              );
            })}
          </VStack>

          {tasks.length > 15 && (
            <Box.New
              marginBlock="space-16 0"
              paddingBlock="space-12"
              borderWidth="1 0 0 0"
              borderColor="neutral-subtle"
            >
              <BodyShort size="small" textColor="subtle">
                + {tasks.length - 15} flere oppgaver med færre stemmer
              </BodyShort>
            </Box.New>
          )}
        </Box.New>
      </DashboardCard>
    </>
  );
}
