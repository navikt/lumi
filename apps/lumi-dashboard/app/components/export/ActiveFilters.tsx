import { BodyShort, VStack } from "@navikt/ds-react";
import dayjs from "dayjs";
import type { SearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { useThemes } from "~/hooks/useThemes";
import { getFilterLabels } from "~/utils/filterLabels";
import { parsePhraseParam } from "~/utils/phraseFilterUtils";
import {
  formatMetadataLabel,
  formatMetadataValue,
  parseSegmentParam,
} from "~/utils/segmentUtils";

interface ActiveFiltersProps {
  params: SearchParams;
}

export function ActiveFilters({ params }: ActiveFiltersProps) {
  const segments = parseSegmentParam(params.segment);
  const segmentEntries = Object.entries(segments);
  const { data: stats } = useStats();
  const { themes } = useThemes();

  const { choiceFilters, ratingFilters, themeLabel } = getFilterLabels({
    params,
    stats,
    themes,
  });

  const phraseFilter = parsePhraseParam(params.phrase);
  const phraseLabel = phraseFilter
    ? (stats?.fieldStats?.find((f) => f.fieldId === phraseFilter.fieldId)
        ?.label ?? "Frase")
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
      {params.fromDate && (
        <BodyShort size="small" spacing>
          <strong>Fra:</strong> {dayjs(params.fromDate).format("DD.MM.YYYY")}
        </BodyShort>
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
          <strong>Filter:</strong> Kun med tekst
        </BodyShort>
      )}
      {params.lowRating === "true" && (
        <BodyShort size="small" spacing>
          <strong>Filter:</strong> Kun lave vurderinger (1-2)
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
      {params.task && (
        <BodyShort size="small" spacing>
          <strong>Oppgave:</strong> {params.task}
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
