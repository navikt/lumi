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
  mergeRedactionRanges,
  redactTextPreview,
  storedTextSelection,
  type TextRedactionRange,
  textRedactionHash,
} from "~/utils/textRedaction";

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
  const [ranges, setRanges] = useState<TextRedactionRange[]>([]);
  const [selection, setSelection] = useState<TextRedactionRange | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busy = preparing || mutation.isPending || refreshing;
  const preview = redactTextPreview(target.text, ranges);
  const conflict =
    mutation.error instanceof ApiErrorException &&
    mutation.error.error.status === 409;
  const missing =
    mutation.error instanceof ApiErrorException &&
    mutation.error.error.status === 404;

  const addSelection = () => {
    if (!selection) return;
    try {
      setRanges(mergeRedactionRanges(target.text, [...ranges, selection]));
      setSelectionError(null);
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : "Markeringen kunne ikke brukes.",
      );
    }
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
    if (busy || mutation.isError || preview === target.text) return;
    setPreparing(true);
    try {
      let expectedTextHash: string;
      try {
        expectedTextHash = await textRedactionHash(target.text);
      } catch {
        setSelectionError(
          "Maskeringen kunne ikke klargjøres. Last siden på nytt og prøv igjen.",
        );
        return;
      }
      await mutation.mutateAsync({
        id: target.id,
        team: target.team,
        fieldId: target.fieldId,
        expectedTextHash,
        ranges,
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
            description="Marker med musen, berøring eller Shift og venstre/høyre piltast. Legg deretter til markeringen."
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
              setSelection(storedTextSelection(target.text, from, to));
            }}
            onSelect={(event) => {
              const { selectionStart: start, selectionEnd: end } =
                event.currentTarget;
              setSelection(storedTextSelection(target.text, start, end));
            }}
          />
          <HStack gap="space-8" wrap>
            <Button
              size="small"
              variant="secondary"
              onClick={addSelection}
              disabled={!selection || busy || mutation.isError}
            >
              Legg til markering
            </Button>
            <Button
              size="small"
              variant="tertiary"
              onClick={() => {
                setRanges([]);
                setSelectionError(null);
              }}
              disabled={ranges.length === 0 || busy || mutation.isError}
            >
              Nullstill markeringer
            </Button>
          </HStack>
          {selectionError && (
            <ErrorMessage role="alert">{selectionError}</ErrorMessage>
          )}
          <Textarea
            label="Slik blir svaret"
            value={preview.replace(/\r\n?/g, "\n")}
            readOnly
            minRows={3}
            maxRows={8}
          />
          <BodyLong>
            Maskeringen lagres permanent og kan ikke angres. Resten av svaret
            beholdes. Kopier dere allerede har lastet ned, må dere rydde opp i
            selv. BigQuery oppdateres ved neste vellykkede kjøring.
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
              disabled={busy || preview === target.text}
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
