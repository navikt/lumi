import { FunnelIcon } from "@navikt/aksel-icons";
import {
  ActionMenu,
  BodyShort,
  Box,
  Button,
  Chips,
  HGrid,
  HStack,
  Tag,
  VStack,
} from "@navikt/ds-react";
import { useRef } from "react";
import { ContextTagsFilter } from "~/components/dashboard/ContextTagsFilter";
import type { SurveyFeatureConfig } from "~/config/surveyConfig";
import { useChoiceFilter } from "~/hooks/useChoiceFilter";
import { useRatingFilter } from "~/hooks/useRatingFilter";
import type { SearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type { ChoiceStats, FieldStat, RatingStats } from "~/types/api";
import {
  inferRatingVariantFromDistribution,
  type RatingVariant,
} from "~/utils/ratingDisplay";
import styles from "./FilterBar.module.css";

interface FilterMenuProps {
  params: SearchParams;
  setParams: (params: Partial<SearchParams>) => void;
  features: SurveyFeatureConfig;
  allTags: string[];
  selectedTags: string[];
  themeLabel?: string;
}

export function FilterMenu({
  params,
  setParams,
  features,
  allTags,
  selectedTags,
  themeLabel,
}: FilterMenuProps) {
  const { data: stats } = useStats();
  const {
    activeFilters: activeChoiceFilters,
    toggleChoice,
    removeChoice,
  } = useChoiceFilter();
  const {
    activeFilters: activeRatingFilters,
    toggleRating,
    removeRating,
  } = useRatingFilter();

  const answerFilterFields = stats?.fieldStats?.filter(
    (field) => isChoiceField(field) || isRatingField(field),
  );

  // Cache the last non-empty answer filter fields so filters survive
  // the anonymity threshold (fieldStats is emptied when count < 5)
  const cachedFieldsRef = useRef(answerFilterFields);
  if (answerFilterFields && answerFilterFields.length > 0) {
    cachedFieldsRef.current = answerFilterFields;
  }
  const visibleFields = cachedFieldsRef.current;

  const showAnswerFilters =
    !!params.surveyId && (visibleFields?.length ?? 0) > 0;
  const hasRatingAnswerFilter =
    visibleFields?.some((f) => isRatingField(f)) ?? false;
  const hasActiveChartFilters = Boolean(params.task || params.theme);

  const activeCount =
    [
      params.task,
      params.theme,
      params.deviceType && params.deviceType !== "alle",
      params.hasText === "true",
      !hasRatingAnswerFilter && params.lowRating === "true",
      selectedTags.length > 0,
      params.segment,
    ].filter(Boolean).length +
    Object.keys(activeRatingFilters).length +
    Object.keys(activeChoiceFilters).length;

  const themeValueLabel =
    themeLabel ??
    (params.theme === "uncategorized" ? "Annet" : (params.theme ?? ""));

  return (
    <ActionMenu>
      <ActionMenu.Trigger>
        <Button
          data-color="neutral"
          variant="secondary"
          size="small"
          icon={<FunnelIcon aria-hidden />}
        >
          <HStack gap="space-4" align="center">
            <span>Filter</span>
            {activeCount > 0 ? (
              <Tag data-color="info" size="small" variant="outline">
                {activeCount}
              </Tag>
            ) : null}
          </HStack>
        </Button>
      </ActionMenu.Trigger>
      <ActionMenu.Content className={styles.actionMenuContent}>
        <Box padding="space-12">
          <VStack gap="space-16">
            {/* General filters: 2-column grid */}
            <HGrid columns={{ xs: 1, md: 2 }} gap="space-16">
              <VStack gap="space-12">
                {features.showDeviceFilter ? (
                  <ActionMenu.RadioGroup
                    label="Enhet"
                    value={params.deviceType ?? ""}
                    onValueChange={(value) =>
                      setParams({
                        deviceType: value || undefined,
                        page: "1",
                      })
                    }
                  >
                    <ActionMenu.RadioItem value="">
                      Alle enheter
                    </ActionMenu.RadioItem>
                    <ActionMenu.RadioItem value="desktop">
                      Desktop
                    </ActionMenu.RadioItem>
                    <ActionMenu.RadioItem value="mobile">
                      Mobil
                    </ActionMenu.RadioItem>
                    <ActionMenu.RadioItem value="tablet">
                      Nettbrett
                    </ActionMenu.RadioItem>
                  </ActionMenu.RadioGroup>
                ) : null}

                {features.showTextFilter ||
                (features.showRatingFilter && !hasRatingAnswerFilter) ? (
                  <ActionMenu.Group label="Vis kun">
                    {features.showTextFilter ? (
                      <ActionMenu.CheckboxItem
                        checked={params.hasText === "true"}
                        onCheckedChange={(checked) =>
                          setParams({
                            hasText: checked ? "true" : undefined,
                            page: "1",
                          })
                        }
                      >
                        Med tekstsvar
                      </ActionMenu.CheckboxItem>
                    ) : null}

                    {features.showRatingFilter && !hasRatingAnswerFilter ? (
                      <ActionMenu.CheckboxItem
                        checked={params.lowRating === "true"}
                        onCheckedChange={(checked) =>
                          setParams({
                            lowRating: checked ? "true" : undefined,
                            page: "1",
                          })
                        }
                      >
                        Lav score (1-2)
                      </ActionMenu.CheckboxItem>
                    ) : null}
                  </ActionMenu.Group>
                ) : null}
              </VStack>

              <VStack gap="space-12">
                {features.showTagsFilter && allTags.length > 0 ? (
                  <ActionMenu.Group label="Tags">
                    {allTags.map((tag) => (
                      <ActionMenu.CheckboxItem
                        key={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={(checked) => {
                          const newTags = checked
                            ? [...selectedTags, tag]
                            : selectedTags.filter(
                                (selectedTag) => selectedTag !== tag,
                              );
                          setParams({
                            tag:
                              newTags.length > 0
                                ? newTags.join(",")
                                : undefined,
                            page: "1",
                          });
                        }}
                      >
                        {tag}
                      </ActionMenu.CheckboxItem>
                    ))}
                  </ActionMenu.Group>
                ) : null}

                {params.surveyId ? (
                  <ContextTagsFilter surveyId={params.surveyId} />
                ) : null}
              </VStack>
            </HGrid>

            {/* Answer filters: full-width section with horizontal Chips */}
            {showAnswerFilters ? (
              <>
                <div className={styles.menuDivider} />
                <Box
                  background="neutral-soft"
                  borderRadius="8"
                  padding="space-12"
                >
                  <ActionMenu.Group label="Svar-filtre">
                    <HGrid
                      columns={{
                        xs: 1,
                        md: (visibleFields?.length ?? 0) > 1 ? 2 : 1,
                      }}
                      gap="space-12"
                    >
                      {visibleFields?.map((field) => {
                        if (isChoiceField(field)) {
                          return (
                            <ChoiceFilterChips
                              key={field.fieldId}
                              field={field}
                              activeValue={
                                activeChoiceFilters[field.fieldId] ?? null
                              }
                              onToggle={(optionId) =>
                                toggleChoice(field.fieldId, optionId)
                              }
                              onClear={() => removeChoice(field.fieldId)}
                            />
                          );
                        }

                        return (
                          <RatingFilterChips
                            key={field.fieldId}
                            field={field}
                            activeValue={
                              activeRatingFilters[field.fieldId] ?? null
                            }
                            onToggle={(value) =>
                              toggleRating(field.fieldId, value)
                            }
                            onClear={() => removeRating(field.fieldId)}
                          />
                        );
                      })}
                    </HGrid>
                  </ActionMenu.Group>
                </Box>
              </>
            ) : null}

            {/* Active chart filters */}
            {hasActiveChartFilters ? (
              <>
                <div className={styles.menuDivider} />
                <ActionMenu.Group label="Aktive grafer-filtre">
                  <Chips size="small">
                    {params.theme ? (
                      <Chips.Removable
                        variant="neutral"
                        onDelete={() =>
                          setParams({
                            theme: undefined,
                            page: "1",
                          })
                        }
                      >
                        {`Tema: ${themeValueLabel}`}
                      </Chips.Removable>
                    ) : null}

                    {params.task ? (
                      <Chips.Removable
                        variant="neutral"
                        onDelete={() =>
                          setParams({
                            task: undefined,
                            page: "1",
                          })
                        }
                      >
                        {`Oppgave: ${params.task}`}
                      </Chips.Removable>
                    ) : null}
                  </Chips>
                </ActionMenu.Group>
              </>
            ) : null}
          </VStack>
        </Box>
      </ActionMenu.Content>
    </ActionMenu>
  );
}

function ChoiceFilterChips({
  field,
  activeValue,
  onToggle,
  onClear,
}: {
  field: FieldStat & { stats: ChoiceStats };
  activeValue: string | null;
  onToggle: (optionId: string) => void;
  onClear: () => void;
}) {
  return (
    <VStack gap="space-4">
      <BodyShort size="small">{field.label}</BodyShort>
      <Chips size="small">
        {Object.entries(field.stats.distribution).map(([optionId, data]) => (
          <Chips.Toggle
            key={optionId}
            data-color="neutral"
            selected={activeValue === optionId}
            onClick={() => {
              if (activeValue === optionId) {
                onClear();
              } else {
                onToggle(optionId);
              }
            }}
          >
            {data.label}
          </Chips.Toggle>
        ))}
      </Chips>
    </VStack>
  );
}

function RatingFilterChips({
  field,
  activeValue,
  onToggle,
  onClear,
}: {
  field: FieldStat & { stats: RatingStats };
  activeValue: string | null;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const ratingStats = field.stats as RatingStats & {
    ratingVariant?: string;
  };
  const variant = inferRatingVariantFromDistribution(
    field.stats.distribution,
    ratingStats.ratingVariant,
  );

  return (
    <VStack gap="space-4">
      <BodyShort size="small">{field.label}</BodyShort>
      <Chips size="small">
        {getRatingValues(variant).map((value) => (
          <Chips.Toggle
            key={value}
            data-color="neutral"
            selected={activeValue === String(value)}
            onClick={() => {
              if (activeValue === String(value)) {
                onClear();
              } else {
                onToggle(String(value));
              }
            }}
          >
            {formatRatingFilterLabel(value, variant)}
          </Chips.Toggle>
        ))}
      </Chips>
    </VStack>
  );
}

function isChoiceField(field: FieldStat): field is FieldStat & {
  fieldType: "SINGLE_CHOICE" | "MULTI_CHOICE";
  stats: ChoiceStats;
} {
  return (
    (field.fieldType === "SINGLE_CHOICE" ||
      field.fieldType === "MULTI_CHOICE") &&
    field.stats.type === "choice"
  );
}

function isRatingField(
  field: FieldStat,
): field is FieldStat & { fieldType: "RATING"; stats: RatingStats } {
  return field.fieldType === "RATING" && field.stats.type === "rating";
}

function getRatingValues(variant: RatingVariant): number[] {
  if (variant === "thumbs") return [2, 1];
  if (variant === "nps") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return [1, 2, 3, 4, 5];
}

function formatRatingFilterLabel(
  value: number,
  variant: RatingVariant,
): string {
  if (variant === "thumbs") {
    return value === 2 ? "Ja" : "Nei";
  }

  return String(value);
}
