/**
 * Format a relative time string in Norwegian.
 * E.g., "2 timer siden", "I går", "3 dager siden"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Akkurat nå";
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? "1 minutt siden"
      : `${diffMinutes} minutter siden`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "1 time siden" : `${diffHours} timer siden`;
  }
  if (diffDays === 1) return "I går";
  if (diffDays < 7) return `${diffDays} dager siden`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 uke siden" : `${weeks} uker siden`;
  }

  return date.toLocaleDateString("no-NO", {
    day: "numeric",
    month: "short",
  });
}
