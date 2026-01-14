import { DownloadIcon, FileTextIcon, TableIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Button,
  HStack,
  Heading,
  VStack,
} from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import type { TopTasksResponse } from "~/types/api";

interface TopTasksExportProps {
  data: TopTasksResponse;
  surveyId?: string;
}

/**
 * Export panel for Top Tasks data.
 * Provides CSV and JSON export options for task performance data.
 */
export function TopTasksExport({ data, surveyId }: TopTasksExportProps) {
  const exportCsv = () => {
    const headers = [
      "Oppgave",
      "Antall svar",
      "Suksessrate",
      "Suksess",
      "Delvis",
      "Feil",
      "TPI Score",
      "Avg. Tid (ms)",
    ];

    const rows = data.tasks.map((task) => [
      task.task,
      task.totalCount.toString(),
      task.formattedSuccessRate,
      task.successCount.toString(),
      task.partialCount.toString(),
      task.failureCount.toString(),
      task.tpiScore?.toString() || "",
      task.avgTimeMs?.toString() || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    downloadFile(
      csvContent,
      `top-tasks-${surveyId || "export"}.csv`,
      "text/csv",
    );
  };

  const exportJson = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      surveyId,
      summary: {
        totalSubmissions: data.totalSubmissions,
        overallTpi: data.overallTpi,
        avgCompletionTimeMs: data.avgCompletionTimeMs,
      },
      tasks: data.tasks.map((task) => ({
        task: task.task,
        totalCount: task.totalCount,
        successRate: task.successRate,
        successCount: task.successCount,
        partialCount: task.partialCount,
        failureCount: task.failureCount,
        tpiScore: task.tpiScore,
        avgTimeMs: task.avgTimeMs,
        targetTimeMs: task.targetTimeMs,
        blockerCounts: task.blockerCounts,
      })),
      dailyStats: data.dailyStats,
    };

    downloadFile(
      JSON.stringify(exportData, null, 2),
      `top-tasks-${surveyId || "export"}.json`,
      "application/json",
    );
  };

  const downloadFile = (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardCard padding="0" style={{ overflow: "hidden" }}>
      <Box.New
        padding={{ xs: "space-16", md: "space-24" }}
        borderWidth="0 0 1 0"
        borderColor="neutral-subtle"
      >
        <HStack gap="space-8" align="center">
          <span
            style={{ color: "var(--ax-text-neutral-subtle)", display: "flex" }}
          >
            <DownloadIcon fontSize="1.25rem" aria-hidden />
          </span>
          <Heading size="small">Eksporter data</Heading>
        </HStack>
        <BodyShort
          size="small"
          textColor="subtle"
          style={{ marginTop: "0.25rem" }}
        >
          Last ned Top Tasks data for videre analyse
        </BodyShort>
      </Box.New>

      <Box.New padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <HStack gap="space-12">
            <Button
              variant="secondary"
              size="small"
              icon={<TableIcon aria-hidden />}
              onClick={exportCsv}
            >
              Eksporter CSV
            </Button>
            <Button
              variant="secondary"
              size="small"
              icon={<FileTextIcon aria-hidden />}
              onClick={exportJson}
            >
              Eksporter JSON
            </Button>
          </HStack>

          <BodyShort size="small" textColor="subtle">
            Inkluderer: {data.tasks.length} oppgaver, {data.totalSubmissions}{" "}
            svar
            {data.overallTpi !== undefined && `, TPI ${data.overallTpi}`}
          </BodyShort>
        </VStack>
      </Box.New>
    </DashboardCard>
  );
}
