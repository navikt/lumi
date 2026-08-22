import {
  CheckmarkCircleIcon,
  ClockIcon,
  ThumbUpIcon,
} from "@navikt/aksel-icons";
import { BodyShort, Box, Heading, HStack, VStack } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { StatCard } from "~/components/dashboard/sections/StatsCards";
import type { TopTasksResponse } from "~/types/api";
import styles from "./TPI.module.css";

interface TPIDashboardProps {
  data: TopTasksResponse;
}

/**
 * Task Performance Indicator (TPI) Dashboard.
 * TPI = Completion Rate × Time Efficiency
 *
 * Shows overall TPI score, average completion time, and per-task breakdown.
 */
export function TPIDashboard({ data }: TPIDashboardProps) {
  const { tasks, overallTpi, avgCompletionTimeMs, totalSubmissions } = data;

  // Only show if TPI data is available
  const hasTpiData = tasks.some((t) => t.tpiScore !== undefined);
  if (!hasTpiData) {
    return null;
  }

  const formatTime = (ms: number) => {
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getTpiScoreClass = (score: number) => {
    if (score >= 80) return styles.scoreHigh;
    if (score >= 60) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const getTpiProgressClass = (score: number) => {
    if (score >= 80) return styles.progressHigh;
    if (score >= 60) return styles.progressMedium;
    return styles.progressLow;
  };

  return (
    <>
      {/* TPI Stats Cards */}
      <DashboardGrid columns={{ xs: 2, sm: 4 }} gap="space-16">
        <StatCard
          icon={<ThumbUpIcon fontSize="1.25rem" aria-hidden />}
          label="Overall TPI"
          value={overallTpi ? `${overallTpi}` : "–"}
          subtitle="Task Performance Indicator"
        />
        <StatCard
          icon={<ClockIcon fontSize="1.25rem" aria-hidden />}
          label="Avg. tid"
          value={avgCompletionTimeMs ? formatTime(avgCompletionTimeMs) : "–"}
          subtitle="Tid til fullføring"
        />
        <StatCard
          icon={<CheckmarkCircleIcon fontSize="1.25rem" aria-hidden />}
          label="Antall målinger"
          value={totalSubmissions.toLocaleString("no-NO")}
          subtitle="Med tidsdata"
        />
        <StatCard
          icon={<ThumbUpIcon fontSize="1.25rem" aria-hidden />}
          label="TPI mål"
          value=">75"
          subtitle="Benchmark"
        />
      </DashboardGrid>
      {/* Per-task TPI breakdown */}
      <DashboardCard padding="0" className={styles.overflowHidden}>
        <Box
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <HStack gap="space-8" align="center">
            <span className={styles.headerIcon}>
              <ThumbUpIcon fontSize="1.25rem" aria-hidden />
            </span>
            <Heading size="small" level="2">
              TPI per oppgave
            </Heading>
          </HStack>
          <BodyShort
            size="small"
            textColor="subtle"
            className={styles.introText}
          >
            TPI = Suksessrate × Tidseffektivitet (høyere er bedre)
          </BodyShort>
        </Box>

        <Box padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            {tasks
              .filter((t) => t.tpiScore !== undefined)
              .sort((a, b) => (b.tpiScore ?? 0) - (a.tpiScore ?? 0))
              .slice(0, 10)
              .map((task) => {
                const score = task.tpiScore ?? 0;
                return (
                  <div key={task.task}>
                    <HStack
                      justify="space-between"
                      align="baseline"
                      wrap={false}
                    >
                      <BodyShort size="small" weight="semibold" truncate>
                        {task.task}
                      </BodyShort>
                      <HStack gap="space-12">
                        {task.avgTimeMs && (
                          <BodyShort size="small" textColor="subtle">
                            {formatTime(task.avgTimeMs)}
                          </BodyShort>
                        )}
                        <BodyShort
                          size="small"
                          weight="semibold"
                          className={`${styles.scoreValue} ${getTpiScoreClass(score)}`}
                        >
                          {task.tpiScore}
                        </BodyShort>
                      </HStack>
                    </HStack>

                    {/* TPI bar */}
                    <progress
                      className={`${styles.progress} ${getTpiProgressClass(score)}`}
                      value={score}
                      max={100}
                      aria-label={`TPI score for ${task.task}`}
                    />

                    {/* Details row */}
                    <HStack gap="space-16" className={styles.detailsRow}>
                      <BodyShort size="small" textColor="subtle">
                        Suksess: {task.formattedSuccessRate}
                      </BodyShort>
                      {task.targetTimeMs && (
                        <BodyShort size="small" textColor="subtle">
                          Mål: {formatTime(task.targetTimeMs)}
                        </BodyShort>
                      )}
                    </HStack>
                  </div>
                );
              })}
          </VStack>
        </Box>

        {/* TPI Formula explanation */}
        <Box
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="1 0 0 0"
          borderColor="neutral-subtle"
          background="neutral-softA"
        >
          <BodyShort size="small" textColor="subtle">
            <strong>TPI Formel:</strong> TPI = Suksessrate × min(1,
            Måltid/Faktisk tid) × 100
          </BodyShort>
          <BodyShort
            size="small"
            textColor="subtle"
            className={styles.formulaText}
          >
            Høy TPI = brukere fullfører raskt og vellykket. Lav TPI = treg
            fullføring eller mange feil.
          </BodyShort>
        </Box>
      </DashboardCard>
    </>
  );
}
