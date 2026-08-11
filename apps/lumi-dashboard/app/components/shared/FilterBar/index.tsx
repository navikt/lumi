import { XMarkIcon } from "@navikt/aksel-icons";
import {
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
import { useEffect } from "react";
import { PeriodSelector } from "~/components/dashboard/PeriodSelector";
import { getSurveyFeatures } from "~/config/surveyConfig";
import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { useThemes } from "~/hooks/useThemes";
import { getFilterLabels } from "~/utils/filterLabels";
import {
  isSurveyArchived,
  partitionSurveyOptions,
} from "~/utils/surveyArchiveUtils";
import styles from "./FilterBar.module.css";
import { FilterMenu } from "./FilterMenu";
import { Skeleton as FilterBarSkeleton } from "./Skeleton";

interface FilterBarProps {
  showDetails?: boolean;
}

export function FilterBar({ showDetails = false }: FilterBarProps) {
  const { params, setParams, resetParams } = useSearchParams();
  const { data: bootstrap, isPending: isPendingBootstrap } =
    useFilterBootstrap();
  const { data: stats, isPending: isPendingStats } = useStats();
  const { themes } = useThemes();

  const features = getSurveyFeatures(stats?.surveyType);
  const { themeLabel } = getFilterLabels({
    params,
    stats,
    themes,
  });

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
      ...(shouldClearSurvey && {
        surveyId: undefined,
      }),
    });
  };

  const handleSurveyChange = (newSurveyId: string | undefined) => {
    setParams({
      surveyId: newSurveyId,
      choice: undefined,
      rating: undefined,
      phrase: undefined,
      page: "1",
    });
  };

  const selectedSurveyIsArchived =
    !!params.surveyId &&
    isSurveyArchived(params.surveyId, bootstrap?.surveyMeta);
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
        page: "1",
      });
    } else if (!showArchived && selectedSurveyIsArchived) {
      setParams({
        surveyId: undefined,
        choice: undefined,
        rating: undefined,
        phrase: undefined,
        page: "1",
      });
    }
  }, [showArchived, selectedAppIsHidden, selectedSurveyIsArchived, setParams]);

  const handleReset = () => {
    const team = params.team;
    resetParams();
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
      choice: undefined,
      rating: undefined,
      phrase: undefined,
      page: undefined,
      size: undefined,
    });
  };

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
    params.theme ||
    params.choice ||
    params.rating ||
    params.phrase;

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
                  value={params.query || ""}
                  onChange={(e) =>
                    setParams({
                      query: e.target.value || undefined,
                      phrase: undefined,
                      page: "1",
                    })
                  }
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
                value={params.query || ""}
                onChange={(e) =>
                  setParams({
                    query: e.target.value || undefined,
                    phrase: undefined,
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
