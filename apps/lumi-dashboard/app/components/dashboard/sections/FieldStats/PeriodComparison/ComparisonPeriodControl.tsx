import { Detail, HGrid, Label, Switch, VStack } from "@navikt/ds-react";
import { PeriodSelector } from "~/components/dashboard/PeriodSelector";
import { useOsloToday } from "~/hooks/useOsloToday";
import { useSearchParams } from "~/hooks/useSearchParams";
import { getComparisonPeriods } from "./comparisonPeriods";
import styles from "./PeriodComparison.module.css";

export function ComparisonPeriodControl() {
  const { params, setParams } = useSearchParams();
  const today = useOsloToday();
  const periods = getComparisonPeriods(
    params.fromDate,
    params.toDate,
    params.compare,
    today,
    params.periodPreset,
  );
  return (
    <HGrid
      columns={{ xs: 1, sm: 2 }}
      gap="space-12"
      className={styles.periodControls}
    >
      <VStack gap="space-8">
        <Label as="span" size="small">
          Periode
        </Label>
        <PeriodSelector completeDays />
      </VStack>
      <VStack gap="space-4">
        <Switch
          size="small"
          checked={params.compare !== "none"}
          onChange={(event) =>
            void setParams({
              compare: event.target.checked ? "previous" : "none",
            })
          }
        >
          Sammenlign med forrige periode
        </Switch>
        {periods && periods.mode !== "none" && !periods.hasFutureDates ? (
          <>
            <Detail>Mot {periods.previous.label}</Detail>
            {periods.includesToday && (
              <Detail>Inkluderer i dag · foreløpig sammenligning</Detail>
            )}
          </>
        ) : null}
        {periods?.hasFutureDates && periods.mode !== "none" ? (
          <Detail>Velg en sluttdato senest i dag for å sammenligne.</Detail>
        ) : null}
      </VStack>
    </HGrid>
  );
}
