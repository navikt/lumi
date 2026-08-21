import { SPECIALIZED_SURVEY_FIELD_IDS } from "@navikt/lumi-survey";
import { TextAnalysis } from "~/components/shared/TextAnalysis";
import { useBlockerStats } from "~/hooks/useBlockerStats";
import type { BlockerResponse } from "~/types/api";

interface BlockerAnalysisProps {
  /** Optional - if provided, use this data instead of fetching */
  data?: BlockerResponse;
}

/**
 * Shows recurring blockers with concrete examples and owner-defined themes.
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
      phrases={data?.phrases ?? []}
      quotes={data?.quotes ?? []}
      confidenceLevel={data?.confidenceLevel}
      phraseFieldId={SPECIALIZED_SURVEY_FIELD_IDS.blocker}
      themes={transformedThemes}
      recentResponses={transformedResponses}
      totalCount={data?.totalBlockers ?? 0}
      isLoading={isLoading && !data}
      labels={{
        insightsTitle: "Det som hindrer brukerne",
        insightsSubtitle:
          "Se hva som går igjen, og åpne svarene bak hvert uttrykk.",
        phrasesTitle: "Hindringer som går igjen",
        examplesTitle: "Eksempler fra brukerne",
        themesTitle: "Egne hindringstemaer",
        themesSubtitle:
          "Bruk egne temaer når dere vil følge de samme hindringene over tid.",
        emptyMessage: "Her vises mønstre når brukerne rapporterer hindringer.",
      }}
    />
  );
}
