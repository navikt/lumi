import { FunnelIcon } from "@navikt/aksel-icons";
import {
  ActionMenu,
  Box,
  Button,
  Chips,
  HGrid,
  HStack,
  Label,
  Tag,
  VStack,
} from "@navikt/ds-react";
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

  const activeCount =
    [
      params.task,
      params.theme,
      params.deviceType && params.deviceType !== "alle",
      params.hasText === "true",
      params.lowRating === "true",
      selectedTags.length > 0,
      params.segment,
    ].filter(Boolean).length +
    Object.keys(activeRatingFilters).length +
    Object.keys(activeChoiceFilters).length;

  const themeValueLabel =
    themeLabel ??
    (params.theme === "uncategorized" ? "Annet" : (params.theme ?? ""));

  const answerFilterFields = stats?.fieldStats?.filter(
    (field) => isChoiceField(field) || isRatingField(field),
  );
  const showAnswerFilters =
    !!params.surveyId && (answerFilterFields?.length ?? 0) > 0;
  const hasActiveChartFilters = Boolean(params.task || params.theme);

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

              {features.showTextFilter || features.showRatingFilter ? (
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

                  {features.showRatingFilter ? (
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
                            newTags.length > 0 ? newTags.join(",") : undefined,
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

              {showAnswerFilters ? (
                <>
                  <div className={styles.menuDivider} />

                  <VStack gap="space-12" className={styles.menuSection}>
                    <Label size="small">Svar-filtre</Label>

                    {/* v1: Single-select per field (RadioGroup) — also for MULTI_CHOICE.
                        Multi-select per field is a future enhancement. */}
                    {answerFilterFields?.map((field) => {
                      if (isChoiceField(field)) {
                        return (
                          <ActionMenu.RadioGroup
                            key={field.fieldId}
                            label={field.label}
                            value={activeChoiceFilters[field.fieldId] ?? ""}
                            onValueChange={(value) => {
                              if (value === "") {
                                removeChoice(field.fieldId);
                              } else {
                                toggleChoice(field.fieldId, value);
                              }
                            }}
                          >
                            <ActionMenu.RadioItem value="">
                              Alle
                            </ActionMenu.RadioItem>
                            {Object.entries(field.stats.distribution).map(
                              ([optionId, data]) => (
                                <ActionMenu.RadioItem
                                  key={optionId}
                                  value={optionId}
                                >
                                  {`${data.label} (${data.count})`}
                                </ActionMenu.RadioItem>
                              ),
                            )}
                          </ActionMenu.RadioGroup>
                        );
                      }

                      const ratingStats = field.stats as RatingStats & {
                        ratingVariant?: string;
                      };
                      const variant = inferRatingVariantFromDistribution(
                        field.stats.distribution,
                        ratingStats.ratingVariant,
                      );

                      return (
                        <ActionMenu.RadioGroup
                          key={field.fieldId}
                          label={field.label}
                          value={activeRatingFilters[field.fieldId] ?? ""}
                          onValueChange={(value) => {
                            if (value === "") {
                              removeRating(field.fieldId);
                            } else {
                              toggleRating(field.fieldId, value);
                            }
                          }}
                        >
                          <ActionMenu.RadioItem value="">
                            Alle
                          </ActionMenu.RadioItem>
                          {getRatingValues(variant).map((value) => (
                            <ActionMenu.RadioItem
                              key={value}
                              value={String(value)}
                            >
                              {`${formatRatingFilterLabel(value, variant)} (${field.stats.distribution[String(value)] ?? 0})`}
                            </ActionMenu.RadioItem>
                          ))}
                        </ActionMenu.RadioGroup>
                      );
                    })}
                  </VStack>
                </>
              ) : null}

              {hasActiveChartFilters ? (
                <>
                  <div className={styles.menuDivider} />

                  <VStack gap="space-8" className={styles.menuSection}>
                    <Label size="small">Aktive grafer-filtre</Label>
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
                  </VStack>
                </>
              ) : null}
            </VStack>
          </HGrid>
        </Box>
      </ActionMenu.Content>
    </ActionMenu>
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
  if (variant === "nps") return [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  return [5, 4, 3, 2, 1];
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
