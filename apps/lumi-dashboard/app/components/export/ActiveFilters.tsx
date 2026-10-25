import { BodyShort, VStack } from "@navikt/ds-react";
import dayjs from "dayjs";
import type { SearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { useThemes } from "~/hooks/useThemes";
import { isSinceFirst, sinceFirstLabel } from "~/utils/dashboardPeriod";
import { getFilterLabels } from "~/utils/filterLabels";
import { parsePhraseParam } from "~/utils/phraseFilterUtils";
import {
  formatMetadataLabel,
  formatMetadataValue,
  parseSegmentParam,
} from "~/utils/segmentUtils";

interface ActiveFiltersProps {
  params: SearchParams;
  /** The first answer for the selection: the start of «Fra første svar». */
  firstAnswerDate?: string;
}

export function ActiveFilters({ params, firstAnswerDate }: ActiveFiltersProps) {
  const segments = parseSegmentParam(params.segment);
  const segmentEntries = Object.entries(segments);
  const { data: stats, isPending: isStatsPending } = useStats();
  const { themes } = useThemes();

  const { choiceFilters, ratingFilters, taskLabel, themeLabel } =
    getFilterLabels({
      params,
      stats,
      isStatsPending,
      themes,
    });

  const phraseFilter = parsePhraseParam(params.phrase);
  const phraseLabel = phraseFilter
    ? (stats?.fieldStats?.find((f) => f.fieldId === phraseFilter.fieldId)
        ?.label ?? "Uttrykk")
    : undefined;

  return (
    <VStack gap="space-12">
      {params.app && params.app !== "alle" && (
        <BodyShort size="small" spacing>
          <strong>App:</strong> {params.app}
        </BodyShort>
      )}
      {params.surveyId && params.surveyId !== "alle" && (
        <BodyShort size="small" spacing>
          <strong>Survey:</strong> {params.surveyId}
        </BodyShort>
      )}
      {isSinceFirst(params) ? (
        <BodyShort size="small" spacing>
          <strong>Periode:</strong> {sinceFirstLabel(firstAnswerDate)}
        </BodyShort>
      ) : (
        params.fromDate && (
          <BodyShort size="small" spacing>
            <strong>Fra:</strong> {dayjs(params.fromDate).format("DD.MM.YYYY")}
          </BodyShort>
        )
      )}
      {params.toDate && (
        <BodyShort size="small" spacing>
          <strong>Til:</strong> {dayjs(params.toDate).format("DD.MM.YYYY")}
        </BodyShort>
      )}
      {params.query && (
        <BodyShort size="small" spacing>
          <strong>Søk:</strong> {params.query}
        </BodyShort>
      )}
      {params.hasText === "true" && (
        <BodyShort size="small" spacing>
          <strong>Vis kun:</strong> Med tekstsvar
        </BodyShort>
      )}
      {params.lowRating === "true" && (
        <BodyShort size="small" spacing>
          <strong>Vis kun:</strong> Lav score
        </BodyShort>
      )}
      {params.tag && (
        <BodyShort size="small" spacing>
          <strong>Tags:</strong> {params.tag}
        </BodyShort>
      )}
      {params.deviceType && (
        <BodyShort size="small" spacing>
          <strong>Enhet:</strong>{" "}
          {params.deviceType === "mobile"
            ? "Mobil"
            : params.deviceType === "desktop"
              ? "Desktop"
              : params.deviceType === "tablet"
                ? "Nettbrett"
                : "Alle"}
        </BodyShort>
      )}
      {themeLabel && (
        <BodyShort size="small" spacing>
          <strong>Tema:</strong> {themeLabel}
        </BodyShort>
      )}
      {taskLabel && (
        <BodyShort size="small" spacing>
          <strong>Oppgave:</strong> {taskLabel}
        </BodyShort>
      )}
      {ratingFilters.map((filter) => (
        <BodyShort key={filter.key} size="small" spacing>
          <strong>{filter.label}:</strong> {filter.value}
        </BodyShort>
      ))}
      {choiceFilters.map((filter) => (
        <BodyShort key={filter.key} size="small" spacing>
          <strong>{filter.label}:</strong> {filter.value}
        </BodyShort>
      ))}

      {phraseFilter && phraseLabel && (
        <BodyShort size="small" spacing>
          <strong>{phraseLabel}:</strong> «{phraseFilter.surface}»
        </BodyShort>
      )}

      {segmentEntries.length > 0 && (
        <VStack gap="space-4">
          <BodyShort size="small" spacing>
            <strong>Segmentering:</strong>
          </BodyShort>
          {segmentEntries.map(([key, value]) => (
            <BodyShort key={key} size="small" spacing>
              {formatMetadataLabel(key)}: {formatMetadataValue(value)}
            </BodyShort>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
