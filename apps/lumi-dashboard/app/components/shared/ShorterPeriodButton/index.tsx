import { Button } from "@navikt/ds-react";
import { focusPeriodTrigger } from "~/components/dashboard/PeriodSelector";
import { useSearchParams } from "~/hooks/useSearchParams";
import { type DateRange, fixedPeriodSearch } from "~/utils/dashboardPeriod";
import { formatDateRange } from "~/utils/dateUtils";

/** Shows a shorter period that the analysis budget alert has chosen. */
export function ShorterPeriodButton({ period }: { period: DateRange }) {
  const { setParams } = useSearchParams();

  const showPeriod = async () => {
    const origin = document.activeElement;
    await setParams(fixedPeriodSearch(period.fromDate, period.toDate));
    // The new period removes the alert and this button.
    window.requestAnimationFrame(() => focusPeriodTrigger(origin));
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      onClick={() => void showPeriod()}
    >
      Vis perioden {formatDateRange(period.fromDate, period.toDate)}
    </Button>
  );
}
