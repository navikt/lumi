import { XMarkIcon } from "@navikt/aksel-icons";
import {
  Box,
  Button,
  Hide,
  HStack,
  Select,
  Show,
  TextField,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { PeriodSelector } from "~/components/dashboard/PeriodSelector";
import { getSurveyFeatures } from "~/config/surveyConfig";
import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { useThemes } from "~/hooks/useThemes";
import { getFilterLabels } from "~/utils/filterLabels";
import styles from "./FilterBar.module.css";
import { FilterMenu } from "./FilterMenu";
import { Skeleton as FilterBarSkeleton } from "./Skeleton";

interface FilterBarProps {
  showDetails?: boolean;
}

export function FilterBar({ showDetails = false }: FilterBarProps) {
  const { params, setParam, setParams, resetParams } = useSearchParams();

  // Use centralized filter bootstrap for all dropdown data
  const { data: bootstrap, isPending: isPendingBootstrap } =
    useFilterBootstrap();
  const { data: stats, isPending: isPendingStats } = useStats();
  const { themes } = useThemes();

  // Determine active features based on survey type
  const features = getSurveyFeatures(stats?.surveyType);

  const { ratingLabel, ratingValueLabel, themeLabel } = getFilterLabels({
    params,
    stats,
    themes,
  });
  const ratingFilterLabel = ratingLabel;
  const ratingFilterValue = ratingValueLabel;

  // Parse current tag filter (comma-separated)
  const selectedTags = params.tag
    ? params.tag
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  // Get available apps from bootstrap data
  const availableApps = bootstrap?.apps ?? [];
  const apps = ["alle", ...availableApps];

  const availableTeams = bootstrap?.availableTeams ?? [];
  const selectedTeam = params.team ?? bootstrap?.selectedTeam;

  // Get surveys by app from bootstrap data
  const surveysByApp = bootstrap?.surveysByApp ?? {};

  // Get all available tags from bootstrap data
  const allTags = bootstrap?.tags ?? [];

  // Get available surveys - filter by selected app if one is chosen
  const getAvailableSurveys = (): string[] => {
    if (!surveysByApp || Object.keys(surveysByApp).length === 0) return [];

    if (params.app) {
      // Show only surveys for the selected app
      return surveysByApp[params.app] || [];
    }

    // Show all surveys from all apps (deduplicated)
    const allSurveys = new Set<string>();
    for (const surveys of Object.values(surveysByApp)) {
      for (const survey of surveys) {
        allSurveys.add(survey);
      }
    }
    return Array.from(allSurveys);
  };

  const availableSurveys = getAvailableSurveys();
  const surveys = ["alle", ...availableSurveys];

  // Reset surveyId when app changes and current surveyId is not available for new app
  const handleAppChange = (newApp: string | undefined) => {
    setParams({
      app: newApp,
      page: "1",
    });

    // If a surveyId is selected, check if it's valid for the new app
    if (params.surveyId && surveysByApp) {
      const surveysForApp = newApp ? surveysByApp[newApp] : [];
      if (newApp && surveysForApp && !surveysForApp.includes(params.surveyId)) {
        // Clear surveyId if it's not available for the new app
        setParams({
          surveyId: undefined,
          page: "1",
        });
      }
    }
  };

  const handleReset = () => {
    const team = params.team;
    resetParams();
    // Default to last 30 days on reset
    const end = dayjs();
    const start = dayjs().subtract(29, "day");

    setTimeout(() => {
      setParams({
        team,
        fromDate: start.format("YYYY-MM-DD"),
        toDate: end.format("YYYY-MM-DD"),
      });
    }, 0);
  };

  const handleTeamChange = (newTeam: string) => {
    setParams({
      team: newTeam,
      // Keep period, reset the rest to avoid invalid cross-team combinations.
      fromDate: params.fromDate,
      toDate: params.toDate,
      app: undefined,
      surveyId: undefined,
      query: undefined,
      tag: undefined,
      deviceType: undefined,
      hasText: undefined,
      lowRating: undefined,
      segment: undefined,
      task: undefined,
      theme: undefined,
      page: undefined,
      size: undefined,
    });
  };

  // Only count filters that user has explicitly set (exclude default date range)
  const hasActiveFilters =
    params.query ||
    params.surveyId ||
    params.app ||
    params.lowRating ||
    params.hasText ||
    params.deviceType ||
    params.tag ||
    params.segment ||
    params.task ||
    params.ratingFieldId ||
    params.ratingValue;

  // isPending: no cached data AND fetching (TanStack Query v5 best practice)
  // With placeholderData: keepPreviousData, isPending stays false during refetches
  const isPending = isPendingBootstrap || isPendingStats;

  if (isPending) {
    return (
      <FilterBarSkeleton
        showDetails={showDetails}
        hasActiveFilters={!!hasActiveFilters}
      />
    );
  }

  return (
    <VStack gap="space-12" className={styles.root}>
      {/* Primary Row: All filters in one line */}
      <Box
        padding={{ xs: "space-12", md: "space-16" }}
        background="raised"
        borderRadius="12"
        className={styles.card}
        borderColor="neutral-subtle"
        borderWidth="1"
      >
        {/* Desktop layout */}
        <Show above="md">
          <HStack gap="space-12" align="end" justify="space-between" wrap>
            {/* Left side: Compact dropdowns + Search */}
            <HStack gap="space-12" align="end" wrap>
              {availableTeams.length > 1 && selectedTeam && (
                <Select
                  label="Team"
                  hideLabel
                  size="small"
                  value={selectedTeam}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className={styles.desktopTeamSelect}
                >
                  {availableTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
              )}

              <Select
                label="App"
                hideLabel
                size="small"
                value={params.app || "alle"}
                onChange={(e) =>
                  handleAppChange(
                    e.target.value === "alle" ? undefined : e.target.value,
                  )
                }
                className={styles.desktopAppSelect}
              >
                {apps.map((app) => (
                  <option key={app} value={app}>
                    {app === "alle" ? "Alle apper" : app}
                  </option>
                ))}
              </Select>

              <Select
                label="Survey"
                hideLabel
                size="small"
                value={params.surveyId || "alle"}
                onChange={(e) =>
                  setParams({
                    surveyId:
                      e.target.value === "alle" ? undefined : e.target.value,
                    page: "1",
                  })
                }
                className={styles.desktopSurveySelect}
              >
                {surveys.map((survey) => (
                  <option key={survey} value={survey}>
                    {survey === "alle" ? "Alle surveys" : survey}
                  </option>
                ))}
              </Select>

              {/* Search field - visible when showDetails */}
              {showDetails && features.showTextFilter && (
                <TextField
                  label="Søk"
                  hideLabel
                  size="small"
                  value={params.query || ""}
                  onChange={(e) =>
                    setParams({
                      query: e.target.value || undefined,
                      page: "1",
                    })
                  }
                  placeholder="Søk i tekst..."
                  className={styles.desktopSearch}
                />
              )}

              {/* ActionMenu-based filter */}
              {showDetails && (
                <FilterMenu
                  params={params}
                  setParam={setParam}
                  setParams={setParams}
                  features={features}
                  allTags={allTags}
                  selectedTags={selectedTags}
                  ratingFilterLabel={ratingFilterLabel}
                  ratingFilterValue={ratingFilterValue}
                  themeLabel={themeLabel}
                />
              )}
            </HStack>

            {/* Right side: Period + Reset */}
            <HStack gap="space-8" align="end">
              <PeriodSelector />
              {hasActiveFilters && (
                <Tooltip content="Nullstill alle filtre til standard (siste 30 dager)">
                  <Button
                    variant="tertiary"
                    size="small"
                    icon={<XMarkIcon aria-hidden />}
                    onClick={handleReset}
                    type="button"
                  >
                    Nullstill
                  </Button>
                </Tooltip>
              )}
            </HStack>
          </HStack>
        </Show>

        {/* Mobile/Tablet layout */}
        <Hide above="md">
          <VStack gap="space-8">
            {/* First row: Team (optional) + App + Survey */}
            <HStack gap="space-8" wrap>
              {availableTeams.length > 1 && selectedTeam && (
                <Select
                  label="Team"
                  hideLabel
                  size="small"
                  value={selectedTeam}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className={styles.mobileTeamSelect}
                >
                  {availableTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
              )}

              <Select
                label="App"
                hideLabel
                size="small"
                value={params.app || "alle"}
                onChange={(e) =>
                  handleAppChange(
                    e.target.value === "alle" ? undefined : e.target.value,
                  )
                }
                className={styles.mobileAppSelect}
              >
                {apps.map((app) => (
                  <option key={app} value={app}>
                    {app === "alle" ? "Alle apper" : app}
                  </option>
                ))}
              </Select>

              <Select
                label="Survey"
                hideLabel
                size="small"
                value={params.surveyId || "alle"}
                onChange={(e) =>
                  setParams({
                    surveyId:
                      e.target.value === "alle" ? undefined : e.target.value,
                    page: "1",
                  })
                }
                className={styles.mobileSurveySelect}
              >
                {surveys.map((survey) => (
                  <option key={survey} value={survey}>
                    {survey === "alle" ? "Alle surveys" : survey}
                  </option>
                ))}
              </Select>
            </HStack>

            {/* Second row: Period + Filter + Reset */}
            <HStack gap="space-8" justify="space-between" align="center">
              <HStack gap="space-8" align="center">
                <PeriodSelector />
                {showDetails && (
                  <FilterMenu
                    params={params}
                    setParam={setParam}
                    setParams={setParams}
                    features={features}
                    allTags={allTags}
                    selectedTags={selectedTags}
                    ratingFilterLabel={ratingFilterLabel}
                    ratingFilterValue={ratingFilterValue}
                    themeLabel={themeLabel}
                  />
                )}
              </HStack>
              {hasActiveFilters && (
                <Button
                  variant="tertiary"
                  size="small"
                  icon={<XMarkIcon aria-hidden />}
                  onClick={handleReset}
                  type="button"
                  aria-label="Nullstill alle filtre til standard (siste 30 dager)"
                  title="Nullstill alle filtre til standard (siste 30 dager)"
                />
              )}
            </HStack>

            {/* Third row: Search (mobile) */}
            {showDetails && features.showTextFilter && (
              <TextField
                label="Søk"
                hideLabel
                size="small"
                value={params.query || ""}
                onChange={(e) =>
                  setParams({
                    query: e.target.value || undefined,
                    page: "1",
                  })
                }
                placeholder="Søk i tekst..."
                className={styles.mobileSearch}
              />
            )}
          </VStack>
        </Hide>
      </Box>
    </VStack>
  );
}
