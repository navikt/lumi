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
  List,
  Loader,
  VStack,
} from "@navikt/ds-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
import { ExternalLink } from "./ExternalLink";
import { BIGQUERY_GUIDE_URL, LUMI_SLACK_URL, RATE_LIMIT_TEXT } from "./format";
import { NextSteps } from "./NextSteps";
import { bigQueryExportQueryKey } from "./queryKey";
import { StatusPanel } from "./StatusPanel";
import { StopExportDialog } from "./StopExportDialog";
import { useFocusAfterLoading } from "./useFocusAfterLoading";

const POLL_WHILE_BUSY_MS = 3_000;
const POLL_WHILE_WAITING_MS = 15_000;

/**
 * Polls while a run is busy. A queued run that waits for the previous run's
 * cooldown is polled less often until it is about to start.
 */
function pollInterval(
  status: BigQueryExportStatus | undefined,
  now: number = Date.now(),
): number | false {
  const destination = status?.destination;
  if (destination?.runState === "RUNNING") return POLL_WHILE_BUSY_MS;
  if (destination?.runState !== "QUEUED") return false;
  const startsAt = Date.parse(destination.nextScheduledRunAt ?? "");
  return startsAt - now > 60_000 ? POLL_WHILE_WAITING_MS : POLL_WHILE_BUSY_MS;
}

export function BigQueryExportView({ team }: { team: string }) {
  const [stopped, setStopped] = useState<BigQueryExportStop | null>(null);
  const [started, setStarted] = useState(false);
  // Only a retry the user starts shows a spinner, not the background polling.
  const [retrying, setRetrying] = useState(false);
  const query = useQuery({
    queryKey: bigQueryExportQueryKey(team),
    queryFn: () => getBigQueryExport({ data: { team } }),
    refetchInterval: (current) => pollInterval(current.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const loadRetryButton = useFocusAfterLoading(query.isFetching);
  const refreshRetryButton = useFocusAfterLoading(retrying);
  if (query.isPending)
    return (
      <HStack gap="space-12" align="center">
        <Loader size="medium" title="Henter BigQuery-eksporten" />
        <BodyShort>Henter BigQuery-eksporten …</BodyShort>
      </HStack>
    );
  if (!query.data)
    return (
      <Alert variant="error" role="alert">
        <VStack gap="space-8" align="start">
          Lumi fikk ikke hentet BigQuery-eksporten for teamet.
          <Button
            ref={loadRetryButton.ref}
            type="button"
            size="small"
            variant="tertiary"
            onClick={() => {
              loadRetryButton.remember();
              void query.refetch();
            }}
            loading={query.isFetching}
          >
            Prøv igjen
          </Button>
        </VStack>
      </Alert>
    );

  const status = query.data;
  const stoppedNotice = stopped && <StoppedNotice result={stopped} />;
  const retry = async () => {
    setRetrying(true);
    try {
      await query.refetch();
    } finally {
      setRetrying(false);
    }
  };

  let content: ReactNode;
  if (status.availability === "DISABLED")
    content = (
      <Alert variant="info">
        BigQuery-eksport er ikke slått på i dette miljøet.
      </Alert>
    );
  else if (status.availability === "PILOT_ONLY")
    content = (
      <VStack gap="space-16">
        {stoppedNotice}
        <Alert variant="info">
          <Heading level="2" size="small" spacing>
            BigQuery-eksport er i pilot
          </Heading>
          Team eSyfo og iSyfo tester eksporten først. Skriv i{" "}
          <ExternalLink href={LUMI_SLACK_URL}>#lumi på Slack</ExternalLink> hvis
          teamet vil være med.
        </Alert>
        {status.destination && (
          <StopOnly status={status} team={team} onStopped={setStopped} />
        )}
      </VStack>
    );
  else if (!status.destination)
    content = (
      <VStack gap="space-32">
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
          onStarted={() => {
            setStopped(null);
            setStarted(true);
          }}
        />
      </VStack>
    );
  else
    content = (
      <ActiveExport
        key={`active:${team}`}
        team={team}
        status={status}
        destination={status.destination}
        focusStatus={started}
        onStopped={(result) => {
          setStarted(false);
          setStopped(result);
        }}
      />
    );

  return (
    <div>
      {/* A failed background update keeps the page and says so. */}
      <div aria-live="polite">
        {query.isError && (
          <Box paddingBlock="space-0 space-16">
            <Alert variant="warning" size="small">
              <HStack gap="space-8" align="center" wrap>
                Lumi fikk ikke oppdatert statusen.
                <Button
                  ref={refreshRetryButton.ref}
                  type="button"
                  size="xsmall"
                  variant="tertiary"
                  onClick={() => {
                    refreshRetryButton.remember();
                    void retry();
                  }}
                  loading={retrying}
                >
                  Prøv igjen
                </Button>
              </HStack>
            </Alert>
          </Box>
        )}
      </div>
      {content}
    </div>
  );
}

function StoppedNotice({ result }: { result: BigQueryExportStop }) {
  const ref = useRef<HTMLDivElement>(null);
  // The stop dialog and the button that opened it are gone, so focus moves
  // to the notice that says what happened.
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant={result.tablesRemoved ? "success" : "warning"}
      size="small"
    >
      {result.tablesRemoved
        ? "Eksporten er stoppet, og Lumis tabeller er slettet."
        : "Eksporten er stoppet. Lumi fikk ikke slettet alle tabellene, men de forsvinner av seg selv innen sju dager."}
    </Alert>
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
            Hver natt etter kl. 01 erstatter Lumi tabellene med svar fra de
            siste tolv månedene.
          </List.Item>
          <List.Item>
            Svar du sletter i dashboardet, forsvinner fra BigQuery etter noen
            minutter, når Lumi har kjørt eksporten på nytt.
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
          Nav er behandlingsansvarlig, og teamet har ansvaret for kopien på
          vegne av Nav. Teamet godkjenner tilgang på Datamarkedsplassen.
          Oppdater teamets kopi av etterlevelsesmalen E726 og behandlingen i
          Behandlingskatalogen. Skriv at svarene lagres i BigQuery og deles på
          Datamarkedsplassen, og hva de skal brukes til.
        </BodyLong>
        <ExternalLink href={`${BIGQUERY_GUIDE_URL}#ansvar`}>
          Les guiden før du starter
        </ExternalLink>
      </Box>
    </HGrid>
  );
}

function ActiveExport({
  team,
  status,
  destination,
  focusStatus,
  onStopped,
}: {
  team: string;
  status: BigQueryExportStatus;
  destination: NonNullable<BigQueryExportStatus["destination"]>;
  focusStatus: boolean;
  onStopped: (result: BigQueryExportStop) => void;
}) {
  const queryClient = useQueryClient();
  const [stopOpen, setStopOpen] = useState(false);
  // The stored setting can say free text is on after Lumi has closed it for
  // the team. The next run deletes the table, so the page shows it as off.
  const freeTextOn = destination.includeFreeText && status.freeTextAvailable;
  const run = useMutation({
    mutationFn: () => runBigQueryExport({ data: { team } }),
    retry: false,
    onSuccess: (result) => {
      if (result.ok)
        queryClient.setQueryData(bigQueryExportQueryKey(team), result.value);
    },
  });
  const runError = run.isError
    ? writeErrorText(
        run.error,
        "Lumi fikk ikke startet en ny kjøring. Prøv igjen.",
      )
    : run.data && !run.data.ok
      ? run.data.reason === "limit"
        ? RATE_LIMIT_TEXT
        : "Lumi fikk ikke startet en ny kjøring. Last siden på nytt."
      : null;

  return (
    <VStack gap="space-32">
      <StatusPanel
        team={team}
        status={status}
        destination={destination}
        onRun={() => {
          if (!run.isPending) run.mutate();
        }}
        runPending={run.isPending}
        runError={runError}
        focusHeading={focusStatus}
      />
      {destination.lastSuccessAt && <NextSteps team={team} />}
      <Tables
        includeFreeText={freeTextOn}
        freeTextAvailable={status.freeTextAvailable}
      />
      <ExpansionCard
        aria-label="Innstillinger for BigQuery-eksporten"
        size="small"
      >
        <ExpansionCard.Header>
          <ExpansionCard.Title as="h2" size="small">
            Innstillinger
          </ExpansionCard.Title>
          <ExpansionCard.Description>
            {status.freeTextAvailable
              ? "Bytt datasett, eller slå fritekst av eller på."
              : "Bytt datasett."}
          </ExpansionCard.Description>
        </ExpansionCard.Header>
        <ExpansionCard.Content>
          <DestinationForm
            team={team}
            status={status}
            mode="edit"
            initial={{
              projectId: destination.projectId,
              datasetId: destination.datasetId,
              includeFreeText: freeTextOn,
            }}
          />
        </ExpansionCard.Content>
      </ExpansionCard>
      <div>
        <Button
          type="button"
          variant="secondary"
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

function Tables({
  includeFreeText,
  freeTextAvailable,
}: {
  includeFreeText: boolean;
  freeTextAvailable: boolean;
}) {
  return (
    <VStack gap="space-8">
      <Heading level="2" size="medium">
        Tabellene
      </Heading>
      <BodyShort size="small">
        Hver natt etter kl. 01 erstatter Lumi tabellene med svar fra de siste
        tolv månedene. Svar du sletter i dashboardet, forsvinner fra BigQuery
        etter noen minutter, når Lumi har kjørt eksporten på nytt.
      </BodyShort>
      <List as="ul" size="small">
        <List.Item title="svar">
          Én rad per svarverdi på vurderings- og valgspørsmål, med
          spørsmålstekst og svartekst. Flervalg gir én rad per valgt alternativ.
        </List.Item>
        <List.Item title="innsendinger">
          Én rad per innsending, det dashboardet kaller et svar. Bruk tabellen
          når du teller svar eller regner ut andeler.
        </List.Item>
        <List.Item title="fritekst">
          {includeFreeText
            ? "Fritekstsvar med kjente mønstre for personopplysninger maskert."
            : freeTextAvailable
              ? "Ikke med. Slå det på under Innstillinger hvis teamet trenger fritekst."
              : "Ikke med. Fritekst er ikke åpnet for teamet."}
        </List.Item>
      </List>
      <ExternalLink href={`${BIGQUERY_GUIDE_URL}#kolonner`}>
        Se alle kolonnene
      </ExternalLink>
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
