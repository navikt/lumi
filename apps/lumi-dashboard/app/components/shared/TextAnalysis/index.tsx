import {
  InformationSquareIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Button,
  HStack,
  Heading,
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
      return definedThemes.find((t) =>
        t.keywords.some(
          (kw) =>
            kw.toLowerCase() === wordLower ||
            wordLower.includes(kw.toLowerCase()) ||
            kw.toLowerCase().includes(wordLower),
        ),
      );
    },
    [definedThemes],
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
      const updatedKeywords = theme.keywords.filter(
        (k) => k.toLowerCase() !== word.toLowerCase(),
      );
      updateTheme({ themeId, keywords: updatedKeywords });
    },
    [definedThemes, updateTheme],
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
      <DashboardCard padding="0" style={{ overflow: "hidden" }}>
        <Box.New
          padding={{ xs: "space-16", md: "space-24" }}
          borderWidth="0 0 1 0"
          borderColor="neutral-subtle"
        >
          <Skeleton width="200px" height="24px" />
        </Box.New>
        <Box.New padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            {[...Array(4)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeletons are static
              <Skeleton key={i} width="100%" height="40px" />
            ))}
          </VStack>
        </Box.New>
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
          style={{ marginTop: "1rem" }}
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
        <DashboardCard padding="0" style={{ overflow: "hidden" }}>
          <Box.New
            padding={{ xs: "space-16", md: "space-24" }}
            borderWidth="0 0 1 0"
            borderColor="neutral-subtle"
          >
            <HStack gap="space-8" align="center">
              <span
                style={{
                  color: "var(--ax-text-neutral-subtle)",
                  display: "flex",
                }}
              >
                <MagnifyingGlassIcon fontSize="1.25rem" aria-hidden />
              </span>
              <Heading size="small">{labels.wordCloudTitle}</Heading>
              <Tooltip content="Klikk på et ord for å opprette et tema med det som nøkkelord">
                <InformationSquareIcon
                  fontSize="1rem"
                  style={{
                    cursor: "help",
                    color: "var(--ax-text-neutral-subtle)",
                  }}
                  aria-hidden
                />
              </Tooltip>
            </HStack>
            <BodyShort
              size="small"
              textColor="subtle"
              style={{ marginTop: "0.25rem" }}
            >
              Klikk på et ord for å lage tema eller redigere eksisterende
            </BodyShort>
          </Box.New>

          <Box.New padding={{ xs: "space-16", md: "space-24" }}>
            <WordCloud
              words={wordFrequency}
              maxWords={30}
              getThemeForWord={getThemeForWord}
              onWordClick={handleWordClick}
            />
          </Box.New>
        </DashboardCard>
      )}

      {/* Themes Section */}
      <DashboardCard padding="0" style={{ overflow: "hidden" }}>
        <Box.New
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
                  style={{
                    cursor: "help",
                    color: "var(--ax-text-neutral-subtle)",
                  }}
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
            style={{ marginTop: "0.25rem" }}
          >
            {allThemesDisplay.length > 0
              ? `${allThemesDisplay.length} temaer vist`
              : "Ingen temaer med data ennå."}
          </BodyShort>
        </Box.New>

        <Box.New padding={{ xs: "space-16", md: "space-24" }}>
          {allThemesDisplay.length > 0 ? (
            <VStack gap="space-12">
              {allThemesDisplay.map((theme) => {
                const percentage = Math.round((theme.count / totalCount) * 100);
                const relativeWidth = (theme.count / maxThemeCount) * 100;
                const isEditable =
                  theme.definedTheme && theme.theme !== "Annet";
                const themeId =
                  theme.themeId ??
                  (theme.theme === "Annet" ? "uncategorized" : null);

                return (
                  <div
                    key={theme.theme}
                    role={themeId ? "button" : undefined}
                    tabIndex={themeId ? 0 : undefined}
                    onClick={() => {
                      if (themeId) {
                        const url = new URL(window.location.href);
                        url.pathname = "/feedback";
                        url.searchParams.set("theme", themeId);
                        window.location.href = url.toString();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (themeId && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        const url = new URL(window.location.href);
                        url.pathname = "/feedback";
                        url.searchParams.set("theme", themeId);
                        window.location.href = url.toString();
                      }
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "0.5rem",
                      borderRadius: "var(--ax-border-radius-medium)",
                      cursor: themeId ? "pointer" : "default",
                      transition: "background-color 0.2s ease",
                    }}
                    title={
                      themeId ? "Klikk for å se feedback med dette temaet" : ""
                    }
                  >
                    <HStack
                      justify="space-between"
                      align="baseline"
                      wrap={false}
                    >
                      <HStack gap="space-8" align="center">
                        {theme.color && (
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              backgroundColor: theme.color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <BodyShort size="small" weight="semibold" truncate>
                          {theme.theme}
                        </BodyShort>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (theme.definedTheme)
                                handleOpenEdit(theme.definedTheme);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: "2px",
                              cursor: "pointer",
                              color: "var(--ax-text-muted)",
                            }}
                            title="Rediger tema"
                          >
                            ✎
                          </button>
                        )}
                      </HStack>
                      <HStack
                        gap="space-8"
                        align="center"
                        style={{ flexShrink: 0 }}
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
                    <div
                      style={{
                        marginTop: "0.25rem",
                        height: "6px",
                        borderRadius: "3px",
                        backgroundColor: "var(--ax-bg-neutral-moderate)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${relativeWidth}%`,
                          height: "100%",
                          borderRadius: "3px",
                          backgroundColor:
                            theme.color ?? "var(--ax-status-info)",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    {/* Example quote */}
                    {theme.examples.length > 0 && (
                      <BodyShort
                        size="small"
                        textColor="subtle"
                        style={{
                          marginTop: "0.25rem",
                          fontStyle: "italic",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
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
        </Box.New>
      </DashboardCard>

      {/* Recent Responses */}
      {recentResponses.length > 0 && (
        <DashboardCard padding="0" style={{ overflow: "hidden" }}>
          <Box.New
            padding={{ xs: "space-16", md: "space-24" }}
            borderWidth="0 0 1 0"
            borderColor="neutral-subtle"
          >
            <Heading size="small">{labels.recentTitle}</Heading>
            <BodyShort
              size="small"
              textColor="subtle"
              style={{ marginTop: "0.25rem" }}
            >
              {labels.recentSubtitle}
            </BodyShort>
          </Box.New>

          <Box.New padding={{ xs: "space-16", md: "space-24" }}>
            <VStack gap="space-12">
              {recentResponses.slice(0, 10).map((response) => (
                <div
                  key={`${response.text}-${response.submittedAt}`}
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "var(--ax-bg-neutral-soft)",
                    borderRadius: "var(--ax-border-radius-medium)",
                  }}
                >
                  <HStack justify="space-between" align="start" wrap={false}>
                    <BodyShort size="small" style={{ flex: 1 }}>
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
                        style={{ flexShrink: 0, marginLeft: "0.5rem" }}
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
                      style={{ marginTop: "0.25rem" }}
                    >
                      {response.additionalInfo}
                    </BodyShort>
                  )}
                </div>
              ))}
            </VStack>
          </Box.New>
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
      />
    </>
  );
}
