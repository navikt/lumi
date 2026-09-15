import { Detail, HGrid, Label, Switch, VStack } from "@navikt/ds-react";
import { useId } from "react";
import { PeriodSelector } from "~/components/dashboard/PeriodSelector";
import { useOsloToday } from "~/hooks/useOsloToday";
import { useSearchParams } from "~/hooks/useSearchParams";
import { getComparisonPeriods } from "./comparisonPeriods";
import styles from "./PeriodComparison.module.css";

export function ComparisonPeriodControl() {
  const { params, setParams } = useSearchParams();
  const today = useOsloToday();
  const descriptionId = useId();
  const periods = getComparisonPeriods(
    params.fromDate,
    params.toDate,
    params.compare,
    today,
    params.periodPreset,
  );
  return (
    <HGrid
      columns={{ xs: 1, md: "minmax(0, 1fr) auto" }}
      gap={{ xs: "space-16", md: "space-24" }}
      className={styles.periodControls}
    >
      <HGrid
        columns={{ xs: "1fr", sm: "auto minmax(0, 1fr)" }}
        gap="space-12"
        align="center"
        className={styles.periodPicker}
      >
        <Label as="span" size="small">
          Periode
        </Label>
        <PeriodSelector completeDays />
      </HGrid>
      <VStack className={styles.comparisonControl}>
        <Switch
          size="small"
          position="right"
          aria-describedby={
            periods && periods.mode !== "none" ? descriptionId : undefined
          }
          checked={params.compare !== "none"}
          onChange={(event) =>
            void setParams({
              compare: event.target.checked ? "previous" : "none",
            })
          }
        >
          Sammenlign med forrige periode
        </Switch>
        {periods && periods.mode !== "none" ? (
          <VStack id={descriptionId} gap="space-2">
            {periods.hasFutureDates ? (
              <Detail textColor="subtle">
                Velg en sluttdato senest i dag for å sammenligne.
              </Detail>
            ) : (
              <>
                <Detail textColor="subtle">Mot {periods.previous.label}</Detail>
                {periods.includesToday && (
                  <Detail textColor="subtle">
                    Inkluderer i dag · foreløpig sammenligning
                  </Detail>
                )}
              </>
            )}
          </VStack>
        ) : null}
      </VStack>
    </HGrid>
  );
}
