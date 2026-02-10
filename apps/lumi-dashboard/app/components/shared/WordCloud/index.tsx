import type { TextTheme } from "~/types/api";
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
  [THEME_COLOR_BLUE]: styles.themeBlue,
  [THEME_COLOR_EMERALD]: styles.themeEmerald,
  [THEME_COLOR_AMBER]: styles.themeAmber,
  [THEME_COLOR_RED]: styles.themeRed,
  [THEME_COLOR_VIOLET]: styles.themeViolet,
  [THEME_COLOR_PINK]: styles.themePink,
  [THEME_COLOR_CYAN]: styles.themeCyan,
  [THEME_COLOR_LIME]: styles.themeLime,
  [THEME_COLOR_ORANGE]: styles.themeOrange,
  [THEME_COLOR_GRAY]: styles.themeGray,
};

const WORD_SIZE_CLASS_COUNT = 16;

function getThemeColorClass(theme?: TextTheme): string {
  if (!theme?.color) return styles.themeDefault;
  return (
    THEME_COLOR_CLASS_BY_HEX[theme.color.toLowerCase()] ?? styles.themeDefault
  );
}

function getWordSizeClass(ratio: number): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const idx = Math.round(clampedRatio * (WORD_SIZE_CLASS_COUNT - 1));
  const classKey = `size${idx.toString().padStart(2, "0")}`;
  return styles[classKey] ?? styles.size00;
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
