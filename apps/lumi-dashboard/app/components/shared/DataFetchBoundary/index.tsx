import { ArrowCirclepathIcon } from "@navikt/aksel-icons";
import { Alert, BodyShort, Button, VStack } from "@navikt/ds-react";
import { type ReactNode, useState } from "react";
import styles from "./DataFetchBoundary.module.css";

interface RefetchableQuery {
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

interface DataFetchBoundaryProps {
  children?: ReactNode;
  description?: ReactNode;
  queries: RefetchableQuery[];
  title: string;
}

/**
 * Prevents failed queries from being mistaken for valid empty data.
 * Only failed queries are retried, so unrelated successful requests stay cached.
 */
export function DataFetchBoundary({
  children,
  description = "Vi viser ikke data før forespørselen lykkes, fordi et tomt resultat kan være misvisende.",
  queries,
  title,
}: DataFetchBoundaryProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [recoveryAnnouncement, setRecoveryAnnouncement] = useState("");
  const failedQueries = queries.filter((query) => query.isError);

  const retryFailedQueries = async () => {
    setRecoveryAnnouncement("");
    setIsRetrying(true);

    try {
      const results = await Promise.all(
        failedQueries.map((query) => query.refetch()),
      );
      const recovered = results.every((result) => {
        if (!result || typeof result !== "object" || !("isError" in result)) {
          return true;
        }
        return result.isError === false;
      });

      if (recovered) {
        setRecoveryAnnouncement("Dataene er lastet inn.");
      }
    } catch {
      // The query owns the error state; keep the same retryable alert visible.
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

  const isFetching =
    isRetrying || failedQueries.some((query) => query.isFetching);

  return (
    <>
      {recoveryStatus}
      <Alert variant="error" role="alert">
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
