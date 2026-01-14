import dayjs from "dayjs";

/**
 * Formats a date string for display in tables and lists.
 * @example formatDate("2024-01-15") -> "15.01.24"
 */
export function formatDate(date: string): string {
  return dayjs(date).format("DD.MM.YY");
}

/**
 * Formats a date string for tooltips and detailed views.
 * @example formatDateTime("2024-01-15T10:30:00Z") -> "2024-01-15 10:30:00"
 */
export function formatDateTime(date: string): string {
  return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * Formats a date string for user-friendly display.
 * @example formatDateLong("2024-01-15") -> "15.01.2024"
 */
export function formatDateLong(date: string): string {
  return dayjs(date).format("DD.MM.YYYY");
}

/**
 * Gets the start of the default date range (30 days ago).
 */
export function getDefaultFromDate(): string {
  return dayjs().subtract(30, "day").format("YYYY-MM-DD");
}

/**
 * Gets the end of the default date range (today).
 */
export function getDefaultToDate(): string {
  return dayjs().format("YYYY-MM-DD");
}
