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
import { useState } from "react";
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
  const { data: totalCount, isLoading: isLoadingTotal } = useSurveyTotalCount(
    surveyId,
    isOpen,
  );

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(surveyId);
      setConfirmed(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      // Error is handled by mutation state
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  // Check if user is viewing a filtered subset
  const actualTotal = totalCount ?? filteredCount;
  const isFiltered = actualTotal !== filteredCount;

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
          <Alert variant="warning">
            {isLoadingTotal ? (
              <Skeleton width="100%" height="24px" />
            ) : (
              <>
                Du er i ferd med å{" "}
                <strong>permanent slette alle {actualTotal} svar</strong> for
                survey <strong>"{surveyId}"</strong>.
                {isFiltered && (
                  <>
                    {" "}
                    Du ser nå {filteredCount} av {actualTotal} svar pga.
                    filtrering, men{" "}
                    <strong>alle {actualTotal} svar vil bli slettet</strong>.
                  </>
                )}
              </>
            )}
          </Alert>

          <BodyLong>
            Denne handlingen kan ikke angres. All data for denne surveyen vil
            bli permanent fjernet fra databasen.
          </BodyLong>

          <ConfirmationPanel
            checked={confirmed}
            onChange={() => setConfirmed(!confirmed)}
            label={`Ja, slett permanent alle ${actualTotal} svar`}
            disabled={isLoadingTotal}
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
            variant="danger"
            onClick={handleDelete}
            disabled={!confirmed || isLoadingTotal}
            loading={deleteMutation.isPending}
          >
            Slett {actualTotal} svar permanent
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
