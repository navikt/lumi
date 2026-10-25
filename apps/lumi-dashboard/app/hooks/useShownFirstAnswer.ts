import { useAnswerSpan } from "~/hooks/useAnswerSpan";
import { useStats } from "~/hooks/useStats";

/** The first answer for the selection each statistics object was shown with. */
const firstAnswerByStats = new WeakMap<object, string | undefined>();

/**
 * The first answer for the selection the statistics on screen belong to.
 * While statistics for new filters load, the previous ones keep the first
 * answer they were shown with, so their start stays where it was.
 */
export function useShownFirstAnswer(): string | undefined {
  const { data: stats, isPlaceholderData } = useStats();
  const current = useAnswerSpan()?.fromDate;
  if (!stats) return current;
  if (!isPlaceholderData) {
    firstAnswerByStats.set(stats, current);
    return current;
  }
  return firstAnswerByStats.get(stats);
}
