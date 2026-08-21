import { SPECIALIZED_SURVEY_FIELD_IDS } from "@navikt/lumi-survey";
import { TextAnalysis } from "~/components/shared/TextAnalysis";
import type { DiscoveryResponse } from "~/types/api";

interface DiscoveryAnalysisProps {
  data: DiscoveryResponse;
}

/**
 * Shows recurring tasks with concrete examples and owner-defined themes.
 */
export function DiscoveryAnalysis({ data }: DiscoveryAnalysisProps) {
  const {
    themes,
    recentResponses,
    totalSubmissions,
    phrases = [],
    quotes = [],
    confidenceLevel,
  } = data;

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
      phrases={phrases}
      quotes={quotes}
      confidenceLevel={confidenceLevel}
      phraseFieldId={SPECIALIZED_SURVEY_FIELD_IDS.task}
      themes={transformedThemes}
      recentResponses={transformedResponses}
      totalCount={totalSubmissions}
      showResponseStatus
      labels={{
        insightsTitle: "Det brukerne prøver å gjøre",
        insightsSubtitle:
          "Se hva som går igjen, og åpne svarene bak hvert uttrykk.",
        phrasesTitle: "Oppgaver som går igjen",
        examplesTitle: "Eksempler fra brukerne",
        themesTitle: "Egne oppgavetemaer",
        themesSubtitle:
          "Bruk egne temaer når dere vil følge de samme oppgavetypene over tid.",
        emptyMessage: "Her vises mønstre når de første brukerne har svart.",
      }}
    />
  );
}
