import { TasklistIcon } from "@navikt/aksel-icons";
import { BodyShort, Box, Heading, HStack, VStack } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { StatCard } from "~/components/dashboard/sections/StatsCards";
import type { TaskPriorityResponse } from "~/types/api";
import styles from "./TaskPriority.module.css";

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
      <DashboardCard padding="0" className={styles.overflowHidden}>
        <Box
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <HStack gap="space-8" align="center">
            <span className={styles.headerIcon}>
              <TasklistIcon fontSize="1.25rem" aria-hidden />
            </span>
            <Heading size="small">Task Priority - "Long Neck"</Heading>
          </HStack>
          <BodyShort
            size="small"
            textColor="subtle"
            className={styles.introText}
          >
            Oppgavene brukerne mener er viktigst. Prosent = andel av alle
            stemmer.
          </BodyShort>
        </Box>

        <Box padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            {tasks.slice(0, 15).map((task, index) => {
              const isTopTask = index < longNeckCutoff;

              return (
                <div key={task.taskId}>
                  <HStack justify="space-between" align="baseline" wrap={false}>
                    <BodyShort
                      size="small"
                      weight={isTopTask ? "semibold" : "regular"}
                      truncate
                      className={styles.taskLabel}
                    >
                      {index + 1}. {task.task}
                    </BodyShort>
                    <BodyShort
                      size="small"
                      textColor="subtle"
                      className={styles.taskCount}
                    >
                      {task.votes} ({task.percentage}%)
                    </BodyShort>
                  </HStack>

                  {/* Progress bar */}
                  <progress
                    className={`${styles.progress} ${isTopTask ? styles.progressTop : styles.progressRegular}`}
                    value={task.votes}
                    max={maxVotes}
                    aria-label={`${task.task}: ${task.votes} stemmer (${task.percentage} prosent)`}
                  />

                  {/* Long neck cutoff line */}
                  {index === longNeckCutoff - 1 && (
                    <div className={styles.cutoff}>
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
            <Box
              marginBlock="space-16 space-0"
              paddingBlock="space-12"
              borderWidth="1 0 0 0"
              borderColor="neutral-subtle"
            >
              <BodyShort size="small" textColor="subtle">
                + {tasks.length - 15} flere oppgaver med færre stemmer
              </BodyShort>
            </Box>
          )}
        </Box>
      </DashboardCard>
    </>
  );
}
