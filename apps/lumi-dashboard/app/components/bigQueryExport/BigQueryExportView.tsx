import {
  Alert,
  BodyLong,
  BodyShort,
  Box,
  Button,
  ExpansionCard,
  Heading,
  HGrid,
  HStack,
  Link,
  List,
  Loader,
  VStack,
} from "@navikt/ds-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getBigQueryExport,
  runBigQueryExport,
} from "~/server/actions/bigQueryExport";
import {
  type BigQueryExportStatus,
  type BigQueryExportStop,
  DEFAULT_DATASET_ID,
} from "~/types/bigQueryExport";
import { writeErrorText } from "~/utils/publicDemo";
import { DestinationForm } from "./DestinationForm";
import { BIGQUERY_GUIDE_URL } from "./format";
import { NextSteps } from "./NextSteps";
import { StatusPanel } from "./StatusPanel";
import { StopExportDialog } from "./StopExportDialog";

const POLL_WHILE_BUSY_MS = 3_000;

export const bigQueryExportQueryKey = (team: string) =>
  ["bigquery-export", team] as const;

function isBusy(status: BigQueryExportStatus | undefined): boolean {
  const state = status?.destination?.runState;
  return state === "RUNNING" || state === "QUEUED";
}

export function BigQueryExportView({ team }: { team: string }) {
  const [stopped, setStopped] = useState<BigQueryExportStop | null>(null);
  const query = useQuery({
    queryKey: bigQueryExportQueryKey(team),
    queryFn: () => getBigQueryExport({ data: { team } }),
    refetchInterval: (current) =>
      isBusy(current.state.data) ? POLL_WHILE_BUSY_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  if (query.isPending)
    return (
      <HStack gap="space-12" align="center">
        <Loader size="medium" title="Henter BigQuery-eksporten" />
        <BodyShort>Henter BigQuery-eksporten …</BodyShort>
      </HStack>
    );
  if (query.isError)
    return (
      <Alert variant="error">
        <VStack gap="space-8" align="start">
          Lumi fikk ikke hentet BigQuery-eksporten for teamet.
          <Button
            type="button"
            size="small"
            variant="tertiary"
            onClick={() => void query.refetch()}
          >
            Prøv igjen
          </Button>
        </VStack>
      </Alert>
    );

  const status = query.data;
  const stoppedNotice = stopped && (
    <Alert
      variant={stopped.tablesRemoved ? "success" : "warning"}
      size="small"
      closeButton
      onClose={() => setStopped(null)}
    >
      {stopped.tablesRemoved
        ? "Eksporten er stoppet, og Lumis tabeller er slettet."
        : "Eksporten er stoppet. Lumi fikk ikke slettet alle tabellene, men de forsvinner av seg selv innen sju dager."}
    </Alert>
  );

  if (status.availability === "DISABLED")
    return (
      <Alert variant="info">
        BigQuery-eksport er ikke slått på i dette miljøet.
      </Alert>
    );

  if (status.availability === "PILOT_ONLY")
    return (
      <VStack gap="space-16">
        {stoppedNotice}
        <Alert variant="info">
          <Heading level="2" size="small" spacing>
            BigQuery-eksport er i pilot
          </Heading>
          Team eSyfo og iSyfo tester eksporten først. Skriv i{" "}
          <Link href="https://nav-it.slack.com/archives/C0AG2FKSSMD">
            #lumi på Slack
          </Link>{" "}
          hvis teamet vil være med.
        </Alert>
        {status.destination && (
          <StopOnly status={status} team={team} onStopped={setStopped} />
        )}
      </VStack>
    );

  if (!status.destination)
    return (
      <VStack gap="space-24">
        {stoppedNotice}
        <Introduction />
        <DestinationForm
          key={`setup:${team}`}
          team={team}
          status={status}
          mode="setup"
          initial={{
            projectId: status.suggestedProjectId ?? "",
            datasetId: DEFAULT_DATASET_ID,
            includeFreeText: false,
          }}
        />
      </VStack>
    );

  return (
    <ActiveExport
      key={`active:${team}`}
      team={team}
      status={status}
      destination={status.destination}
      onStopped={setStopped}
    />
  );
}

function Introduction() {
  return (
    <HGrid columns={{ xs: 1, md: 2 }} gap="space-16">
      <Box
        background="raised"
        borderWidth="1"
        borderColor="neutral-subtle"
        borderRadius="8"
        padding="space-20"
      >
        <Heading level="2" size="small" spacing>
          Slik fungerer det
        </Heading>
        <List as="ul" size="small">
          <List.Item>
            Teamet lager et datasett i sitt eget GCP-prosjekt og gir Lumi
            skrivetilgang til det.
          </List.Item>
          <List.Item>
            Lumi erstatter tabellene hver natt kl. 01 og når du velger Oppdater
            nå. Slettede svar forsvinner da også fra BigQuery.
          </List.Item>
          <List.Item>
            Tabellene forsvinner av seg selv sju dager etter siste oppdatering.
          </List.Item>
        </List>
      </Box>
      <Box
        background="raised"
        borderWidth="1"
        borderColor="neutral-subtle"
        borderRadius="8"
        padding="space-20"
      >
        <Heading level="2" size="small" spacing>
          Teamets ansvar
        </Heading>
        <BodyLong size="small" spacing>
          Kopien er teamets. Teamet bestemmer hvem som får tilgang på
          Datamarkedsplassen, og må beskrive delingen i behandlingen i
          Behandlingskatalogen.
        </BodyLong>
        <Link href={BIGQUERY_GUIDE_URL} target="_blank" rel="noreferrer">
          Les guiden før dere starter
        </Link>
      </Box>
    </HGrid>
  );
}

function ActiveExport({
  team,
  status,
  destination,
  onStopped,
}: {
  team: string;
  status: BigQueryExportStatus;
  destination: NonNullable<BigQueryExportStatus["destination"]>;
  onStopped: (result: BigQueryExportStop) => void;
}) {
  const queryClient = useQueryClient();
  const [stopOpen, setStopOpen] = useState(false);
  const run = useMutation({
    mutationFn: () => runBigQueryExport({ data: { team } }),
    retry: false,
    onSuccess: (result) => {
      if (result.ok)
        queryClient.setQueryData(bigQueryExportQueryKey(team), result.value);
    },
  });
  const runMessage = run.isError ? (
    <Alert variant="error" size="small">
      {writeErrorText(
        run.error,
        "Lumi fikk ikke startet en ny kjøring. Prøv igjen.",
      )}
    </Alert>
  ) : run.data && !run.data.ok ? (
    <Alert variant="error" size="small">
      {run.data.reason === "limit"
        ? "Du har bedt om mange kjøringer på kort tid. Vent et minutt og prøv igjen."
        : "Lumi fikk ikke startet en ny kjøring. Last siden på nytt."}
    </Alert>
  ) : null;

  return (
    <VStack gap="space-32">
      <StatusPanel
        team={team}
        status={status}
        destination={destination}
        onRun={() => run.mutate()}
        runPending={run.isPending}
        runMessage={runMessage}
      />
      <NextSteps team={team} />
      <Tables includeFreeText={destination.includeFreeText} />
      <ExpansionCard
        aria-label="Innstillinger for BigQuery-eksporten"
        size="small"
      >
        <ExpansionCard.Header>
          <ExpansionCard.Title as="h2" size="small">
            Innstillinger
          </ExpansionCard.Title>
          <ExpansionCard.Description>
            Bytt datasett eller ta med fritekst.
          </ExpansionCard.Description>
        </ExpansionCard.Header>
        <ExpansionCard.Content>
          <DestinationForm
            key={`${destination.projectId}.${destination.datasetId}.${destination.includeFreeText}`}
            team={team}
            status={status}
            mode="edit"
            initial={{
              projectId: destination.projectId,
              datasetId: destination.datasetId,
              includeFreeText: destination.includeFreeText,
            }}
          />
        </ExpansionCard.Content>
      </ExpansionCard>
      <div>
        <Button
          type="button"
          variant="tertiary"
          data-color="danger"
          size="small"
          onClick={() => setStopOpen(true)}
        >
          Stopp eksporten
        </Button>
      </div>
      <StopExportDialog
        team={team}
        datasetName={`${destination.projectId}.${destination.datasetId}`}
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        onStopped={(result) => {
          setStopOpen(false);
          onStopped(result);
        }}
      />
    </VStack>
  );
}

function Tables({ includeFreeText }: { includeFreeText: boolean }) {
  return (
    <VStack gap="space-8">
      <Heading level="2" size="medium">
        Tabellene
      </Heading>
      <List as="ul" size="small">
        <List.Item title="svar">
          Én rad per svar på vurderings- og valgspørsmål, med spørsmålstekst og
          svartekst. Flervalg gir én rad per valgt alternativ.
        </List.Item>
        <List.Item title="innsendinger">
          Én rad per innsending. Bruk den til å telle svar og som nevner.
        </List.Item>
        <List.Item title="fritekst">
          {includeFreeText
            ? "Fritekstsvar med kjente mønstre for personopplysninger maskert."
            : "Ikke med. Slå det på under Innstillinger hvis teamet trenger fritekst."}
        </List.Item>
      </List>
      <Link
        href={`${BIGQUERY_GUIDE_URL}#kolonner`}
        target="_blank"
        rel="noreferrer"
      >
        Se alle kolonnene
      </Link>
    </VStack>
  );
}

function StopOnly({
  team,
  status,
  onStopped,
}: {
  team: string;
  status: BigQueryExportStatus;
  onStopped: (result: BigQueryExportStop) => void;
}) {
  const [open, setOpen] = useState(false);
  const destination = status.destination;
  if (!destination) return null;
  const datasetName = `${destination.projectId}.${destination.datasetId}`;
  return (
    <VStack gap="space-8" align="start">
      <BodyShort>
        Teamet har fortsatt en eksport til <code>{datasetName}</code>, men Lumi
        oppdaterer den ikke lenger.
      </BodyShort>
      <Button
        type="button"
        variant="secondary"
        data-color="danger"
        size="small"
        onClick={() => setOpen(true)}
      >
        Stopp eksporten
      </Button>
      <StopExportDialog
        team={team}
        datasetName={datasetName}
        open={open}
        onClose={() => setOpen(false)}
        onStopped={(result) => {
          setOpen(false);
          onStopped(result);
        }}
      />
    </VStack>
  );
}
