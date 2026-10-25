import { ArrowCirclepathIcon } from "@navikt/aksel-icons";
import { Alert, BodyShort, Button, VStack } from "@navikt/ds-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AnalysisBudgetAlert } from "~/components/shared/AnalysisBudgetAlert";
import {
  describeAnalysisBudget,
  isAnalysisBudgetError,
} from "~/utils/analysisBudget";
import { focusIsLost } from "~/utils/focus";
import styles from "./DataFetchBoundary.module.css";

interface RefetchableQuery {
  error: unknown;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

interface DataFetchBoundaryProps {
  children?: ReactNode;
  description?: ReactNode;
  /**
   * Shown when the API refuses the period because an analysis would read
   * too many answers. Name what cannot be computed.
   */
  analysisBudgetDescription?: string;
  /**
   * The alert offers a shorter period. Turn it off where a button cannot be
   * reached, such as inside a menu.
   */
  offerShorterPeriod?: boolean;
  /**
   * The alert offers to remove the task, theme and phrase filters, for lists
   * the API filters after reading every answer in the period.
   */
  offerRemoveFilter?: boolean;
  queries: RefetchableQuery[];
  title: string;
}

/** The error in a refetch result, if it has one. */
function resultError(result: unknown): unknown {
  return result && typeof result === "object" && "error" in result
    ? result.error
    : undefined;
}

/**
 * Prevents failed queries from being mistaken for valid empty data.
 * Only failed queries are retried, so unrelated successful requests stay cached.
 */
export function DataFetchBoundary({
  children,
  description = "Vi viser ikke data før forespørselen lykkes, fordi et tomt resultat kan være misvisende.",
  analysisBudgetDescription = describeAnalysisBudget("Analysen"),
  offerShorterPeriod = true,
  offerRemoveFilter = false,
  queries,
  title,
}: DataFetchBoundaryProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [recoveryAnnouncement, setRecoveryAnnouncement] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);
  const focusBudgetAlert = useRef(false);
  const failedQueries = queries.filter((query) => query.isError);
  // The budget alert has no retry button. A query that failed for another
  // reason keeps the retry.
  const showBudgetAlert =
    !isRetrying &&
    failedQueries.length > 0 &&
    failedQueries.every((query) => isAnalysisBudgetError(query.error));

  // A retry that ends in the budget replaces the retry button with the
  // budget alert, and the focus is lost. The query result can reach this
  // component after isRetrying is reset. This effect therefore follows the
  // alert itself.
  useEffect(() => {
    if (!showBudgetAlert || !focusBudgetAlert.current) return;
    focusBudgetAlert.current = false;
    if (focusIsLost()) alertRef.current?.focus();
  }, [showBudgetAlert]);

  const retryFailedQueries = async () => {
    focusBudgetAlert.current =
      alertRef.current?.contains(document.activeElement) ?? false;
    setRecoveryAnnouncement("");
    setIsRetrying(true);

    try {
      const results = await Promise.all(
        failedQueries.map((query) => query.refetch()),
      );
      // Only a retry that ends in the budget moves focus to its alert.
      if (
        !results.some((result) => isAnalysisBudgetError(resultError(result)))
      ) {
        focusBudgetAlert.current = false;
      }
      const recovered = results.every((result) => {
        if (!result || typeof result !== "object" || !("isError" in result)) {
          return true;
        }
        return result.isError === false;
      });

      if (recovered) setRecoveryAnnouncement("Dataene er lastet inn.");
    } catch {
      // The query owns the error state; keep the same retryable alert visible.
      focusBudgetAlert.current = false;
      setRecoveryAnnouncement("");
    } finally {
      setIsRetrying(false);
    }
  };

  const recoveryStatus =
    recoveryAnnouncement && failedQueries.length === 0 && !isRetrying ? (
      <span role="status" aria-live="polite" className={styles.srOnly}>
        {recoveryAnnouncement}
      </span>
    ) : null;

  if (failedQueries.length === 0 && !isRetrying) {
    return (
      <>
        {recoveryStatus}
        {children}
      </>
    );
  }

  if (showBudgetAlert) {
    return (
      <AnalysisBudgetAlert
        ref={alertRef}
        description={analysisBudgetDescription}
        offerShorterPeriod={offerShorterPeriod}
        offerRemoveFilter={offerRemoveFilter}
      />
    );
  }

  const isFetching =
    isRetrying || failedQueries.some((query) => query.isFetching);

  return (
    <>
      {recoveryStatus}
      <Alert ref={alertRef} variant="error" role="alert">
        <VStack gap="space-8" align="start">
          <BodyShort weight="semibold">{title}</BodyShort>
          <BodyShort size="small">{description}</BodyShort>
          <Button
            type="button"
            variant="tertiary"
            size="small"
            icon={<ArrowCirclepathIcon aria-hidden />}
            loading={isFetching}
            onClick={() => void retryFailedQueries()}
          >
            Prøv igjen
          </Button>
        </VStack>
      </Alert>
    </>
  );
}
