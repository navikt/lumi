import { Button } from "@navikt/ds-react";
import dayjs from "dayjs";
import { useSearchParams } from "~/hooks/useSearchParams";
import { shorterPeriodDays } from "~/utils/analysisBudget";

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
 * Offers a shorter period when the selected one has too many answers for an
 * analysis. The new period matches the quick choice with the same name.
 */
export function ShorterPeriodButton() {
  const { params, setParams } = useSearchParams();
  const days = shorterPeriodDays(params.fromDate, params.toDate);
  if (!days) return null;

  const showShorterPeriod = async () => {
    const today = dayjs();
    await setParams({
      dateMode: "fixed",
      fromDate: today.subtract(days - 1, "day").format("YYYY-MM-DD"),
      toDate: today.format("YYYY-MM-DD"),
      periodPreset: undefined,
      page: "1",
    });
    // The alert and this button go away with the new period. The period is
    // what changed, so focus continues there.
    window.requestAnimationFrame(focusPeriodTrigger);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      onClick={() => void showShorterPeriod()}
    >
      Vis siste {days} dager
    </Button>
  );
}
