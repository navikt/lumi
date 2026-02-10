/**
 * Theme colors for consistent color coding across the application.
 * Used by ThemeModal, FieldStats charts, and other theme-related components.
 */
export const THEME_COLOR_BLUE = "#3b82f6";
export const THEME_COLOR_EMERALD = "#10b981";
export const THEME_COLOR_AMBER = "#f59e0b";
export const THEME_COLOR_RED = "#ef4444";
export const THEME_COLOR_VIOLET = "#8b5cf6";
export const THEME_COLOR_PINK = "#ec4899";
export const THEME_COLOR_CYAN = "#06b6d4";
export const THEME_COLOR_LIME = "#84cc16";
export const THEME_COLORS = [
  THEME_COLOR_BLUE, // Blue
  THEME_COLOR_EMERALD, // Emerald
  THEME_COLOR_AMBER, // Amber
  THEME_COLOR_RED, // Red
  THEME_COLOR_VIOLET, // Violet
  THEME_COLOR_PINK, // Pink
  THEME_COLOR_CYAN, // Cyan
  THEME_COLOR_LIME, // Lime
];

/**
 * Additional theme-like colors used in some views/components.
 */
export const THEME_COLOR_ORANGE = "#f97316";
export const THEME_COLOR_GRAY = "#9ca3af";

/**
 * Chart colors for choice/option visualizations.
 */
export const CHOICE_COLORS = [
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
];

/**
 * Get a color from the theme colors palette by index (cycles).
 */
export function getThemeColor(index: number): string {
  return THEME_COLORS[index % THEME_COLORS.length];
}

/**
 * Get a color from the choice colors palette by index (cycles).
 */
export function getChoiceColor(index: number): string {
  return CHOICE_COLORS[index % CHOICE_COLORS.length];
}
