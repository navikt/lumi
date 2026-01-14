import { TextAnalysis } from "~/components/shared/TextAnalysis";
import { useBlockerStats } from "~/hooks/useBlockerStats";
import type { BlockerResponse } from "~/types/api";

interface BlockerAnalysisProps {
  /** Optional - if provided, use this data instead of fetching */
  data?: BlockerResponse;
}

/**
 * Analyzes blocker patterns using keyword-based themes.
 * Supports creating and editing blocker themes from word cloud.
 *
 * This is now a thin wrapper around the shared TextAnalysis component.
 */
export function BlockerAnalysis({ data: providedData }: BlockerAnalysisProps) {
  const blockerQuery = useBlockerStats();

  // Use provided data or fetch from hook
  const data = providedData ?? blockerQuery.data;
  const isLoading =
    !providedData && (blockerQuery.isLoading || blockerQuery.isFetching);

  if (!data && !isLoading) {
    return null;
  }

  // Transform recentBlockers to the format expected by TextAnalysis
  const transformedResponses = (data?.recentBlockers ?? []).map((blocker) => ({
    text: blocker.blocker,
    submittedAt: blocker.submittedAt,
    additionalInfo: `Oppgave: ${blocker.task}`,
  }));

  // Transform themes to the format expected by TextAnalysis
  const transformedThemes = (data?.themes ?? []).map((theme) => ({
    theme: theme.theme,
    themeId: theme.themeId,
    count: theme.count,
    examples: theme.examples,
    color: theme.color,
  }));

  return (
    <TextAnalysis
      analysisContext="BLOCKER"
      wordFrequency={data?.wordFrequency ?? []}
      themes={transformedThemes}
      recentResponses={transformedResponses}
      totalCount={data?.totalBlockers ?? 0}
      isLoading={isLoading && !data}
      labels={{
        wordCloudTitle: "Ordfrekvens",
        themesTitle: "Blocker-mønstre",
        recentTitle: "Siste blocker-svar",
        recentSubtitle: "Nylige hindringer brukere har rapportert",
        emptyMessage: "Ingen blocker-data tilgjengelig ennå.",
      }}
    />
  );
}
