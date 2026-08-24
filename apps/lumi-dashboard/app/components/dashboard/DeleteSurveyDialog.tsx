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
        heading: "Slett svar og fjern surveyen",
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
                svar og dashboarddata kan slettes.
              </>
            ) : hasNoAnswers ? (
              <>
                Surveyen <strong>"{surveyId}"</strong> har ingen lagrede svar.
                Du kan fortsatt fjerne surveyen fra dashboardet.
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
              ? "Denne handlingen kan ikke angres. Eventuelle markører og dashboardmetadata for surveyen slettes permanent. Den registrerte surveydefinisjonen beholdes. Survey-ID-en forblir knyttet til definisjonen, og en inkompatibel struktur krever en ny survey-ID. Sletting stopper ikke nye innsendinger. Fjern widgeten fra frontend-koden for å stoppe datainnsamlingen."
              : "Denne handlingen kan ikke angres. Alle svar, eventuelle markører og dashboardmetadata for surveyen slettes permanent. Den registrerte surveydefinisjonen beholdes. Survey-ID-en forblir knyttet til definisjonen, og en inkompatibel struktur krever en ny survey-ID. Sletting stopper ikke nye innsendinger. Fjern widgeten fra frontend-koden for å stoppe datainnsamlingen."}
          </BodyLong>

          <ConfirmationPanel
            checked={confirmed}
            onChange={() => setConfirmed(!confirmed)}
            label={
              totalCountUnavailable
                ? "Antall svar må lastes før sletting"
                : hasNoAnswers
                  ? "Ja, fjern surveyen fra dashboardet"
                  : `Ja, slett permanent alle ${totalCount} svar`
            }
            disabled={totalCountUnavailable}
          />

          {deleteMutation.isError && (
            <Alert variant="error">
              Kunne ikke slette svar og fjerne surveyen fra dashboardet. Prøv
              igjen senere.
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
                ? "Fjern fra dashboardet"
                : `Slett ${totalCount} svar permanent`}
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
