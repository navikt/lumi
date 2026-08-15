import { TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyLong,
  Button,
  ConfirmationPanel,
  HStack,
  Modal,
  Skeleton,
  VStack,
} from "@navikt/ds-react";
import { useEffect, useState } from "react";
import { useDeleteSurvey } from "~/hooks/useDeleteSurvey";
import { useSurveyTotalCount } from "~/hooks/useSurveyTotalCount";

interface DeleteSurveyDialogProps {
  surveyId: string;
  /** Count currently shown (with filters applied) - used to show user if they're viewing a subset */
  filteredCount: number;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteSurveyDialog({
  surveyId,
  filteredCount,
  isOpen,
  onClose,
  onDeleted,
}: DeleteSurveyDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const deleteMutation = useDeleteSurvey();

  // Fetch actual total count for this survey (ignoring other filters)
  const {
    data: totalCount,
    isLoading: isLoadingTotal,
    isFetching: isFetchingTotal,
    isError: isTotalCountError,
  } = useSurveyTotalCount(surveyId, isOpen);
  const isRefreshingTotal = isLoadingTotal || isFetchingTotal;
  const totalCountUnavailable =
    isRefreshingTotal || isTotalCountError || totalCount === undefined;
  const hasNoAnswers = totalCount === 0;

  useEffect(() => {
    if (isFetchingTotal) setConfirmed(false);
  }, [isFetchingTotal]);

  const handleDelete = async () => {
    if (totalCountUnavailable) return;

    try {
      await deleteMutation.mutateAsync(surveyId);
      setConfirmed(false);
      onClose();
      onDeleted?.();
    } catch (_error) {
      // Error is handled by mutation state
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  // Check if user is viewing a filtered subset
  const isFiltered = totalCount !== undefined && totalCount !== filteredCount;

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      header={{
        heading: "Slett hele surveyen",
        icon: <TrashIcon aria-hidden />,
      }}
      width="small"
    >
      <Modal.Body>
        <VStack gap="space-16">
          <Alert variant={isTotalCountError ? "error" : "warning"}>
            {isRefreshingTotal ? (
              <Skeleton width="100%" height="24px" />
            ) : isTotalCountError || totalCount === undefined ? (
              <>
                Kunne ikke hente totalt antall svar. Last antallet på nytt før
                surveyen kan slettes.
              </>
            ) : hasNoAnswers ? (
              <>
                Surveyen <strong>"{surveyId}"</strong> har ingen lagrede svar.
                Du kan fortsatt slette surveyen permanent fra dashboardet.
              </>
            ) : (
              <>
                Du er i ferd med å{" "}
                <strong>permanent slette alle {totalCount} svar</strong> for
                survey <strong>"{surveyId}"</strong>.
                {isFiltered && (
                  <>
                    {" "}
                    Du ser nå {filteredCount} av {totalCount} svar pga.
                    filtrering, men{" "}
                    <strong>alle {totalCount} svar vil bli slettet</strong>.
                  </>
                )}
              </>
            )}
          </Alert>

          <BodyLong>
            {hasNoAnswers
              ? "Denne handlingen kan ikke angres. Surveyen og eventuelle markører vil bli permanent fjernet fra dashboardet."
              : "Denne handlingen kan ikke angres. All data for denne surveyen vil bli permanent fjernet fra databasen."}
          </BodyLong>

          <ConfirmationPanel
            checked={confirmed}
            onChange={() => setConfirmed(!confirmed)}
            label={
              totalCountUnavailable
                ? "Antall svar må lastes før sletting"
                : hasNoAnswers
                  ? "Ja, slett surveyen permanent"
                  : `Ja, slett permanent alle ${totalCount} svar`
            }
            disabled={totalCountUnavailable}
          />

          {deleteMutation.isError && (
            <Alert variant="error">
              Kunne ikke slette survey. Prøv igjen senere.
            </Alert>
          )}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-8" justify="end">
          <Button variant="secondary" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            data-color="danger"
            variant="primary"
            onClick={handleDelete}
            disabled={!confirmed || totalCountUnavailable}
            loading={deleteMutation.isPending}
          >
            {totalCountUnavailable
              ? "Slett svar permanent"
              : hasNoAnswers
                ? "Slett survey permanent"
                : `Slett ${totalCount} svar permanent`}
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
