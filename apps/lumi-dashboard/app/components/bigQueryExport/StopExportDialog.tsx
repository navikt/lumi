import { TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyLong,
  Button,
  ConfirmationPanel,
  HStack,
  Modal,
  VStack,
} from "@navikt/ds-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { stopBigQueryExport } from "~/server/actions/bigQueryExport";
import type { BigQueryExportStop } from "~/types/bigQueryExport";
import { writeErrorText } from "~/utils/publicDemo";
import { bigQueryExportQueryKey } from "./queryKey";

export function StopExportDialog({
  team,
  datasetName,
  open,
  onClose,
  onStopped,
}: {
  team: string;
  datasetName: string;
  open: boolean;
  onClose: () => void;
  onStopped: (result: BigQueryExportStop) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const stop = useMutation({
    mutationFn: () => stopBigQueryExport({ data: { team } }),
    retry: false,
    onSuccess: async (result) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({
        queryKey: bigQueryExportQueryKey(team),
      });
      setConfirmed(false);
      onStopped(result.value);
    },
  });
  const close = () => {
    if (stop.isPending) return;
    setConfirmed(false);
    stop.reset();
    onClose();
  };
  const failure =
    stop.data && !stop.data.ok
      ? stop.data.reason === "not-configured"
        ? "Eksporten er allerede stoppet."
        : "Lumi fikk ikke stoppet eksporten. Prøv igjen."
      : null;

  return (
    <Modal
      open={open}
      onClose={close}
      onBeforeClose={() => !stop.isPending}
      header={{
        heading: "Stopp BigQuery-eksporten",
        icon: <TrashIcon aria-hidden />,
      }}
      width="small"
    >
      <Modal.Body>
        <VStack gap="space-16">
          <BodyLong>
            Lumi slutter å oppdatere tabellene og sletter svar, innsendinger og
            fritekst fra <code>{datasetName}</code>. Datasettet, andre tabeller
            og kopier teamet har laget, blir stående.
          </BodyLong>
          <BodyLong>
            Dataprodukter, Metabase-spørsmål og datafortellinger som bruker
            tabellene, slutter å virke.
          </BodyLong>
          <ConfirmationPanel
            checked={confirmed}
            onChange={() => setConfirmed((value) => !value)}
            label="Ja, stopp eksporten og slett Lumis tabeller"
          />
          {stop.isError && (
            <Alert variant="error" size="small" role="alert">
              {writeErrorText(
                stop.error,
                "Lumi fikk ikke stoppet eksporten. Prøv igjen.",
              )}
            </Alert>
          )}
          {failure && (
            <Alert variant="error" size="small" role="alert">
              {failure}
            </Alert>
          )}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack gap="space-8" justify="end">
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            disabled={stop.isPending}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            data-color="danger"
            variant="primary"
            onClick={() => stop.mutate()}
            disabled={!confirmed}
            loading={stop.isPending}
          >
            Stopp eksporten
          </Button>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
