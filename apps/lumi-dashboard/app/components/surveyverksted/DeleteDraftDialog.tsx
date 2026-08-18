import { TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyLong,
  Button,
  HStack,
  Modal,
  VStack,
} from "@navikt/ds-react";
import { useEffect, useRef } from "react";

export interface DeleteDraftDialogProps {
  /** Name of the draft up for deletion, or null when the dialog is closed. */
  name: string | null;
  isPending: boolean;
  showError: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation for deleting a team draft. While the deletion is in flight
 * the dialog refuses to close (Escape and the close button included) so a
 * failure can never strand the user without the error and its retry.
 */
export function DeleteDraftDialog({
  name,
  isPending,
  showError,
  onConfirm,
  onClose,
}: DeleteDraftDialogProps) {
  // isPending arrives one render AFTER the confirm click — the flag closes
  // the same-frame window where Escape could still slip past the guard.
  const confirmInFlightRef = useRef(false);
  useEffect(() => {
    if (showError || name === null) {
      confirmInFlightRef.current = false;
    }
  }, [showError, name]);
  return (
    <Modal
      open={name !== null}
      onBeforeClose={() => !(isPending || confirmInFlightRef.current)}
      onClose={onClose}
      header={{ heading: "Slett utkastet?", icon: <TrashIcon aria-hidden /> }}
      width="small"
    >
      <Modal.Body>
        <VStack gap="space-12">
          <BodyLong>
            «{name}» slettes for hele teamet, sammen med alle delte versjoner i
            prosjektet. Surveys som allerede er tatt inn i kode påvirkes ikke.
          </BodyLong>
          {showError ? (
            <Alert variant="error">
              Utkastet kunne ikke slettes. Prøv igjen.
            </Alert>
          ) : null}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-12" justify="end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            data-color="danger"
            variant="primary"
            loading={isPending}
            onClick={() => {
              confirmInFlightRef.current = true;
              onConfirm();
            }}
          >
            Slett utkastet
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
