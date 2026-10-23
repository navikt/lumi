import { Button } from "@navikt/ds-react";
import { useSearchParams } from "~/hooks/useSearchParams";
import { periodEnd, shorterPeriodDays } from "~/utils/analysisBudget";

/**
 * PeriodSelector marks its button with this attribute. The filter bar
 * renders one for wide and one for narrow screens, and CSS hides the other.
 */
const PERIOD_TRIGGER_SELECTOR = "[data-period-trigger]";

function focusPeriodTrigger() {
  const triggers = document.querySelectorAll<HTMLElement>(
    PERIOD_TRIGGER_SELECTOR,
  );
  Array.from(triggers)
    .find((trigger) => trigger.getClientRects().length > 0)
    ?.focus();
}

/**
 * Offers the last 30 or 7 days of the selected period when it has too many
 * answers for an analysis. The new period ends where the old one ends, so it
 * never has more answers.
 */
export function ShorterPeriodButton() {
  const { params, setParams } = useSearchParams();
  const days = shorterPeriodDays(params.fromDate, params.toDate);
  if (!days) return null;

  const showShorterPeriod = async () => {
    const end = periodEnd(params.toDate);
    await setParams({
      dateMode: "fixed",
      fromDate: end.subtract(days - 1, "day").format("YYYY-MM-DD"),
      toDate: end.format("YYYY-MM-DD"),
      periodPreset: undefined,
      page: "1",
    });
    // The alert and this button go away with the new period. Focus moves to
    // the period button, which names the new period.
    window.requestAnimationFrame(focusPeriodTrigger);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      onClick={() => void showShorterPeriod()}
    >
      Vis de siste {days} dagene i perioden
    </Button>
  );
}
