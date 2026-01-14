/**
 * Theme colors for consistent color coding across the application.
 * Used by ThemeModal, FieldStats charts, and other theme-related components.
 */
export const THEME_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

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
