import { ArchiveIcon } from "@navikt/aksel-icons";
import {
  BodyLong,
  Button,
  HStack,
  InlineMessage,
  Modal,
  VStack,
} from "@navikt/ds-react";
import { useArchiveSurvey } from "~/hooks/useArchiveSurvey";

interface ArchiveSurveyDialogProps {
  surveyId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Confirmation dialog for archiving a survey. Deliberately explicit about
 * what archiving does NOT do: submissions continue until the consuming
 * app removes the widget from its frontend.
 */
export function ArchiveSurveyDialog({
  surveyId,
  isOpen,
  onClose,
}: ArchiveSurveyDialogProps) {
  const { archiveMutation } = useArchiveSurvey(surveyId);

  const handleClose = () => {
    archiveMutation.reset();
    onClose();
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(surveyId);
      handleClose();
    } catch (_error) {
      // Error is handled by mutation state
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      header={{
        heading: "Arkiver survey",
        icon: <ArchiveIcon aria-hidden />,
      }}
      width="small"
    >
      <Modal.Body>
        <VStack gap="space-16">
          <BodyLong>
            Arkivering skjuler <strong>{surveyId}</strong> i dashboardet for
            hele teamet. Den stopper ikke innsendinger — fjern surveyen fra
            frontend-koden for å stoppe datainnsamling.
          </BodyLong>

          <BodyLong>
            Ingen data slettes. Du finner surveyen igjen ved å slå på
            «Arkiverte» i filterlinjen.
          </BodyLong>

          {archiveMutation.isError && (
            <InlineMessage status="error">
              Kunne ikke arkivere survey. Prøv igjen senere.
            </InlineMessage>
          )}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-8" justify="end">
          <Button variant="secondary" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleArchive}
            loading={archiveMutation.isPending}
          >
            Arkiver survey
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
