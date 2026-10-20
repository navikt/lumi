import { ArrowsCirclepathIcon, ExternalLinkIcon } from "@navikt/aksel-icons";
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
import type { ReactNode } from "react";
import type {
  BigQueryExportDestination,
  BigQueryExportStatus,
} from "~/types/bigQueryExport";
import {
  bigQueryConsoleUrl,
  formatTimestamp,
  nextRunText,
  rowSummary,
} from "./format";
import { ProblemList } from "./ProblemList";

type RunView = {
  label: string;
  tag: ReactNode;
};

function runView(destination: BigQueryExportDestination): RunView {
  if (destination.runState === "RUNNING")
    return {
      label: "Lumi oppdaterer tabellene nå",
      tag: <Tag variant="info">Oppdaterer</Tag>,
    };
  if (destination.runState === "QUEUED")
    return {
      label: "Kjøringen starter om litt",
      tag: (
        <Tag data-color="neutral" variant="outline">
          I kø
        </Tag>
      ),
    };
  if (destination.lastRun?.status === "FAILED")
    return {
      label: "Siste kjøring feilet",
      tag: <Tag variant="error">Feilet</Tag>,
    };
  if (destination.lastSuccessAt)
    return {
      label: "Tabellene er oppdatert",
      tag: <Tag variant="success">Aktiv</Tag>,
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
  runMessage,
}: {
  team: string;
  status: BigQueryExportStatus;
  destination: BigQueryExportDestination;
  onRun: () => void;
  runPending: boolean;
  runMessage: ReactNode;
}) {
  const view = runView(destination);
  const busy =
    destination.runState === "RUNNING" || destination.runState === "QUEUED";
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
          <VStack gap="space-4" role="status" aria-live="polite">
            <Detail>BIGQUERY-EKSPORT</Detail>
            <Heading level="2" size="medium">
              {view.label}
            </Heading>
          </VStack>
          {view.tag}
        </HStack>

        {failedCode && (
          <ProblemList
            problems={[{ code: failedCode }]}
            team={team}
            location={status.location}
            heading="Dette stoppet siste kjøring"
          />
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

        <HStack gap="space-8" wrap>
          <Button
            type="button"
            size="small"
            variant="secondary"
            icon={<ArrowsCirclepathIcon aria-hidden />}
            onClick={onRun}
            loading={runPending}
            disabled={busy}
          >
            Oppdater nå
          </Button>
          <Button
            as="a"
            href={bigQueryConsoleUrl(
              destination.projectId,
              destination.datasetId,
            )}
            target="_blank"
            rel="noreferrer"
            size="small"
            variant="tertiary"
            icon={<ExternalLinkIcon aria-hidden />}
            iconPosition="right"
          >
            Åpne datasettet i BigQuery
          </Button>
        </HStack>
        {runMessage}
        {destination.includeFreeText && (
          <Alert variant="info" size="small">
            Fritekstsvar er med i tabellen fritekst. Del den bare med personer
            som trenger å lese tekstene.
          </Alert>
        )}
      </VStack>
    </Box>
  );
}
