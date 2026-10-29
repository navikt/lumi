import { EyeSlashIcon } from "@navikt/aksel-icons";
import {
  BodyLong,
  BodyShort,
  Button,
  ErrorMessage,
  HStack,
  Modal,
  Textarea,
  VStack,
} from "@navikt/ds-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  resetRedactedFeedbackQueries,
  useRedactFeedback,
} from "~/hooks/useRedactFeedback";
import { ApiErrorException } from "~/types/errors";
import { writeErrorText } from "~/utils/publicDemo";
import {
  redactTextPreview,
  storedTextSelection,
  type TextRedactionRange,
  textRedactionHash,
} from "~/utils/textRedaction";
import styles from "./FeedbackTable/styles.module.css";

export interface TextRedactionTarget {
  id: string;
  team: string;
  fieldId: string;
  question: string;
  text: string;
}

export function MaskTextDialog({
  target,
  onClose,
  onMasked,
  onRefreshed,
}: {
  target: TextRedactionTarget;
  onClose: () => void;
  onMasked: () => void;
  onRefreshed: () => void;
}) {
  const mutation = useRedactFeedback();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<TextRedactionRange | null>(null);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busy = preparing || mutation.isPending || refreshing;
  let preview = target.text;
  let selectionError = preparationError;
  if (selection) {
    try {
      preview = redactTextPreview(target.text, [selection]);
    } catch (error) {
      selectionError =
        error instanceof Error
          ? error.message
          : "Markeringen kunne ikke brukes.";
    }
  }
  const conflict =
    mutation.error instanceof ApiErrorException &&
    mutation.error.error.status === 409;
  const missing =
    mutation.error instanceof ApiErrorException &&
    mutation.error.error.status === 404;

  const updateSelection = (start: number, end: number) => {
    if (busy || mutation.isError) return;
    setSelection(storedTextSelection(target.text, start, end));
    setPreparationError(null);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await resetRedactedFeedbackQueries(queryClient);
    onRefreshed();
  };
  const close = () => {
    if (mutation.isError) void refresh();
    else onClose();
  };

  const confirm = async () => {
    if (
      busy ||
      mutation.isError ||
      !selection ||
      selectionError ||
      preview === target.text
    )
      return;
    setPreparing(true);
    try {
      let expectedTextHash: string;
      try {
        expectedTextHash = await textRedactionHash(target.text);
      } catch {
        setPreparationError(
          "Maskeringen kunne ikke klargjøres. Last siden på nytt og prøv igjen.",
        );
        return;
      }
      await mutation.mutateAsync({
        id: target.id,
        team: target.team,
        fieldId: target.fieldId,
        expectedTextHash,
        ranges: [selection],
      });
      onMasked();
    } catch {
      // The mutation error is shown below. Nothing is assumed saved on failure.
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Modal
      open
      aria-label="Masker fritekstsvar"
      onClose={close}
      onBeforeClose={() => !busy}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      header={{
        heading: "Masker fritekstsvar",
        icon: <EyeSlashIcon aria-hidden />,
        closeButton: !busy,
      }}
      width="medium"
    >
      <Modal.Body>
        <VStack gap="space-16">
          <BodyShort weight="semibold">{target.question}</BodyShort>
          <Textarea
            label="Marker teksten som skal fjernes"
            description="Marker med mus eller berøring. Med tastatur: Shift og venstre/høyre piltast."
            value={target.text.replace(/\r\n?/g, "\n")}
            readOnly
            autoFocus
            minRows={3}
            maxRows={8}
            onKeyDown={(event) => {
              // Chrome on macOS does not move selections in readonly fields.
              if (
                !["ArrowLeft", "ArrowRight"].includes(event.key) ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return;
              event.preventDefault();
              const element = event.currentTarget;
              const {
                value,
                selectionStart: start,
                selectionEnd: end,
                selectionDirection,
              } = element;
              const left = event.key === "ArrowLeft";
              const backward = selectionDirection === "backward";
              const anchor = backward ? end : start;
              const focus = backward ? start : end;
              let next = focus;
              if (!event.shiftKey && start !== end) next = left ? start : end;
              else if (left && focus > 0)
                next =
                  focus - (/[\uDC00-\uDFFF]/.test(value[focus - 1]) ? 2 : 1);
              else if (!left && focus < value.length)
                next = focus + (/[\uD800-\uDBFF]/.test(value[focus]) ? 2 : 1);
              const from = event.shiftKey ? Math.min(anchor, next) : next;
              const to = event.shiftKey ? Math.max(anchor, next) : next;
              element.setSelectionRange(
                from,
                to,
                next < anchor ? "backward" : "forward",
              );
              updateSelection(from, to);
            }}
            onSelect={(event) => {
              const { selectionStart: start, selectionEnd: end } =
                event.currentTarget;
              updateSelection(start, end);
            }}
          />
          {selectionError && (
            <ErrorMessage role="alert">{selectionError}</ErrorMessage>
          )}
          <section aria-labelledby="redaction-preview-label">
            <VStack gap="space-8">
              <BodyShort id="redaction-preview-label" weight="semibold">
                Slik blir svaret
              </BodyShort>
              <BodyLong className={styles.answerContentText}>
                {preview.replace(/\r\n?/g, "\n")}
              </BodyLong>
            </VStack>
          </section>
          <BodyLong>
            Dette kan ikke angres. Filer dere allerede har lastet ned, endres
            ikke.
          </BodyLong>
          {mutation.isError && (
            <ErrorMessage role="alert">
              {conflict
                ? "Svaret er endret siden du åpnet det. Oppdater listen og marker på nytt."
                : missing
                  ? "Svaret finnes ikke lenger. Oppdater listen."
                  : writeErrorText(
                      mutation.error,
                      "Kunne ikke bekrefte om teksten ble maskert. Oppdater listen før du prøver igjen.",
                    )}
            </ErrorMessage>
          )}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-12" justify="end" wrap>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Avbryt
          </Button>
          {mutation.isError ? (
            <Button
              loading={refreshing}
              disabled={busy}
              onClick={() => void refresh()}
            >
              Lukk og oppdater
            </Button>
          ) : (
            <Button
              data-color="danger"
              variant="primary"
              loading={busy}
              disabled={busy || !!selectionError || preview === target.text}
              onClick={() => void confirm()}
            >
              Masker permanent
            </Button>
          )}
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
