import { FunnelIcon } from "@navikt/aksel-icons";
import {
  ActionMenu,
  Box,
  Button,
  HStack,
  Label,
  Tag,
  VStack,
} from "@navikt/ds-react";
import { ContextTagsFilter } from "~/components/dashboard/ContextTagsFilter";
import type { SurveyFeatureConfig } from "~/config/surveyConfig";
import type { SearchParams } from "~/hooks/useSearchParams";

interface FilterMenuProps {
  params: SearchParams;
  setParam: (key: keyof SearchParams, value: string | undefined) => void;
  features: SurveyFeatureConfig;
  allTags: string[];
  selectedTags: string[];
}

/**
 * ActionMenu-based filter with CheckboxItems for toggles.
 * Follows Aksel filter pattern.
 */
export function FilterMenu({
  params,
  setParam,
  features,
  allTags,
  selectedTags,
}: FilterMenuProps) {
  // Count active filters to show badge (including segment + tags)
  const activeCount = [
    params.deviceType && params.deviceType !== "alle",
    params.hasText === "true",
    params.lowRating === "true",
    selectedTags.length > 0,
    params.segment, // Count segmentation filter
  ].filter(Boolean).length;

  return (
    <ActionMenu>
      <ActionMenu.Trigger>
        <Button
          variant="secondary-neutral"
          size="small"
          icon={<FunnelIcon aria-hidden />}
        >
          <HStack gap="space-4" align="center">
            <span>Filter</span>
            {activeCount > 0 && (
              <Tag size="small" variant="info">
                {activeCount}
              </Tag>
            )}
          </HStack>
        </Button>
      </ActionMenu.Trigger>
      <ActionMenu.Content style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {/* Device filter */}
        {features.showDeviceFilter && (
          <ActionMenu.RadioGroup
            label="Enhet"
            value={params.deviceType ?? ""}
            onValueChange={(value) =>
              setParam("deviceType", value ? value : undefined)
            }
          >
            <ActionMenu.RadioItem value="">Alle enheter</ActionMenu.RadioItem>
            <ActionMenu.RadioItem value="desktop">Desktop</ActionMenu.RadioItem>
            <ActionMenu.RadioItem value="mobile">Mobil</ActionMenu.RadioItem>
            <ActionMenu.RadioItem value="tablet">
              Nettbrett
            </ActionMenu.RadioItem>
          </ActionMenu.RadioGroup>
        )}

        {/* Quick toggles - only show if there are filters */}
        {(features.showTextFilter || features.showRatingFilter) && (
          <>
            <ActionMenu.Divider />
            <ActionMenu.Group label="Vis kun">
              {features.showTextFilter && (
                <ActionMenu.CheckboxItem
                  checked={params.hasText === "true"}
                  onCheckedChange={(checked) =>
                    setParam("hasText", checked ? "true" : undefined)
                  }
                >
                  Med tekstsvar
                </ActionMenu.CheckboxItem>
              )}

              {features.showRatingFilter && (
                <ActionMenu.CheckboxItem
                  checked={params.lowRating === "true"}
                  onCheckedChange={(checked) =>
                    setParam("lowRating", checked ? "true" : undefined)
                  }
                >
                  Lav score (1-2)
                </ActionMenu.CheckboxItem>
              )}
            </ActionMenu.Group>
          </>
        )}

        {/* Tags - only show when there are tags available */}
        {features.showTagsFilter && allTags.length > 0 && (
          <>
            <ActionMenu.Divider />
            <ActionMenu.Group label="Tags">
              {allTags.map((tag) => (
                <ActionMenu.CheckboxItem
                  key={tag}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={(checked) => {
                    const newTags = checked
                      ? [...selectedTags, tag]
                      : selectedTags.filter((t) => t !== tag);
                    setParam(
                      "tag",
                      newTags.length > 0 ? newTags.join(",") : undefined,
                    );
                  }}
                >
                  {tag}
                </ActionMenu.CheckboxItem>
              ))}
            </ActionMenu.Group>
          </>
        )}

        {/* Segmentation */}
        {params.surveyId && (
          <>
            <ActionMenu.Divider />
            <Box paddingInline="space-12" paddingBlock="space-8">
              <VStack gap="space-8">
                <Label size="small">Segmentering</Label>
                <ContextTagsFilter surveyId={params.surveyId} />
              </VStack>
            </Box>
          </>
        )}
      </ActionMenu.Content>
    </ActionMenu>
  );
}
