import { ArrowCirclepathIcon } from "@navikt/aksel-icons";
import { Alert, Button, Tooltip, VStack } from "@navikt/ds-react";
import { useRef } from "react";
import { useRefreshSurveyOverview } from "~/hooks/useRefreshSurveyOverview";
import styles from "./RefreshSurveyOverview.module.css";

export function RefreshSurveyOverview() {
  const refreshMutation = useRefreshSurveyOverview();
  const clickLocked = useRef(false);

  const handleRefresh = () => {
    if (clickLocked.current || refreshMutation.isPending) return;
    clickLocked.current = true;
    refreshMutation.mutate(undefined, {
      onSettled: () => {
        clickLocked.current = false;
      },
    });
  };

  return (
    <VStack gap="space-4" align="end">
      <Tooltip
        content="Oppdaterer surveyvalg og svarperioder, men ikke statistikken."
        describesChild
      >
        <Button
          type="button"
          aria-label="Oppdater surveyoversikt"
          variant="tertiary"
          size="small"
          icon={<ArrowCirclepathIcon aria-hidden />}
          loading={refreshMutation.isPending}
          onClick={handleRefresh}
        >
          Oppdater surveyoversikt
        </Button>
      </Tooltip>

      {refreshMutation.isError && (
        <Alert variant="error" size="small" role="alert">
          Kunne ikke oppdatere surveyoversikten. Prøv igjen.
        </Alert>
      )}

      {refreshMutation.isSuccess && !refreshMutation.isPending && (
        <span role="status" aria-live="polite" className={styles.srOnly}>
          Surveyoversikten er oppdatert.
        </span>
      )}
    </VStack>
  );
}
