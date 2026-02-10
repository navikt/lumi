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
import type { SearchParams } from "~/hooks/useSearchParams";
import styles from "./FilterBar.module.css";

interface FilterMenuProps {
  params: SearchParams;
  setParam: (key: keyof SearchParams, value: string | undefined) => void;
  setParams: (params: Partial<SearchParams>) => void;
  features: SurveyFeatureConfig;
  allTags: string[];
  selectedTags: string[];
  ratingFilterLabel?: string;
  ratingFilterValue?: string;
  themeLabel?: string;
}

/**
 * ActionMenu-based filter with CheckboxItems for toggles.
 * Follows Aksel filter pattern.
 */
export function FilterMenu({
  params,
  setParam,
  setParams,
  features,
  allTags,
  selectedTags,
  ratingFilterLabel,
  ratingFilterValue,
  themeLabel,
}: FilterMenuProps) {
  // Count active filters to show badge (including segment + tags)
  const activeCount = [
    params.task,
    params.theme,
    params.deviceType && params.deviceType !== "alle",
    params.hasText === "true",
    params.lowRating === "true",
    selectedTags.length > 0,
    params.segment, // Count segmentation filter
    params.ratingFieldId && params.ratingValue,
  ].filter(Boolean).length;

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
            {activeCount > 0 && (
              <Tag data-color="info" size="small" variant="outline">
                {activeCount}
              </Tag>
            )}
          </HStack>
        </Button>
      </ActionMenu.Trigger>
      <ActionMenu.Content className={styles.actionMenuContent}>
        <Box padding="space-12">
          <HGrid columns={{ xs: 1, md: 2 }} gap="space-16">
            <VStack gap="space-12">
              {/* Device filter */}
              {features.showDeviceFilter && (
                <ActionMenu.RadioGroup
                  label="Enhet"
                  value={params.deviceType ?? ""}
                  onValueChange={(value) =>
                    setParams({
                      deviceType: value ? value : undefined,
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
              )}

              {/* Quick toggles */}
              {(features.showTextFilter || features.showRatingFilter) && (
                <ActionMenu.Group label="Vis kun">
                  {features.showTextFilter && (
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
                  )}

                  {features.showRatingFilter && (
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
                  )}
                </ActionMenu.Group>
              )}
            </VStack>

            <VStack gap="space-12">
              {/* Tags */}
              {features.showTagsFilter && allTags.length > 0 && (
                <ActionMenu.Group label="Tags">
                  {allTags.map((tag) => (
                    <ActionMenu.CheckboxItem
                      key={tag}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={(checked) => {
                        const newTags = checked
                          ? [...selectedTags, tag]
                          : selectedTags.filter((t) => t !== tag);
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
              )}

              {/* Segmentation */}
              {params.surveyId && (
                <ContextTagsFilter surveyId={params.surveyId} />
              )}
            </VStack>
          </HGrid>

          {(params.task ||
            params.theme ||
            (params.ratingFieldId && params.ratingValue)) && (
            <Box paddingBlock="space-16">
              <div className={styles.menuDivider} />

              <VStack gap="space-8" className={styles.selectedFromCharts}>
                <Label size="small">Valgt fra grafer</Label>
                <Chips size="small">
                  {params.theme && (
                    <Chips.Removable
                      variant="neutral"
                      onDelete={() => {
                        setParam("theme", undefined);
                        setParam("page", "1");
                      }}
                    >
                      {`Tema: ${themeValueLabel}`}
                    </Chips.Removable>
                  )}

                  {params.task && (
                    <Chips.Removable
                      variant="neutral"
                      onDelete={() => {
                        setParam("task", undefined);
                        setParam("page", "1");
                      }}
                    >
                      {`Oppgave: ${params.task}`}
                    </Chips.Removable>
                  )}

                  {params.ratingFieldId && params.ratingValue && (
                    <Chips.Removable
                      variant="neutral"
                      onDelete={() => {
                        setParam("ratingFieldId", undefined);
                        setParam("ratingValue", undefined);
                        setParam("page", "1");
                      }}
                    >
                      {`${ratingFilterLabel ?? "Vurdering"}: ${
                        ratingFilterValue ?? params.ratingValue
                      }`}
                    </Chips.Removable>
                  )}
                </Chips>
              </VStack>
            </Box>
          )}
        </Box>
      </ActionMenu.Content>
    </ActionMenu>
  );
}
