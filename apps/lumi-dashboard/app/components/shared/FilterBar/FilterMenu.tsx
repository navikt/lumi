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
import { getFilterLabels } from "~/utils/filterLabels";
import styles from "./FilterBar.module.css";

interface FilterMenuProps {
  params: SearchParams;
  setParam: (key: keyof SearchParams, value: string | undefined) => void;
  setParams: (params: Partial<SearchParams>) => void;
  features: SurveyFeatureConfig;
  allTags: string[];
  selectedTags: string[];
  themeLabel?: string;
}

export function FilterMenu({
  params,
  setParam,
  setParams,
  features,
  allTags,
  selectedTags,
  themeLabel,
}: FilterMenuProps) {
  const { data: stats } = useStats();
  const { removeChoice } = useChoiceFilter();
  const { removeRating } = useRatingFilter();
  const { choiceFilters, ratingFilters } = getFilterLabels({ params, stats });

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
    ratingFilters.length +
    choiceFilters.length;

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
            </VStack>
          </HGrid>

          {params.task ||
          params.theme ||
          ratingFilters.length > 0 ||
          choiceFilters.length > 0 ? (
            <Box paddingBlock="space-16">
              <div className={styles.menuDivider} />

              <VStack gap="space-8" className={styles.selectedFromCharts}>
                <Label size="small">Valgt fra grafer</Label>
                <Chips size="small">
                  {params.theme ? (
                    <Chips.Removable
                      variant="neutral"
                      onDelete={() => {
                        setParam("theme", undefined);
                        setParam("page", "1");
                      }}
                    >
                      {`Tema: ${themeValueLabel}`}
                    </Chips.Removable>
                  ) : null}

                  {params.task ? (
                    <Chips.Removable
                      variant="neutral"
                      onDelete={() => {
                        setParam("task", undefined);
                        setParam("page", "1");
                      }}
                    >
                      {`Oppgave: ${params.task}`}
                    </Chips.Removable>
                  ) : null}

                  {ratingFilters.map((filter) => (
                    <Chips.Removable
                      key={filter.key}
                      variant="neutral"
                      onDelete={() => removeRating(filter.fieldId)}
                    >
                      {`${filter.label}: ${filter.value}`}
                    </Chips.Removable>
                  ))}

                  {choiceFilters.map((filter) => (
                    <Chips.Removable
                      key={filter.key}
                      variant="neutral"
                      onDelete={() => removeChoice(filter.fieldId)}
                    >
                      {`${filter.label}: ${filter.value}`}
                    </Chips.Removable>
                  ))}
                </Chips>
              </VStack>
            </Box>
          ) : null}
        </Box>
      </ActionMenu.Content>
    </ActionMenu>
  );
}
