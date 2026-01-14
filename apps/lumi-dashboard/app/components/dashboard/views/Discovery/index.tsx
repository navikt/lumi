import { TextAnalysis } from "~/components/shared/TextAnalysis";
import type { DiscoveryResponse } from "~/types/api";

interface DiscoveryAnalysisProps {
  data: DiscoveryResponse;
}

/**
 * Analyzes Discovery survey responses to identify common tasks and themes.
 * Shows word frequency cloud, theme clustering, and recent responses.
 *
 * This is now a thin wrapper around the shared TextAnalysis component.
 */
export function DiscoveryAnalysis({ data }: DiscoveryAnalysisProps) {
  const { wordFrequency, themes, recentResponses, totalSubmissions } = data;

  // Transform recentResponses to the format expected by TextAnalysis
  const transformedResponses = recentResponses.map((response) => ({
    text: response.task,
    submittedAt: response.submittedAt,
    success: response.success,
    additionalInfo: response.blocker
      ? `Hindring: ${response.blocker}`
      : undefined,
  }));

  // Transform themes to the format expected by TextAnalysis
  const transformedThemes = themes.map((theme) => ({
    theme: theme.theme,
    count: theme.count,
    examples: theme.examples,
    successRate: theme.successRate,
  }));

  return (
    <TextAnalysis
      analysisContext="GENERAL_FEEDBACK"
      wordFrequency={wordFrequency}
      themes={transformedThemes}
      recentResponses={transformedResponses}
      totalCount={totalSubmissions}
      showResponseStatus
      labels={{
        wordCloudTitle: "Ordfrekvens",
        themesTitle: "Identifiserte temaer",
        recentTitle: "Siste svar",
        recentSubtitle: "Hva brukere sier de kom for å gjøre",
        emptyMessage:
          "Ingen discovery-data tilgjengelig ennå. Data vises når brukere begynner å svare på discovery-surveyen.",
      }}
    />
  );
}
