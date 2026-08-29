import { XMarkIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  Hide,
  HStack,
  Select,
  Show,
  Switch,
  TextField,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { useCallback, useEffect } from "react";
import { PeriodSelector } from "~/components/dashboard/PeriodSelector";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { RefreshSurveyOverview } from "~/components/shared/RefreshSurveyOverview";
import { getSurveyFeatures } from "~/config/surveyConfig";
import { useActiveFilters } from "~/hooks/useActiveFilters";
import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { useThemes } from "~/hooks/useThemes";
import {
  resolveDashboardPeriod,
  type SurveyPeriodMetadata,
} from "~/utils/dashboardPeriod";
import { getFilterLabels } from "~/utils/filterLabels";
import {
  isSurveyArchived,
  partitionSurveyOptions,
} from "~/utils/surveyArchiveUtils";
import styles from "./FilterBar.module.css";
import { FilterMenu } from "./FilterMenu";
import { Skeleton as FilterBarSkeleton } from "./Skeleton";
import { useDebouncedSearchQuery } from "./useDebouncedSearchQuery";

interface FilterBarProps {
  showDetails?: boolean;
  filterResetVersion?: number;
}

export function FilterBar({
  showDetails = false,
  filterResetVersion = 0,
}: FilterBarProps) {
  const bootstrapQuery = useFilterBootstrap();
  const statsQuery = useStats();

  // Stats failures must not hide the controls users need to narrow the query.
  // Bootstrap failures still hide the controls because their options are unknown.
  return (
    <VStack gap="space-8">
      <HStack justify="end">
        <RefreshSurveyOverview />
      </HStack>
      <DataFetchBoundary
        title="Kunne ikke hente filtre"
        queries={[bootstrapQuery]}
      >
        <FilterBarContent
          showDetails={showDetails}
          filterResetVersion={filterResetVersion}
          bootstrapQuery={bootstrapQuery}
          statsQuery={statsQuery}
        />
      </DataFetchBoundary>
    </VStack>
  );
}

function FilterBarContent({
  showDetails,
  filterResetVersion,
  bootstrapQuery,
  statsQuery,
}: Required<FilterBarProps> & {
  bootstrapQuery: ReturnType<typeof useFilterBootstrap>;
  statsQuery: ReturnType<typeof useStats>;
}) {
  const { params, setParams } = useSearchParams();
  const { data: bootstrap, isPending: isPendingBootstrap } = bootstrapQuery;
  const { data: stats, isPending: isPendingStats } = statsQuery;
  const { themes } = useThemes();
  const commitSearchQuery = useCallback(
    (query: string) =>
      setParams({
        query: query || undefined,
        phrase: undefined,
        page: "1",
      }),
    [setParams],
  );
  const { queryDraft, updateQueryDraft, clearQueryDraft } =
    useDebouncedSearchQuery({
      query: params.query,
      resetVersion: filterResetVersion,
      onCommit: commitSearchQuery,
    });

  const features = getSurveyFeatures(stats?.surveyType);
  const { themeLabel } = getFilterLabels({
    params,
    stats,
    themes,
  });
  const currentPeriod = resolveDashboardPeriod({
    dateMode: params.dateMode,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  const rollingAutomaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
  const { hasActiveFilters, resetFilters } = useActiveFilters();

  const handleReset = () => {
    clearQueryDraft();
    resetFilters();
  };

  const selectedTags = params.tag
    ? params.tag
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const availableApps = bootstrap?.apps ?? [];

  const availableTeams = bootstrap?.availableTeams ?? [];
  const selectedTeam = params.team ?? bootstrap?.selectedTeam;

  const surveysByApp = bootstrap?.surveysByApp ?? {};
  const allTags = bootstrap?.tags ?? [];
  const showArchived = params.showArchived === "true";
  const getSurveyPeriodMetadata = (
    surveyId: string,
  ): SurveyPeriodMetadata | undefined =>
    (params.app
      ? bootstrap?.surveyMetaByApp?.[params.app]?.[surveyId]
      : undefined) ?? bootstrap?.surveyMeta?.[surveyId];

  const allAvailableSurveys = Array.from(
    new Set(Object.values(surveysByApp).flat()),
  );
  const archivedSurveyCount = allAvailableSurveys.filter((surveyId) =>
    isSurveyArchived(surveyId, bootstrap?.surveyMeta),
  ).length;
  const visibleApps = showArchived
    ? availableApps
    : availableApps.filter((app) =>
        (surveysByApp[app] ?? []).some(
          (surveyId) => !isSurveyArchived(surveyId, bootstrap?.surveyMeta),
        ),
      );
  const apps = ["alle", ...visibleApps];

  const getAvailableSurveys = (): string[] => {
    if (!surveysByApp || Object.keys(surveysByApp).length === 0) return [];

    if (params.app) {
      return surveysByApp[params.app] || [];
    }

    const allSurveys = new Set<string>();
    for (const surveys of Object.values(surveysByApp)) {
      for (const survey of surveys) {
        allSurveys.add(survey);
      }
    }
    return Array.from(allSurveys);
  };

  const availableSurveys = getAvailableSurveys();
  const { active: activeSurveys, archived: archivedSurveys } =
    partitionSurveyOptions({
      availableSurveys,
      surveyMeta: bootstrap?.surveyMeta,
      showArchived,
    });

  // Grouped options when archived surveys are visible, flat list otherwise
  const surveyOptions =
    archivedSurveys.length > 0 ? (
      <>
        <option value="alle">Alle surveys</option>
        {activeSurveys.length > 0 && (
          <optgroup label="Aktive">
            {activeSurveys.map((survey) => (
              <option key={survey} value={survey}>
                {survey}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Arkiverte">
          {archivedSurveys.map((survey) => (
            <option key={survey} value={survey}>
              {survey}
            </option>
          ))}
        </optgroup>
      </>
    ) : (
      <>
        <option value="alle">Alle surveys</option>
        {activeSurveys.map((survey) => (
          <option key={survey} value={survey}>
            {survey}
          </option>
        ))}
      </>
    );

  const archiveToggle =
    archivedSurveyCount > 0 ? (
      <Switch
        size="small"
        checked={showArchived}
        onChange={(event) =>
          setParams({ showArchived: event.target.checked ? "true" : undefined })
        }
      >
        Arkiverte ({archivedSurveyCount})
      </Switch>
    ) : null;

  const handleAppChange = (newApp: string | undefined) => {
    const shouldClearSurvey =
      params.surveyId &&
      surveysByApp &&
      newApp &&
      surveysByApp[newApp] &&
      !surveysByApp[newApp].includes(params.surveyId);

    setParams({
      app: newApp,
      page: "1",
      // phrase, choice and rating are field-bound (belong to a specific survey
      // in a specific app) — always clear on app change to avoid stale filters.
      phrase: undefined,
      choice: undefined,
      rating: undefined,
      trendFieldId: undefined,
      trendOptionId: undefined,
      ...(shouldClearSurvey && {
        surveyId: undefined,
        ...(currentPeriod.dateMode === "auto" && {
          dateMode: "auto" as const,
          fromDate: rollingAutomaticPeriod.fromDate,
          toDate: rollingAutomaticPeriod.toDate,
        }),
      }),
    });
  };

  const handleSurveyChange = (newSurveyId: string | undefined) => {
    const selectedSurveyMeta = newSurveyId
      ? getSurveyPeriodMetadata(newSurveyId)
      : undefined;
    const period = resolveDashboardPeriod({
      dateMode: params.dateMode,
      fromDate: params.fromDate,
      toDate: params.toDate,
      surveyMeta: selectedSurveyMeta,
    });

    setParams({
      surveyId: newSurveyId,
      choice: undefined,
      rating: undefined,
      phrase: undefined,
      trendFieldId: undefined,
      trendOptionId: undefined,
      ...(period.dateMode === "auto" && {
        dateMode: "auto",
        fromDate: period.fromDate,
        toDate: period.toDate,
      }),
      page: "1",
    });
  };

  const selectedSurveyIsArchived =
    !!params.surveyId &&
    isSurveyArchived(params.surveyId, bootstrap?.surveyMeta);
  const selectedSurveyMeta = params.surveyId
    ? getSurveyPeriodMetadata(params.surveyId)
    : undefined;
  const selectedSurveyPeriod = resolveDashboardPeriod({
    dateMode: params.dateMode,
    fromDate: params.fromDate,
    toDate: params.toDate,
    surveyMeta: selectedSurveyMeta,
  });
  // Guarded on loaded bootstrap: while data is pending visibleApps is empty,
  // and an unguarded check would wipe the app filter from bookmarked URLs.
  const selectedAppIsHidden =
    !!bootstrap &&
    !!params.app &&
    !showArchived &&
    !visibleApps.includes(params.app);

  useEffect(() => {
    if (selectedAppIsHidden) {
      setParams({
        app: undefined,
        surveyId: undefined,
        choice: undefined,
        rating: undefined,
        phrase: undefined,
        trendFieldId: undefined,
        trendOptionId: undefined,
        ...(currentPeriod.dateMode === "auto" && {
          dateMode: "auto" as const,
          fromDate: rollingAutomaticPeriod.fromDate,
          toDate: rollingAutomaticPeriod.toDate,
        }),
        page: "1",
      });
    } else if (!showArchived && selectedSurveyIsArchived) {
      setParams({
        surveyId: undefined,
        choice: undefined,
        rating: undefined,
        phrase: undefined,
        trendFieldId: undefined,
        trendOptionId: undefined,
        ...(currentPeriod.dateMode === "auto" && {
          dateMode: "auto" as const,
          fromDate: rollingAutomaticPeriod.fromDate,
          toDate: rollingAutomaticPeriod.toDate,
        }),
        page: "1",
      });
    }
  }, [
    currentPeriod.dateMode,
    rollingAutomaticPeriod.fromDate,
    rollingAutomaticPeriod.toDate,
    selectedAppIsHidden,
    selectedSurveyIsArchived,
    setParams,
    showArchived,
  ]);

  useEffect(() => {
    if (
      !bootstrap ||
      !params.surveyId ||
      selectedAppIsHidden ||
      (!showArchived && selectedSurveyIsArchived) ||
      selectedSurveyPeriod.dateMode !== "auto" ||
      (params.dateMode === "auto" &&
        params.fromDate === selectedSurveyPeriod.fromDate &&
        params.toDate === selectedSurveyPeriod.toDate)
    ) {
      return;
    }

    setParams({
      dateMode: "auto",
      fromDate: selectedSurveyPeriod.fromDate,
      toDate: selectedSurveyPeriod.toDate,
      page: "1",
    });
  }, [
    bootstrap,
    params.dateMode,
    params.fromDate,
    params.surveyId,
    params.toDate,
    selectedAppIsHidden,
    selectedSurveyIsArchived,
    selectedSurveyPeriod.dateMode,
    selectedSurveyPeriod.fromDate,
    selectedSurveyPeriod.toDate,
    setParams,
    showArchived,
  ]);

  const handleTeamChange = (newTeam: string) => {
    clearQueryDraft();
    setParams({
      team: newTeam,
      fromDate: params.fromDate,
      toDate: params.toDate,
      ...(currentPeriod.dateMode === "auto" && {
        dateMode: "auto",
        fromDate: rollingAutomaticPeriod.fromDate,
        toDate: rollingAutomaticPeriod.toDate,
      }),
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
      choice: undefined,
      rating: undefined,
      phrase: undefined,
      trendFieldId: undefined,
      trendOptionId: undefined,
      page: undefined,
      size: undefined,
    });
  };

  const isPending = isPendingBootstrap || isPendingStats;

  if (isPending) {
    return (
      <FilterBarSkeleton
        showDetails={showDetails}
        hasActiveFilters={hasActiveFilters}
      />
    );
  }

  return (
    <VStack gap="space-12" className={styles.root}>
      <Box
        padding={{ xs: "space-12", md: "space-16" }}
        background="raised"
        borderRadius="12"
        className={styles.card}
        borderColor="neutral-subtle"
        borderWidth="1"
      >
        <Show above="md">
          <HStack gap="space-12" align="end" justify="space-between" wrap>
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
                  handleSurveyChange(
                    e.target.value === "alle" ? undefined : e.target.value,
                  )
                }
                className={styles.desktopSurveySelect}
              >
                {surveyOptions}
              </Select>

              {showDetails && features.showTextFilter && (
                <TextField
                  label="Søk"
                  hideLabel
                  size="small"
                  value={queryDraft}
                  onChange={(e) => updateQueryDraft(e.target.value)}
                  placeholder="Søk i tekst..."
                  className={styles.desktopSearch}
                />
              )}

              {showDetails && (
                <FilterMenu
                  params={params}
                  setParams={setParams}
                  features={features}
                  allTags={allTags}
                  selectedTags={selectedTags}
                  themeLabel={themeLabel}
                />
              )}
            </HStack>

            <HStack gap="space-8" align="end">
              {archiveToggle}
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

        <Hide above="md">
          <VStack gap="space-8">
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
                  handleSurveyChange(
                    e.target.value === "alle" ? undefined : e.target.value,
                  )
                }
                className={styles.mobileSurveySelect}
              >
                {surveyOptions}
              </Select>
            </HStack>

            <HStack gap="space-8" justify="space-between" align="center">
              <HStack gap="space-8" align="center">
                {archiveToggle}
                <PeriodSelector />
                {showDetails && (
                  <FilterMenu
                    params={params}
                    setParams={setParams}
                    features={features}
                    allTags={allTags}
                    selectedTags={selectedTags}
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

            {showDetails && features.showTextFilter && (
              <TextField
                label="Søk"
                hideLabel
                size="small"
                value={queryDraft}
                onChange={(e) => updateQueryDraft(e.target.value)}
                placeholder="Søk i tekst..."
                className={styles.mobileSearch}
              />
            )}
          </VStack>
        </Hide>
      </Box>

      {selectedSurveyPeriod.dateMode === "fixed" &&
        selectedSurveyPeriod.isOutsideSurveyPeriod &&
        selectedSurveyPeriod.surveyPeriod && (
          <Alert variant="info" size="small">
            <VStack gap="space-8" align="start">
              <BodyShort size="small">
                Surveyen har registrerte svar fra{" "}
                {dayjs(selectedSurveyPeriod.surveyPeriod.fromDate).format(
                  "DD.MM.YYYY",
                )}{" "}
                til{" "}
                {dayjs(selectedSurveyPeriod.surveyPeriod.toDate).format(
                  "DD.MM.YYYY",
                )}
                .
              </BodyShort>
              <Button
                type="button"
                variant="tertiary"
                size="small"
                onClick={() =>
                  setParams({
                    dateMode: "fixed",
                    fromDate: selectedSurveyPeriod.surveyPeriod?.fromDate,
                    toDate: selectedSurveyPeriod.surveyPeriod?.toDate,
                    page: "1",
                  })
                }
              >
                Vis hele svarperioden
              </Button>
            </VStack>
          </Alert>
        )}
    </VStack>
  );
}
