import type { TextTheme } from "~/types/api";
import styles from "./WordCloud.module.css";

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

const THEME_COLOR_CLASS_BY_HEX: Record<string, string> = {
  "#3b82f6": styles.themeBlue,
  "#10b981": styles.themeEmerald,
  "#f59e0b": styles.themeAmber,
  "#ef4444": styles.themeRed,
  "#8b5cf6": styles.themeViolet,
  "#ec4899": styles.themePink,
  "#06b6d4": styles.themeCyan,
  "#84cc16": styles.themeLime,
  "#f97316": styles.themeOrange,
  "#9ca3af": styles.themeGray,
};

function getThemeColorClass(theme?: TextTheme): string {
  if (!theme?.color) return "";
  return (
    THEME_COLOR_CLASS_BY_HEX[theme.color.toLowerCase()] ?? styles.themeDefault
  );
}

function getWordSizeClass(ratio: number): string {
  if (ratio >= 0.9) return styles.sizeXl;
  if (ratio >= 0.75) return styles.sizeLg;
  if (ratio >= 0.6) return styles.sizeMd;
  if (ratio >= 0.45) return styles.sizeSm;
  if (ratio >= 0.3) return styles.sizeXs;
  return styles.sizeXxs;
}

function getUncategorizedRankClass(index: number): string {
  if (index < 3) return styles.uncategorizedTop;
  if (index < 10) return styles.uncategorizedMid;
  return styles.uncategorizedLow;
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
    <div className={styles.cloud}>
      {words.slice(0, maxWords).map(({ word, count }, index) => {
        const ratio = count / maxCount;
        const wordTheme = getThemeForWord(word);
        const isCategorized = !!wordTheme;
        const className = [
          styles.word,
          getWordSizeClass(ratio),
          index < 5 ? styles.weightStrong : styles.weightNormal,
          isCategorized
            ? getThemeColorClass(wordTheme)
            : getUncategorizedRankClass(index),
        ].join(" ");

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
            className={className}
            title={
              isCategorized
                ? `${word}: tilhører "${wordTheme.name}" – klikk for å administrere`
                : `${word}: ${count} ganger – klikk for å kategorisere`
            }
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}
