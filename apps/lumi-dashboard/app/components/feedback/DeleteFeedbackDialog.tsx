import { TrashIcon } from "@navikt/aksel-icons";
import { BodyLong, Button, HStack, Modal } from "@navikt/ds-react";

interface DeleteFeedbackDialogProps {
  id: string | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteFeedbackDialog({
  id,
  onClose,
  onConfirm,
  isPending,
}: DeleteFeedbackDialogProps) {
  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      header={{
        heading: "Slett tilbakemelding",
        icon: <TrashIcon aria-hidden />,
      }}
    >
      <Modal.Body>
        <BodyLong>
          Er du sikker på at du vil slette denne tilbakemeldingen? Handlingen
          kan ikke angres.
        </BodyLong>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-12" justify="end">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Avbryt
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={isPending}>
            Slett
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
