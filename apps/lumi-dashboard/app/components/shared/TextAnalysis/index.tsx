import {
  InformationSquareIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Button,
  Heading,
  HStack,
  Skeleton,
  Tag,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import { useCallback, useMemo, useState } from "react";
import { DashboardCard } from "~/components/dashboard";
import {
  type ContextExample,
  ThemeModal,
} from "~/components/shared/ThemeModal";
import { WordCloud } from "~/components/shared/WordCloud";
import { WordPopover } from "~/components/shared/WordPopover";
import { useThemes } from "~/hooks/useThemes";
import type {
  AnalysisContext,
  CreateThemeInput,
  TextTheme,
  UpdateThemeInput,
  WordFrequency,
} from "~/types/api";
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
  /** Word frequency data for the word cloud */
  wordFrequency: WordFrequency[];
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
    wordCloudTitle?: string;
    themesTitle?: string;
    recentTitle?: string;
    recentSubtitle?: string;
    emptyMessage?: string;
  };
  /** Show success/status tags on recent responses */
  showResponseStatus?: boolean;
}

const DEFAULT_LABELS = {
  wordCloudTitle: "Ordfrekvens",
  themesTitle: "Identifiserte temaer",
  recentTitle: "Siste svar",
  recentSubtitle: "Nylige svar fra brukere",
  emptyMessage: "Ingen data tilgjengelig ennå.",
};

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
 * Unified text analysis component for Discovery and Blocker patterns.
 * Displays word cloud, theme clustering, and recent responses.
 *
 * Supports creating/editing themes via modal, and removing words from themes via popover.
 */
export function TextAnalysis({
  analysisContext,
  wordFrequency,
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
    createTheme,
    updateTheme,
    deleteTheme,
    isCreating,
    isUpdating,
    isDeleting,
  } = useThemes({ context: analysisContext });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<TextTheme | undefined>();
  const [initialKeywords, setInitialKeywords] = useState<string[]>([]);

  // Popover state for categorized words
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [popoverWord, setPopoverWord] = useState<string>("");
  const [popoverTheme, setPopoverTheme] = useState<TextTheme | null>(null);

  // Build O(1) lookup map for word frequency data
  const wordLookup = useMemo(() => {
    const map = new Map<string, WordFrequency>();
    for (const w of wordFrequency) {
      map.set(w.word.toLowerCase(), w);
      map.set(w.stem.toLowerCase(), w);
      for (const variant of w.variants ?? []) {
        map.set(variant.word.toLowerCase(), w);
      }
    }
    return map;
  }, [wordFrequency]);

  // Get context examples for the selected word
  const getContextExamples = useCallback(
    (word: string): ContextExample[] => {
      if (!word) return [];
      const wordData = wordLookup.get(word.toLowerCase());
      if (wordData?.sourceResponses && wordData.sourceResponses.length > 0) {
        return wordData.sourceResponses;
      }
      // Fallback to substring search in recentResponses
      const wordLower = word.toLowerCase();
      return recentResponses
        .filter((r) => r.text.toLowerCase().includes(wordLower))
        .map((r) => ({ text: r.text, submittedAt: r.submittedAt }));
    },
    [wordLookup, recentResponses],
  );

  // Get theme for a word (for coloring)
  const getThemeForWord = useCallback(
    (word: string): TextTheme | undefined => {
      const wordLower = word.toLowerCase();

      const wordData = wordLookup.get(wordLower);
      const surfaceCandidates = new Set<string>([
        wordLower,
        ...(wordData?.variants?.map((v) => v.word.toLowerCase()) ?? []),
      ]);
      const stemCandidate = wordData?.stem.toLowerCase();

      const matchesSurfaceCandidate = (kwLower: string) => {
        for (const candidate of surfaceCandidates) {
          if (
            kwLower === candidate ||
            candidate.includes(kwLower) ||
            kwLower.includes(candidate)
          ) {
            return true;
          }
        }
        return false;
      };

      return definedThemes.find((t) =>
        t.keywords.some((kw) => {
          const kwLower = kw.toLowerCase();

          if (matchesSurfaceCandidate(kwLower)) return true;

          // Stem is a stable grouping key; only do exact match to avoid over-matching.
          return stemCandidate ? kwLower === stemCandidate : false;
        }),
      );
    },
    [definedThemes, wordLookup],
  );

  // Open modal for creating new theme
  const handleOpenCreate = useCallback((keyword?: string) => {
    setEditingTheme(undefined);
    setInitialKeywords(keyword ? [keyword] : []);
    setIsModalOpen(true);
  }, []);

  // Open modal for editing existing theme
  const handleOpenEdit = useCallback((theme: TextTheme) => {
    setEditingTheme(theme);
    setInitialKeywords([]);
    setIsModalOpen(true);
    setPopoverAnchor(null);
  }, []);

  // Handle modal submit
  const handleSubmit = useCallback(
    (data: CreateThemeInput | (UpdateThemeInput & { themeId: string })) => {
      if ("themeId" in data) {
        updateTheme(data, {
          onSuccess: () => setIsModalOpen(false),
        });
      } else {
        createTheme(
          { ...data, analysisContext },
          {
            onSuccess: () => setIsModalOpen(false),
          },
        );
      }
    },
    [createTheme, updateTheme, analysisContext],
  );

  // Handle delete
  const handleDelete = useCallback(
    (themeId: string) => {
      deleteTheme(themeId, {
        onSuccess: () => setIsModalOpen(false),
      });
    },
    [deleteTheme],
  );

  // Handle word click from word cloud
  const handleWordClick = useCallback(
    (word: string, event: React.MouseEvent<HTMLButtonElement>) => {
      const existingTheme = getThemeForWord(word);
      if (existingTheme) {
        setPopoverWord(word);
        setPopoverTheme(existingTheme);
        setPopoverAnchor(event.currentTarget);
      } else {
        handleOpenCreate(word);
      }
    },
    [getThemeForWord, handleOpenCreate],
  );

  // Handle removing word from theme (via popover)
  const handleRemoveWord = useCallback(
    (themeId: string, word: string) => {
      const theme = definedThemes.find((t) => t.id === themeId);
      if (!theme) return;

      const wordLower = word.toLowerCase();
      const wordData = wordLookup.get(wordLower);
      const removeSet = new Set<string>([
        wordLower,
        wordData?.stem.toLowerCase() ?? "",
        ...(wordData?.variants?.map((v) => v.word.toLowerCase()) ?? []),
      ]);
      removeSet.delete("");

      const updatedKeywords = theme.keywords.filter(
        (k) => !removeSet.has(k.toLowerCase()),
      );
      updateTheme({ themeId, keywords: updatedKeywords });
    },
    [definedThemes, updateTheme, wordLookup],
  );

  // Combine defined themes with stats
  const allThemesDisplay = useMemo(() => {
    const result: ThemeWithStats[] = definedThemes.map((definedTheme) => {
      const stats = statsThemes.find((t) => t.theme === definedTheme.name);
      return {
        theme: definedTheme.name,
        themeId: definedTheme.id,
        count: stats?.count ?? 0,
        examples: stats?.examples ?? [],
        color: definedTheme.color,
        definedTheme,
      };
    });

    // Add themes from stats that aren't in definedThemes (e.g., "Annet")
    for (const statTheme of statsThemes) {
      if (!definedThemes.some((dt) => dt.name === statTheme.theme)) {
        result.push({
          theme: statTheme.theme,
          themeId: statTheme.themeId,
          count: statTheme.count,
          examples: statTheme.examples,
          color: statTheme.color,
          definedTheme: undefined,
        });
      }
    }

    // Filter out zero-count themes and sort
    return result
      .filter((t) => t.count > 0)
      .sort((a, b) => {
        if (a.theme === "Annet") return 1;
        if (b.theme === "Annet") return -1;
        if (b.count !== a.count) return b.count - a.count;
        return (a.theme || "").localeCompare(b.theme || "");
      });
  }, [definedThemes, statsThemes]);

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

  // Empty state
  if (totalCount === 0 && definedThemes.length === 0) {
    return (
      <DashboardCard>
        <BodyShort textColor="subtle">{labels.emptyMessage}</BodyShort>
        <Button
          variant="secondary"
          size="small"
          icon={<PlusIcon aria-hidden />}
          onClick={() => handleOpenCreate()}
          className={styles.createFirstThemeButton}
        >
          Opprett første tema
        </Button>
      </DashboardCard>
    );
  }

  const maxThemeCount = allThemesDisplay[0]?.count ?? 1;

  return (
    <>
      {/* Word Cloud Section */}
      {wordFrequency.length > 0 && (
        <DashboardCard padding="0" className={styles.cardOverflowHidden}>
          <Box
            padding={{ xs: "space-16", md: "space-24" }}
            borderWidth="0 0 1 0"
            borderColor="neutral-subtle"
          >
            <HStack gap="space-8" align="center">
              <span className={styles.sectionIcon}>
                <MagnifyingGlassIcon fontSize="1.25rem" aria-hidden />
              </span>
              <Heading size="small">{labels.wordCloudTitle}</Heading>
              <Tooltip content="Klikk på et ord for å opprette et tema med det som nøkkelord">
                <InformationSquareIcon
                  fontSize="1rem"
                  className={styles.helpIcon}
                  aria-hidden
                />
              </Tooltip>
            </HStack>
            <BodyShort
              size="small"
              textColor="subtle"
              className={styles.sectionSubtitle}
            >
              Klikk på et ord for å lage tema eller redigere eksisterende
            </BodyShort>
          </Box>

          <Box padding={{ xs: "space-16", md: "space-24" }}>
            <WordCloud
              words={wordFrequency}
              maxWords={30}
              getThemeForWord={getThemeForWord}
              onWordClick={handleWordClick}
            />
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
          <HStack justify="space-between" align="center">
            <HStack gap="space-8" align="center">
              <Heading size="small">{labels.themesTitle}</Heading>
              <Tooltip content="Gruppert basert på nøkkelord du definerer. Klikk på et tema for å redigere.">
                <InformationSquareIcon
                  fontSize="1rem"
                  className={styles.helpIcon}
                  aria-hidden
                />
              </Tooltip>
            </HStack>
            <Button
              variant="tertiary"
              size="small"
              icon={<PlusIcon aria-hidden />}
              onClick={() => handleOpenCreate()}
            >
              Opprett nytt tema
            </Button>
          </HStack>
          <BodyShort
            size="small"
            textColor="subtle"
            className={styles.sectionSubtitle}
          >
            {allThemesDisplay.length > 0
              ? `${allThemesDisplay.length} temaer vist`
              : "Ingen temaer med data ennå."}
          </BodyShort>
        </Box>

        <Box padding={{ xs: "space-16", md: "space-24" }}>
          {allThemesDisplay.length > 0 ? (
            <VStack gap="space-12">
              {allThemesDisplay.map((theme) => {
                const percentage = Math.round((theme.count / totalCount) * 100);
                const isEditable =
                  theme.definedTheme && theme.theme !== "Annet";
                const themeId =
                  theme.themeId ??
                  (theme.theme === "Annet" ? "uncategorized" : null);
                const themeAccentClass = getThemeAccentClass(theme.color);
                const handleNavigateToTheme = () => {
                  if (!themeId) return;
                  const url = new URL(window.location.href);
                  url.pathname = "/feedback";
                  url.searchParams.set("theme", themeId);
                  url.searchParams.set("page", "1");
                  window.location.href = url.toString();
                };

                return (
                  <div
                    key={theme.theme}
                    className={[
                      styles.themeListRow,
                      themeAccentClass,
                      themeId ? styles.themeListRowClickable : "",
                    ].join(" ")}
                    title={
                      themeId ? "Klikk for å se feedback med dette temaet" : ""
                    }
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
                        <button
                          type="button"
                          onClick={handleNavigateToTheme}
                          disabled={!themeId}
                          className={[
                            styles.themeLinkButton,
                            themeId ? styles.themeLinkButtonEnabled : "",
                          ].join(" ")}
                          title={
                            themeId
                              ? "Klikk for å se feedback med dette temaet"
                              : ""
                          }
                        >
                          <BodyShort
                            as="span"
                            size="small"
                            weight="semibold"
                            truncate
                          >
                            {theme.theme}
                          </BodyShort>
                        </button>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => {
                              if (theme.definedTheme) {
                                handleOpenEdit(theme.definedTheme);
                              }
                            }}
                            className={styles.themeEditButton}
                            title="Rediger tema"
                          >
                            ✎
                          </button>
                        )}
                      </HStack>
                      <HStack
                        gap="space-8"
                        align="center"
                        className={styles.themeMeta}
                      >
                        <BodyShort size="small" textColor="subtle">
                          {theme.count} ({percentage}%)
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
                            {Math.round(theme.successRate * 100)}%
                          </Tag>
                        )}
                      </HStack>
                    </HStack>

                    {/* Progress bar */}
                    <progress
                      className={styles.themeProgress}
                      value={theme.count}
                      max={maxThemeCount}
                      aria-label={`Andel for tema ${theme.theme}`}
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
      </DashboardCard>
      {/* Recent Responses */}
      {recentResponses.length > 0 && (
        <DashboardCard padding="0" className={styles.cardOverflowHidden}>
          <Box
            padding={{ xs: "space-16", md: "space-24" }}
            borderWidth="0 0 1 0"
            borderColor="neutral-subtle"
          >
            <Heading size="small">{labels.recentTitle}</Heading>
            <BodyShort
              size="small"
              textColor="subtle"
              className={styles.sectionSubtitle}
            >
              {labels.recentSubtitle}
            </BodyShort>
          </Box>

          <Box padding={{ xs: "space-16", md: "space-24" }}>
            <VStack gap="space-12">
              {recentResponses.slice(0, 10).map((response) => (
                <div
                  key={`${response.text}-${response.submittedAt}`}
                  className={styles.recentResponseCard}
                >
                  <HStack justify="space-between" align="start" wrap={false}>
                    <BodyShort
                      size="small"
                      className={styles.recentResponseText}
                    >
                      "{response.text}"
                    </BodyShort>
                    {showResponseStatus && response.success && (
                      <Tag
                        size="xsmall"
                        variant={
                          response.success === "yes"
                            ? "success"
                            : response.success === "partial"
                              ? "warning"
                              : "error"
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
                  {response.additionalInfo && (
                    <BodyShort
                      size="small"
                      textColor="subtle"
                      className={styles.recentResponseAdditional}
                    >
                      {response.additionalInfo}
                    </BodyShort>
                  )}
                </div>
              ))}
            </VStack>
          </Box>
        </DashboardCard>
      )}
      {/* Word Popover for categorized words */}
      {popoverTheme && (
        <WordPopover
          word={popoverWord}
          theme={popoverTheme}
          anchorEl={popoverAnchor}
          isOpen={!!popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onRemoveWord={handleRemoveWord}
          onEditTheme={handleOpenEdit}
        />
      )}
      {/* Theme Modal */}
      <ThemeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isSubmitting={isCreating || isUpdating || isDeleting}
        theme={editingTheme}
        initialKeywords={initialKeywords}
        availableWords={wordFrequency.map((w) => w.word)}
        allThemes={definedThemes}
        contextExamples={
          initialKeywords.length > 0
            ? getContextExamples(initialKeywords[0])
            : []
        }
        wordVariants={
          initialKeywords.length > 0
            ? (wordLookup.get(initialKeywords[0].toLowerCase())?.variants ?? [])
            : []
        }
      />
    </>
  );
}
