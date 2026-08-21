import {
  ArrowRightIcon,
  ChatIcon,
  InformationSquareIcon,
  LightBulbIcon,
  PencilIcon,
  PlusIcon,
} from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  Detail,
  Heading,
  HGrid,
  HStack,
  Skeleton,
  Tag,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { DashboardCard } from "~/components/dashboard";
import { PhraseList } from "~/components/shared/PhraseList";
import { ThemeModal } from "~/components/shared/ThemeModal";
import { useThemes } from "~/hooks/useThemes";
import type {
  AnalysisContext,
  ConfidenceLevel,
  CreateThemeInput,
  PhraseEntry,
  QuoteEntry,
  TextTheme,
  UpdateThemeInput,
} from "~/types/api";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  THEME_COLOR_AMBER,
  THEME_COLOR_BLUE,
  THEME_COLOR_CYAN,
  THEME_COLOR_EMERALD,
  THEME_COLOR_GRAY,
  THEME_COLOR_LIME,
  THEME_COLOR_ORANGE,
  THEME_COLOR_PINK,
  THEME_COLOR_RED,
  THEME_COLOR_VIOLET,
} from "~/utils/colors";
import { formatRelativeTime } from "~/utils/wordAnalysis";
import styles from "./TextAnalysis.module.css";

/**
 * Generic theme with statistics for display
 */
interface ThemeWithStats {
  theme: string;
  themeId?: string;
  count: number;
  examples: string[];
  color?: string;
  /** Success rate (0-1) for Discovery surveys */
  successRate?: number;
  definedTheme?: TextTheme;
}

/**
 * Recent response item for display
 */
interface RecentResponseItem {
  text: string;
  submittedAt: string;
  success?: "yes" | "partial" | "no";
  additionalInfo?: string;
}

export interface TextAnalysisProps {
  /** Analysis context determines which theme set to use */
  analysisContext: AnalysisContext;
  /** Automatically extracted recurring phrases */
  phrases: PhraseEntry[];
  /** Examples sampled from the underlying responses */
  quotes: QuoteEntry[];
  /** Response-volume signal from the backend */
  confidenceLevel?: ConfidenceLevel;
  /** Field whose text should be filtered when a phrase is selected */
  phraseFieldId: string;
  /** Themed statistics from the backend */
  themes: ThemeWithStats[];
  /** Recent responses for context */
  recentResponses: RecentResponseItem[];
  /** Total count for percentage calculations */
  totalCount: number;
  /** Loading state */
  isLoading?: boolean;
  /** Labels for UI customization */
  labels?: {
    insightsTitle?: string;
    insightsSubtitle?: string;
    phrasesTitle?: string;
    examplesTitle?: string;
    themesTitle?: string;
    themesSubtitle?: string;
    emptyMessage?: string;
  };
  /** Show success/status tags on recent responses */
  showResponseStatus?: boolean;
}

const DEFAULT_LABELS = {
  insightsTitle: "Dette går igjen i svarene",
  insightsSubtitle:
    "Uttrykk viser hva som går igjen. Eksemplene viser ordene i sammenheng.",
  phrasesTitle: "Uttrykk som går igjen",
  examplesTitle: "Eksempler fra svarene",
  themesTitle: "Egne temaer",
  themesSubtitle:
    "Lag egne temaer når dere vil følge de samme tingene over tid.",
  emptyMessage: "Ingen data tilgjengelig ennå.",
};

const CONFIDENCE_CONTENT: Record<
  ConfidenceLevel,
  { label: string; description: string; color: "warning" | "info" | "success" }
> = {
  low: {
    label: "Få svar",
    description: "Mønstrene kan endre seg når det kommer flere svar.",
    color: "warning",
  },
  medium: {
    label: "Noen svar",
    description: "Det er nok svar til å se tidlige mønstre.",
    color: "info",
  },
  high: {
    label: "Mange svar",
    description: "Mønstrene bygger på mange svar.",
    color: "success",
  },
};

function confidenceFromCount(totalCount: number): ConfidenceLevel {
  if (totalCount < 30) return "low";
  if (totalCount <= 100) return "medium";
  return "high";
}

interface ResponseExamplesProps {
  title: string;
  description: string;
  responses: RecentResponseItem[];
  showResponseStatus: boolean;
  maxItems: number;
}

function ResponseExamples({
  title,
  description,
  responses,
  showResponseStatus,
  maxItems,
}: ResponseExamplesProps) {
  const occurrences = new Map<string, number>();
  const keyedResponses = responses.slice(0, maxItems).map((response) => {
    const baseKey = `${response.text}-${response.submittedAt}`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    return { response, key: `${baseKey}-${occurrence}` };
  });

  return (
    <VStack gap="space-8">
      <HStack gap="space-8" align="center">
        <ChatIcon aria-hidden />
        <Heading size="small" level="3">
          {title}
        </Heading>
      </HStack>
      <BodyShort size="small" textColor="subtle">
        {description}
      </BodyShort>
      <HGrid columns={{ xs: 1, md: 2, lg: 3 }} gap="space-8">
        {keyedResponses.map(({ response, key }) => (
          <blockquote key={key} className={styles.responseExample}>
            <HStack justify="space-between" align="start" wrap={false}>
              <BodyShort size="small" className={styles.recentResponseText}>
                «{response.text}»
              </BodyShort>
              {showResponseStatus && response.success && (
                <Tag
                  size="xsmall"
                  variant="outline"
                  data-color={
                    response.success === "yes"
                      ? "success"
                      : response.success === "partial"
                        ? "warning"
                        : "danger"
                  }
                  className={styles.recentStatusTag}
                >
                  {response.success === "yes"
                    ? "Fullført"
                    : response.success === "partial"
                      ? "Delvis"
                      : "Ikke fullført"}
                </Tag>
              )}
            </HStack>
            <HStack
              justify="space-between"
              align="baseline"
              gap="space-8"
              className={styles.responseMeta}
            >
              {response.additionalInfo ? (
                <BodyShort
                  size="small"
                  textColor="subtle"
                  className={styles.responseAdditionalInfo}
                >
                  {response.additionalInfo}
                </BodyShort>
              ) : (
                <span />
              )}
              <BodyShort
                as="time"
                dateTime={response.submittedAt}
                size="small"
                textColor="subtle"
              >
                {formatRelativeTime(response.submittedAt)}
              </BodyShort>
            </HStack>
          </blockquote>
        ))}
      </HGrid>
    </VStack>
  );
}

const THEME_COLOR_CLASS_BY_HEX: Record<string, string> = {
  [THEME_COLOR_BLUE]: styles.themeAccentBlue,
  [THEME_COLOR_EMERALD]: styles.themeAccentEmerald,
  [THEME_COLOR_AMBER]: styles.themeAccentAmber,
  [THEME_COLOR_RED]: styles.themeAccentRed,
  [THEME_COLOR_VIOLET]: styles.themeAccentViolet,
  [THEME_COLOR_PINK]: styles.themeAccentPink,
  [THEME_COLOR_CYAN]: styles.themeAccentCyan,
  [THEME_COLOR_LIME]: styles.themeAccentLime,
  [THEME_COLOR_ORANGE]: styles.themeAccentOrange,
  [THEME_COLOR_GRAY]: styles.themeAccentGray,
};

function getThemeAccentClass(color?: string): string {
  if (!color) return styles.themeAccentDefault;
  return (
    THEME_COLOR_CLASS_BY_HEX[color.toLowerCase()] ?? styles.themeAccentDefault
  );
}

/**
 * Shared Discovery and blocker view for recurring expressions, concrete
 * examples, and the themes a team chooses to follow over time.
 */
export function TextAnalysis({
  analysisContext,
  phrases,
  quotes,
  confidenceLevel,
  phraseFieldId,
  themes: statsThemes,
  recentResponses,
  totalCount,
  isLoading,
  labels: customLabels,
  showResponseStatus = false,
}: TextAnalysisProps) {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  const {
    themes: definedThemes,
    isLoading: isThemesLoading,
    error: themesError,
    createTheme,
    updateTheme,
    deleteTheme,
    isCreating,
    isUpdating,
    isDeleting,
  } = useThemes({ context: analysisContext });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<TextTheme | undefined>();
  const [themeMutationError, setThemeMutationError] = useState<string>();
  const [themeNameError, setThemeNameError] = useState<string>();

  // Open modal for creating new theme
  const handleOpenCreate = useCallback(() => {
    setEditingTheme(undefined);
    setThemeMutationError(undefined);
    setThemeNameError(undefined);
    setIsModalOpen(true);
  }, []);

  // Open modal for editing existing theme
  const handleOpenEdit = useCallback((theme: TextTheme) => {
    setEditingTheme(theme);
    setThemeMutationError(undefined);
    setThemeNameError(undefined);
    setIsModalOpen(true);
  }, []);

  // Handle modal submit
  const handleSubmit = useCallback(
    (data: CreateThemeInput | (UpdateThemeInput & { themeId: string })) => {
      setThemeMutationError(undefined);
      setThemeNameError(undefined);
      const handleMutationError = (error: Error, fallback: string) => {
        if (
          error instanceof ApiErrorException &&
          error.error.type === ErrorType.CONFLICT
        ) {
          setThemeNameError(
            "Det finnes allerede et tema med dette navnet. Velg et annet navn.",
          );
          return;
        }
        setThemeMutationError(fallback);
      };
      if ("themeId" in data) {
        updateTheme(data, {
          onSuccess: () => setIsModalOpen(false),
          onError: (error) =>
            handleMutationError(error, "Kunne ikke lagre temaet. Prøv igjen."),
        });
      } else {
        createTheme(
          { ...data, analysisContext },
          {
            onSuccess: () => setIsModalOpen(false),
            onError: (error) =>
              handleMutationError(
                error,
                "Kunne ikke opprette temaet. Prøv igjen.",
              ),
          },
        );
      }
    },
    [createTheme, updateTheme, analysisContext],
  );

  // Handle delete
  const handleDelete = useCallback(
    (themeId: string) => {
      setThemeMutationError(undefined);
      deleteTheme(themeId, {
        onSuccess: () => setIsModalOpen(false),
        onError: () =>
          setThemeMutationError("Kunne ikke slette temaet. Prøv igjen."),
      });
    },
    [deleteTheme],
  );

  // Keep every configured theme visible, including themes with no matches, so
  // they remain possible to edit or delete from this view.
  const configuredThemesDisplay = useMemo(() => {
    const result: ThemeWithStats[] = definedThemes.map((definedTheme) => {
      const stats = statsThemes.find((t) => t.theme === definedTheme.name);
      return {
        theme: definedTheme.name,
        themeId: definedTheme.id,
        count: stats?.count ?? 0,
        examples: stats?.examples ?? [],
        successRate: stats?.successRate,
        color: definedTheme.color,
        definedTheme,
      };
    });

    return result.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (a.theme || "").localeCompare(b.theme || "", "nb");
    });
  }, [definedThemes, statsThemes]);

  const uncategorizedTheme = statsThemes.find(
    (theme) => theme.theme === "Annet" && theme.count > 0,
  );

  const themeKeywordSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          phrases.flatMap((phrase) =>
            (() => {
              const words = phrase.text.split(/\s+/).filter(Boolean);
              return words.length > 1
                ? [words[0], words[words.length - 1]]
                : words;
            })(),
          ),
        ),
      ).sort((left, right) => left.localeCompare(right, "nb")),
    [phrases],
  );

  const effectiveConfidence =
    confidenceLevel ?? confidenceFromCount(totalCount);
  const confidenceContent = CONFIDENCE_CONTENT[effectiveConfidence];
  const useRecentExamples =
    effectiveConfidence === "low" || quotes.length === 0;
  const examples: RecentResponseItem[] = useRecentExamples
    ? recentResponses
    : quotes.map((quote) => ({
        text: quote.text,
        submittedAt: quote.answeredAt,
      }));
  const hasInsightContent = phrases.length > 0 || examples.length > 0;
  const uncategorizedSummary = uncategorizedTheme ? (
    <HStack justify="space-between" align="center" gap="space-16" wrap={false}>
      <div className={styles.uncategorizedText}>
        <BodyShort weight="semibold">Uten tema</BodyShort>
        <BodyShort size="small" textColor="subtle">
          Svar som ikke treffer noen av nøkkelordene i temaene deres.
        </BodyShort>
      </div>
      <HStack gap="space-8" align="center" wrap={false}>
        <Detail>{uncategorizedTheme.count} svar</Detail>
        {analysisContext === "GENERAL_FEEDBACK" && (
          <ArrowRightIcon aria-hidden />
        )}
      </HStack>
    </HStack>
  ) : null;

  // Loading state
  if (isLoading) {
    return (
      <DashboardCard padding="0" className={styles.cardOverflowHidden}>
        <Box
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <Skeleton width="200px" height="24px" />
        </Box>
        <Box padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            {[...Array(4)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeletons are static
              <Skeleton key={i} width="100%" height="40px" />
            ))}
          </VStack>
        </Box>
      </DashboardCard>
    );
  }

  const hasCachedThemes = definedThemes.length > 0;

  return (
    <>
      {!hasInsightContent && (
        <DashboardCard>
          <BodyShort textColor="subtle">
            {totalCount === 0
              ? labels.emptyMessage
              : "Fant ingen uttrykk eller eksempler i svarene ennå."}
          </BodyShort>
        </DashboardCard>
      )}
      {hasInsightContent && (
        <DashboardCard
          padding="0"
          className={styles.cardOverflowHidden}
          data-testid="text-insights"
        >
          <Box
            padding={{ xs: "space-16", md: "space-24" }}
            borderWidth="0 0 1 0"
            borderColor="neutral-subtle"
          >
            <HStack justify="space-between" align="start" gap="space-16">
              <div className={styles.insightHeading}>
                <Heading size="medium" level="2">
                  {labels.insightsTitle}
                </Heading>
                <BodyShort
                  size="small"
                  textColor="subtle"
                  className={styles.sectionSubtitle}
                >
                  {labels.insightsSubtitle}
                </BodyShort>
              </div>
              <Tag
                data-color={confidenceContent.color}
                variant="outline"
                size="small"
                className={styles.confidenceTag}
              >
                {confidenceContent.label}
              </Tag>
            </HStack>
            <BodyShort
              size="small"
              textColor="subtle"
              className={styles.confidenceDescription}
            >
              {confidenceContent.description}
            </BodyShort>
          </Box>

          <Box padding={{ xs: "space-16", md: "space-24" }}>
            <VStack gap="space-24">
              {effectiveConfidence === "low" && examples.length > 0 && (
                <ResponseExamples
                  title="Svarene så langt"
                  description="Når det er få svar, er det bedre å lese dem konkret enn å trekke bastante konklusjoner."
                  responses={examples}
                  showResponseStatus={showResponseStatus}
                  maxItems={5}
                />
              )}

              {phrases.length > 0 && (
                <VStack gap="space-8">
                  <HStack gap="space-8" align="center">
                    <LightBulbIcon aria-hidden />
                    <Heading size="small" level="3">
                      {effectiveConfidence === "low"
                        ? "Tidlige mønstre"
                        : labels.phrasesTitle}
                    </Heading>
                  </HStack>
                  <BodyShort size="small" textColor="subtle">
                    Velg et uttrykk for å se svarene det kommer fra.
                  </BodyShort>
                  <PhraseList
                    phrases={phrases}
                    fieldId={phraseFieldId}
                    maxItems={8}
                    ariaLabel={
                      effectiveConfidence === "low"
                        ? "Tidlige mønstre"
                        : labels.phrasesTitle
                    }
                  />
                </VStack>
              )}

              {effectiveConfidence !== "low" && examples.length > 0 && (
                <ResponseExamples
                  title={labels.examplesTitle}
                  description="Her er noen svar som viser hvordan brukerne beskriver opplevelsen."
                  responses={examples}
                  showResponseStatus={useRecentExamples && showResponseStatus}
                  maxItems={3}
                />
              )}

              <Link
                to="/feedback"
                search={(prev) => ({
                  ...prev,
                  page: "1",
                  hasText: "true",
                  phrase: undefined,
                  query: undefined,
                })}
                className={styles.allFeedbackLink}
              >
                Se alle tilbakemeldinger
                <ArrowRightIcon aria-hidden />
              </Link>
            </VStack>
          </Box>
        </DashboardCard>
      )}
      {/* Themes Section */}
      <DashboardCard padding="0" className={styles.cardOverflowHidden}>
        <Box
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <HStack justify="space-between" align="start" gap="space-16">
            <div className={styles.themeHeading}>
              <HStack gap="space-8" align="center">
                <Heading size="small" level="2">
                  {labels.themesTitle}
                </Heading>
                <Tooltip content="Temaer følger nøkkelord dere velger selv, og kan brukes til å følge de samme problemstillingene over tid.">
                  <Button
                    data-color="neutral"
                    variant="tertiary"
                    size="small"
                    icon={<InformationSquareIcon aria-hidden />}
                    aria-label="Hva er egne temaer?"
                  />
                </Tooltip>
              </HStack>
              <BodyShort
                size="small"
                textColor="subtle"
                className={styles.sectionSubtitle}
              >
                {labels.themesSubtitle} Ett svar kan høre til flere temaer.
              </BodyShort>
              <BodyShort
                size="small"
                textColor="subtle"
                className={styles.themeCount}
              >
                {isThemesLoading && !hasCachedThemes
                  ? "Laster temaer …"
                  : themesError && !hasCachedThemes
                    ? "Kunne ikke laste temaene."
                    : definedThemes.length === 0
                      ? "Ingen egne temaer ennå."
                      : definedThemes.length === 1
                        ? "1 eget tema"
                        : `${definedThemes.length} egne temaer`}
              </BodyShort>
            </div>
            <Button
              data-color="neutral"
              variant="tertiary"
              size="small"
              icon={<PlusIcon aria-hidden />}
              onClick={() => handleOpenCreate()}
            >
              Nytt tema
            </Button>
          </HStack>
        </Box>

        <Box padding={{ xs: "space-16", md: "space-24" }}>
          {isThemesLoading && !hasCachedThemes ? (
            <VStack gap="space-12">
              <Skeleton height="52px" />
              <Skeleton height="52px" />
            </VStack>
          ) : themesError && !hasCachedThemes ? (
            <Alert variant="error" size="small">
              Kunne ikke laste temaene. Prøv å laste siden på nytt.
            </Alert>
          ) : configuredThemesDisplay.length > 0 ? (
            <VStack gap="space-12">
              {themesError && (
                <Alert variant="warning" size="small">
                  Viser temaene som allerede var lastet inn. Kunne ikke
                  oppdatere dem akkurat nå.
                </Alert>
              )}
              {configuredThemesDisplay.map((theme) => {
                const percentage =
                  totalCount > 0
                    ? Math.round((theme.count / totalCount) * 100)
                    : 0;
                const isEditable =
                  theme.definedTheme && theme.theme !== "Annet";
                const themeId =
                  theme.themeId ??
                  (theme.theme === "Annet" ? "uncategorized" : null);
                const canNavigateToTheme =
                  analysisContext === "GENERAL_FEEDBACK" && themeId !== null;
                const themeAccentClass = getThemeAccentClass(theme.color);
                return (
                  <div
                    key={theme.theme}
                    className={`${styles.themeListRow} ${themeAccentClass}`}
                  >
                    <HStack
                      justify="space-between"
                      align="baseline"
                      wrap={false}
                    >
                      <HStack
                        gap="space-8"
                        align="center"
                        className={styles.themeRowMain}
                      >
                        {theme.color && <div className={styles.themeDot} />}
                        {canNavigateToTheme && themeId ? (
                          <Link
                            to="/feedback"
                            search={(prev) => ({
                              ...prev,
                              theme: themeId,
                              page: "1",
                            })}
                            className={`${styles.themeLinkButton} ${styles.themeLinkButtonEnabled}`}
                            title="Klikk for å se tilbakemeldinger med dette temaet"
                          >
                            <BodyShort
                              as="span"
                              size="small"
                              weight="semibold"
                              truncate
                            >
                              {theme.theme}
                            </BodyShort>
                          </Link>
                        ) : (
                          <BodyShort
                            as="span"
                            size="small"
                            weight="semibold"
                            truncate
                          >
                            {theme.theme}
                          </BodyShort>
                        )}
                        {isEditable && (
                          <Button
                            data-color="neutral"
                            variant="tertiary"
                            size="small"
                            icon={<PencilIcon aria-hidden />}
                            aria-label={`Rediger temaet ${theme.theme}`}
                            onClick={() => {
                              if (theme.definedTheme) {
                                handleOpenEdit(theme.definedTheme);
                              }
                            }}
                          />
                        )}
                      </HStack>
                      <HStack
                        gap="space-8"
                        align="center"
                        className={styles.themeMeta}
                      >
                        <BodyShort size="small" textColor="subtle">
                          {theme.count} svar ({percentage} %)
                        </BodyShort>
                        {theme.successRate !== undefined && (
                          <Tag
                            size="xsmall"
                            variant={
                              theme.successRate >= 0.8
                                ? "success"
                                : theme.successRate >= 0.5
                                  ? "warning"
                                  : "error"
                            }
                          >
                            {Math.round(theme.successRate * 100)} % kom i mål
                          </Tag>
                        )}
                      </HStack>
                    </HStack>

                    {/* Progress bar */}
                    <progress
                      className={styles.themeProgress}
                      value={theme.count}
                      max={totalCount > 0 ? totalCount : 1}
                      aria-label={`${percentage} prosent av svarene handler om ${theme.theme}`}
                    />

                    {/* Example quote */}
                    {theme.examples.length > 0 && (
                      <BodyShort
                        size="small"
                        textColor="subtle"
                        className={styles.themeExample}
                      >
                        "{theme.examples[0]}"
                      </BodyShort>
                    )}
                  </div>
                );
              })}
            </VStack>
          ) : (
            <HStack justify="center" padding="space-24">
              <Button
                variant="secondary"
                icon={<PlusIcon aria-hidden />}
                onClick={() => handleOpenCreate()}
              >
                Opprett første tema
              </Button>
            </HStack>
          )}
        </Box>

        {uncategorizedTheme && uncategorizedSummary && (
          <Box
            padding={{ xs: "space-16", md: "space-24" }}
            borderWidth="1 0 0 0"
            borderColor="neutral-subtle"
          >
            {analysisContext === "GENERAL_FEEDBACK" ? (
              <Link
                to="/feedback"
                search={(prev) => ({
                  ...prev,
                  theme: "uncategorized",
                  phrase: undefined,
                  query: undefined,
                  page: "1",
                })}
                className={`${styles.uncategorizedSummary} ${styles.uncategorizedLink}`}
              >
                {uncategorizedSummary}
              </Link>
            ) : (
              <div className={styles.uncategorizedSummary}>
                {uncategorizedSummary}
              </div>
            )}
          </Box>
        )}
      </DashboardCard>
      {/* Theme Modal */}
      <ThemeModal
        isOpen={isModalOpen}
        onClose={() => {
          setThemeMutationError(undefined);
          setThemeNameError(undefined);
          setIsModalOpen(false);
        }}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isSubmitting={isCreating || isUpdating || isDeleting}
        mutationError={themeMutationError}
        nameError={themeNameError}
        onClearNameError={() => setThemeNameError(undefined)}
        theme={editingTheme}
        availableWords={themeKeywordSuggestions}
      />
    </>
  );
}
