import type { TextTheme } from "~/types/api";

interface WordCloudWord {
  word: string;
  count: number;
}

interface WordCloudProps {
  /** Array of words with their frequency counts */
  words: WordCloudWord[];
  /** Maximum number of words to display (default: 30) */
  maxWords?: number;
  /** Function to get the theme a word belongs to (for coloring) */
  getThemeForWord: (word: string) => TextTheme | undefined;
  /** Called when a word is clicked */
  onWordClick: (
    word: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
}

/**
 * Reusable word cloud component that displays words with frequency-based sizing.
 * Words belonging to a theme are colored with the theme color.
 * Supports hover effects and click interactions.
 */
export function WordCloud({
  words,
  maxWords = 30,
  getThemeForWord,
  onWordClick,
}: WordCloudProps) {
  if (words.length === 0) return null;

  const maxCount = words[0]?.count ?? 1;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        alignItems: "center",
      }}
    >
      {words.slice(0, maxWords).map(({ word, count }, index) => {
        // Scale font size based on frequency (0.75 to 1.5 rem)
        const scale = 0.75 + (count / maxCount) * 0.75;
        const wordTheme = getThemeForWord(word);
        const isCategorized = !!wordTheme;

        // Use theme color if categorized, otherwise neutral based on rank
        const baseColor = isCategorized
          ? wordTheme.color
          : index < 3
            ? "var(--ax-text-default)"
            : index < 10
              ? "var(--ax-text-neutral-subtle)"
              : "var(--ax-text-muted)";

        return (
          <button
            key={word}
            type="button"
            onClick={(e) => onWordClick(word, e)}
            aria-label={
              isCategorized
                ? `${word}, nevnt ${count} ganger, tilhører tema ${wordTheme.name}`
                : `${word}, nevnt ${count} ganger, ikke kategorisert`
            }
            style={{
              fontSize: `${scale}rem`,
              fontWeight: index < 5 ? 600 : 400,
              color: baseColor,
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: isCategorized ? `${wordTheme.color}15` : "none",
              border: "none",
              padding: "0.125rem 0.25rem",
              borderRadius: "var(--ax-border-radius-small)",
            }}
            title={
              isCategorized
                ? `${word}: tilhører "${wordTheme.name}" – klikk for å administrere`
                : `${word}: ${count} ganger – klikk for å kategorisere`
            }
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isCategorized
                ? `${wordTheme.color || "#888"}30`
                : "var(--ax-bg-neutral-soft-hover)";
              e.currentTarget.style.color = isCategorized
                ? wordTheme.color || "#888"
                : "var(--ax-text-action)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isCategorized
                ? `${wordTheme.color || "#888"}15`
                : "transparent";
              e.currentTarget.style.color = baseColor || "";
            }}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}
