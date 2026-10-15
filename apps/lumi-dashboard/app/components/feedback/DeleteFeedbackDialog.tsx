import { TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyLong,
  Button,
  HStack,
  Modal,
  VStack,
} from "@navikt/ds-react";

interface DeleteFeedbackDialogProps {
  id: string | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  errorText?: string | null;
}

export function DeleteFeedbackDialog({
  id,
  onClose,
  onConfirm,
  isPending,
  errorText = null,
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
        <VStack gap="space-16">
          <BodyLong>
            Er du sikker på at du vil slette denne tilbakemeldingen? Handlingen
            kan ikke angres.
          </BodyLong>
          {errorText ? (
            <Alert variant="error" size="small">
              {errorText}
            </Alert>
          ) : null}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-12" justify="end">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Avbryt
          </Button>
          <Button
            data-color="danger"
            variant="primary"
            onClick={onConfirm}
            loading={isPending}
          >
            Slett
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
