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
import styles from "./BigQueryExportView.module.css";
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
const STOPPING_HEADING = "Lumi stopper eksporten";
const STOPPED_LATER_TEXT = "Eksporten er stoppet.";

/**
 * Polls while a run or a stop is busy. A queued run that waits for the
 * previous run's cooldown is polled less often until it is about to start.
 */
function pollInterval(
  status: BigQueryExportStatus | undefined,
  now: number = Date.now(),
): number | false {
  // Nothing runs or finishes a stop while the export is off.
  if (status?.availability === "DISABLED") return false;
  const destination = status?.destination;
  if (destination?.stopping || destination?.runState === "RUNNING")
    return POLL_WHILE_BUSY_MS;
  if (destination?.runState !== "QUEUED") return false;
  const startsAt = Date.parse(destination.nextScheduledRunAt ?? "");
  return startsAt - now > 60_000 ? POLL_WHILE_WAITING_MS : POLL_WHILE_BUSY_MS;
}

/**
 * Where a stop is. A stop Lumi finishes later, for example after a run, is
 * stopping until the export is gone. The page can then say that it is done,
 * also when it was opened while the stop was going on.
 */
type StopState =
  | { phase: "none" }
  | { phase: "stopping"; byUser: boolean }
  | { phase: "stopped"; tablesRemoved: boolean };

const NO_STOP: StopState = { phase: "none" };

/** Focus is lost when the element that had it is gone. */
function focusIsLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}

export function BigQueryExportView({ team }: { team: string }) {
  const [stop, setStop] = useState<StopState>(NO_STOP);
  // Read out when a notice appears while focus is somewhere else.
  const [announcement, setAnnouncement] = useState("");
  const [started, setStarted] = useState(false);
  // False while the page shows the status for the first time. A notice that
  // appears later replaces something the user saw.
  const [shown, setShown] = useState(false);
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
  const destinationState = !query.data?.destination
    ? "none"
    : query.data.destination.stopping
      ? "stopping"
      : "active";
  useEffect(() => {
    if (query.data) setShown(true);
  }, [query.data]);
  // The status shows a stop also when it was not made on this page, and a new
  // export that someone has set up ends what the page said about the old one.
  useEffect(() => {
    if (destinationState === "stopping")
      setStop((current) =>
        current.phase === "stopping"
          ? current
          : { phase: "stopping", byUser: false },
      );
    else if (destinationState === "active") setStop(NO_STOP);
  }, [destinationState]);
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
  const stoppedNotice =
    !status.destination &&
    (stop.phase === "stopped" ? (
      <StoppedNotice
        tablesRemoved={stop.tablesRemoved}
        announce={setAnnouncement}
      />
    ) : stop.phase === "stopping" ? (
      <StoppedNotice tablesRemoved={null} announce={setAnnouncement} />
    ) : null);
  const onStopped = (result: BigQueryExportStop) =>
    setStop(
      result.stopping
        ? { phase: "stopping", byUser: true }
        : { phase: "stopped", tablesRemoved: result.tablesRemoved },
    );
  const stopping = status.destination?.stopping ? (
    <StoppingNotice
      datasetName={`${status.destination.projectId}.${status.destination.datasetId}`}
      focus={stop.phase === "stopping" && stop.byUser}
      afterLoad={shown}
      announce={setAnnouncement}
    />
  ) : null;
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
        {stopping ??
          (status.destination && (
            <StopOnly status={status} team={team} onStopped={onStopped} />
          ))}
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
            setStop(NO_STOP);
            setAnnouncement("");
            setStarted(true);
          }}
        />
      </VStack>
    );
  else if (stopping) content = stopping;
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
          onStopped(result);
        }}
      />
    );

  return (
    <div>
      <span role="status" className={styles.srOnly}>
        {announcement}
      </span>
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

/**
 * Says how a stop ended. Null tablesRemoved: Lumi finished the stop later,
 * and the page did not get the result.
 */
function StoppedNotice({
  tablesRemoved,
  announce,
}: {
  tablesRemoved: boolean | null;
  announce: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const atMount = useRef({ tablesRemoved, announce });
  // After the stop dialog, the dialog and the button that opened it are
  // gone, so focus moves to the notice. A stop Lumi finished later takes
  // focus only if it went with the notice about the stop, and is read out
  // when focus is somewhere else.
  useEffect(() => {
    const { tablesRemoved, announce } = atMount.current;
    if (tablesRemoved !== null || focusIsLost()) ref.current?.focus();
    else announce(STOPPED_LATER_TEXT);
  }, []);
  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant={tablesRemoved === false ? "warning" : "success"}
      size="small"
    >
      {tablesRemoved === null
        ? STOPPED_LATER_TEXT
        : tablesRemoved
          ? "Eksporten er stoppet, og Lumis tabeller er slettet."
          : "Eksporten er stoppet. Lumi fikk ikke slettet alle tabellene, men de forsvinner av seg selv innen sju dager."}
    </Alert>
  );
}

/** Shown until Lumi has finished a stop, for example after a run. */
function StoppingNotice({
  datasetName,
  focus,
  afterLoad,
  announce,
}: {
  datasetName: string;
  /** The user has just stopped the export on this page. */
  focus: boolean;
  /** The notice replaced what the page showed, for example after a poll. */
  afterLoad: boolean;
  announce: (text: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const atMount = useRef({ afterLoad, announce });
  // When the stop dialog closes, or the notice replaces the export the user
  // was working with, the heading takes focus so it is not lost. The status
  // can show the stop before the dialog has the answer, so the answer moves
  // focus too. Focus somewhere else stays, and the notice is read out.
  useEffect(() => {
    const { afterLoad, announce } = atMount.current;
    if (focus || (afterLoad && focusIsLost())) headingRef.current?.focus();
    else if (afterLoad) announce(`${STOPPING_HEADING}.`);
  }, [focus]);
  return (
    <Alert variant="info">
      <Heading ref={headingRef} tabIndex={-1} level="2" size="small" spacing>
        {STOPPING_HEADING}
      </Heading>
      <BodyLong>
        Lumi starter ingen nye kjøringer og sletter tabellene i{" "}
        <code style={{ overflowWrap: "anywhere" }}>{datasetName}</code> så snart
        det går. Det tar som regel noen minutter. Du kan lukke siden.
      </BodyLong>
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
      // Someone may have stopped the export. The page then shows the stop.
      else if (
        result.reason === "unavailable" ||
        result.reason === "not-configured"
      )
        void queryClient.invalidateQueries({
          queryKey: bigQueryExportQueryKey(team),
        });
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
        : "Lumi kan ikke starte en ny kjøring nå."
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
        Teamet har fortsatt en eksport til{" "}
        <code style={{ overflowWrap: "anywhere" }}>{datasetName}</code>, men
        Lumi oppdaterer den ikke lenger.
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
