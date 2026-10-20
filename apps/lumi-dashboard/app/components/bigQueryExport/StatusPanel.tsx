import { ArrowsCirclepathIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  CopyButton,
  Detail,
  Heading,
  HGrid,
  HStack,
  Tag,
  VStack,
} from "@navikt/ds-react";
import { type ReactNode, useEffect, useRef } from "react";
import type {
  BigQueryExportDestination,
  BigQueryExportStatus,
} from "~/types/bigQueryExport";
import { ExternalLinkButton } from "./ExternalLink";
import { ActionError } from "./Feedback";
import {
  bigQueryConsoleUrl,
  fixedBySql,
  formatTimestamp,
  nextRunText,
  queuedText,
  rowSummary,
} from "./format";
import { ProblemList } from "./ProblemList";

type RunView = {
  label: string;
  tag: ReactNode;
};

function runView(
  destination: BigQueryExportDestination,
  now: number = Date.now(),
): RunView {
  if (destination.runState === "RUNNING")
    return {
      label: "Lumi oppdaterer tabellene nå",
      tag: (
        <Tag data-color="info" variant="moderate">
          Oppdaterer
        </Tag>
      ),
    };
  if (destination.runState === "QUEUED")
    return {
      label:
        queuedText(destination.nextScheduledRunAt, now) ??
        "Kjøringen starter om litt",
      tag: (
        <Tag data-color="neutral" variant="outline">
          I kø
        </Tag>
      ),
    };
  if (destination.lastRun?.status === "FAILED")
    return {
      label: "Siste kjøring feilet",
      tag: (
        <Tag data-color="danger" variant="moderate">
          Feilet
        </Tag>
      ),
    };
  if (destination.lastSuccessAt)
    return {
      label: "Tabellene er oppdatert",
      tag: (
        <Tag data-color="success" variant="moderate">
          Aktiv
        </Tag>
      ),
    };
  return {
    label: "Venter på første kjøring",
    tag: (
      <Tag data-color="neutral" variant="outline">
        Ikke kjørt ennå
      </Tag>
    ),
  };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <VStack gap="space-4">
      <Detail weight="semibold">{label}</Detail>
      <BodyShort as="div">{children}</BodyShort>
    </VStack>
  );
}

export function StatusPanel({
  team,
  status,
  destination,
  onRun,
  runPending,
  runError,
  focusHeading = false,
}: {
  team: string;
  status: BigQueryExportStatus;
  destination: BigQueryExportDestination;
  onRun: () => void;
  runPending: boolean;
  runError: string | null;
  /** Move focus to the heading when the panel appears, after setup. */
  focusHeading?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Only when the panel appears: it replaces the setup form the user left.
  const focusOnMount = useRef(focusHeading);
  useEffect(() => {
    if (focusOnMount.current) headingRef.current?.focus();
  }, []);

  const view = runView(destination);
  const busy =
    destination.runState === "RUNNING" || destination.runState === "QUEUED";
  // «Oppdater tabellene nå» is disabled once the run is queued. Focus then
  // moves to the status the user asked for, so it is not lost.
  const runRequested = useRef(false);
  useEffect(() => {
    if (!busy || !runRequested.current) return;
    runRequested.current = false;
    headingRef.current?.focus();
  }, [busy]);
  const datasetName = `${destination.projectId}.${destination.datasetId}`;
  const failedCode =
    destination.lastRun?.status === "FAILED"
      ? destination.lastRun.errorCode
      : null;

  return (
    <Box
      background="raised"
      borderWidth="1"
      borderColor="neutral-subtle"
      borderRadius="12"
      padding={{ xs: "space-16", md: "space-24" }}
    >
      <VStack gap="space-20">
        <HStack justify="space-between" align="center" wrap gap="space-12">
          <VStack gap="space-4">
            <Detail>BigQuery-eksport</Detail>
            <div role="status" aria-live="polite">
              <Heading level="2" size="medium" ref={headingRef} tabIndex={-1}>
                {view.label}
              </Heading>
            </div>
          </VStack>
          {view.tag}
        </HStack>

        {failedCode && (
          <ProblemList
            problems={[{ code: failedCode }]}
            target={{
              projectId: destination.projectId,
              datasetId: destination.datasetId,
              team,
              serviceAccount: status.serviceAccount,
              location: status.location,
            }}
            heading="Dette stoppet siste kjøring"
          />
        )}
        {failedCode && fixedBySql(failedCode) && (
          <BodyShort size="small">
            Velg Oppdater tabellene nå når du har kjørt SQL-en.
          </BodyShort>
        )}

        <HGrid columns={{ xs: 1, md: 2 }} gap="space-16">
          <Fact label="Datasett">
            <HStack gap="space-4" align="center" wrap>
              <code style={{ overflowWrap: "anywhere" }}>{datasetName}</code>
              <CopyButton
                copyText={datasetName}
                size="xsmall"
                title="Kopier datasettnavnet"
                activeText="Kopiert"
              />
            </HStack>
          </Fact>
          <Fact label="Innhold">
            {destination.lastSuccessRows
              ? rowSummary(destination.lastSuccessRows)
              : "Ingen tabeller ennå"}
          </Fact>
          <Fact label="Sist oppdatert">
            {formatTimestamp(destination.lastSuccessAt) ?? "Ikke ennå"}
          </Fact>
          <Fact label="Neste kjøring">
            {nextRunText(destination.nextScheduledRunAt) ?? "Ukjent"}
          </Fact>
        </HGrid>

        <div>
          <HStack gap="space-8" wrap>
            <Button
              type="button"
              size="small"
              variant="secondary"
              icon={<ArrowsCirclepathIcon aria-hidden />}
              onClick={() => {
                runRequested.current = true;
                onRun();
              }}
              loading={runPending}
              disabled={busy}
            >
              Oppdater tabellene nå
            </Button>
            <ExternalLinkButton
              href={bigQueryConsoleUrl(
                destination.projectId,
                destination.datasetId,
              )}
              variant="tertiary"
            >
              Åpne datasettet i BigQuery
            </ExternalLinkButton>
          </HStack>
          <ActionError>{runError}</ActionError>
        </div>
        {destination.includeFreeText &&
          (status.freeTextAvailable ? (
            <Alert variant="info" size="small">
              Fritekstsvar er med i tabellen fritekst. Ikke del den utenfor
              teamet.
            </Alert>
          ) : (
            <Alert variant="info" size="small">
              Lumi har stengt fritekst for teamet. Tabellen fritekst blir
              slettet ved neste kjøring.
            </Alert>
          ))}
      </VStack>
    </Box>
  );
}
