import { Alert, BodyShort, Button, HStack, VStack } from "@navikt/ds-react";
import type { Ref } from "react";
import { ShorterPeriodButton } from "~/components/shared/ShorterPeriodButton";
import { useAnswerSpan } from "~/hooks/useAnswerSpan";
import { useOsloToday } from "~/hooks/useOsloToday";
import { useSearchParams } from "~/hooks/useSearchParams";
import {
  ANALYSIS_BUDGET_TITLE,
  inMemoryFilters,
  nameFilters,
  shorterPeriod,
} from "~/utils/analysisBudget";
import { focusPageHeading } from "~/utils/focus";

interface AnalysisBudgetAlertProps {
  /** What cannot be computed, as a sentence. The alert adds what helps. */
  description: string;
  /**
   * The alert offers a shorter period. Turn it off where a button cannot be
   * reached, such as inside a menu. The text still names it.
   */
  offerShorterPeriod?: boolean;
  /**
   * The alert offers to remove the task, theme and phrase filters. The API
   * applies them after it has read every answer in the period.
   */
  offerRemoveFilter?: boolean;
  /**
   * Where focus goes when the filters are removed, since the alert goes away
   * with them. `origin` is the element that had focus when the button was
   * used. The page heading by default.
   */
  focusAfterFiltersRemoved?: (origin: Element | null) => void;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * What the user can do. A device filter helps because the API applies it
 * before it counts the answers.
 */
function describeRemedy({
  canShortenPeriod,
  filters,
  hasDeviceFilter,
}: {
  canShortenPeriod: boolean;
  filters: string | undefined;
  hasDeviceFilter: boolean;
}): string | undefined {
  if (canShortenPeriod) {
    return filters
      ? `Velg en kortere periode, eller fjern ${filters}.`
      : "Velg en kortere periode.";
  }
  if (filters) return `Fjern ${filters}.`;
  return hasDeviceFilter ? undefined : "Et filter på enhet kan hjelpe.";
}

/**
 * Shown when the API refuses a period that has too many answers for an
 * analysis. A new attempt gets the same answer, and the alert has no retry.
 * With tabIndex -1 it can take focus, and screen readers then read all of it.
 */
export function AnalysisBudgetAlert({
  description,
  offerShorterPeriod = true,
  offerRemoveFilter = false,
  focusAfterFiltersRemoved = focusPageHeading,
  className,
  ref,
}: AnalysisBudgetAlertProps) {
  const { params, setParams } = useSearchParams();
  const today = useOsloToday();
  const answerSpan = useAnswerSpan();
  const period = shorterPeriod(params, today, answerSpan);
  const filters = offerRemoveFilter ? inMemoryFilters(params) : [];
  const filterNames = filters.length > 0 ? nameFilters(filters) : undefined;
  const remedy = describeRemedy({
    canShortenPeriod: Boolean(period),
    filters: filterNames,
    hasDeviceFilter: Boolean(params.deviceType),
  });
  const periodButton =
    offerShorterPeriod && period ? (
      <ShorterPeriodButton period={period} />
    ) : null;

  const removeFilters = async () => {
    const origin = document.activeElement;
    await setParams({
      task: undefined,
      theme: undefined,
      phrase: undefined,
      page: "1",
    });
    window.requestAnimationFrame(() => focusAfterFiltersRemoved(origin));
  };

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="warning"
      role="alert"
      className={className}
    >
      <VStack gap="space-8" align="start">
        <BodyShort weight="semibold">{ANALYSIS_BUDGET_TITLE}</BodyShort>
        <BodyShort size="small">
          {remedy ? `${description} ${remedy}` : description}
        </BodyShort>
        {periodButton || filterNames ? (
          <HStack gap="space-8">
            {periodButton}
            {filterNames ? (
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => void removeFilters()}
              >
                Fjern {filterNames}
              </Button>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
    </Alert>
  );
}
