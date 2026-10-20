import { ExternalLinkIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  CopyButton,
  HStack,
  VStack,
} from "@navikt/ds-react";
import { bigQueryConsoleUrl, setupSql } from "./format";

export function SetupSql({
  projectId,
  datasetId,
  team,
  serviceAccount,
  location,
  inputsValid,
}: {
  projectId: string;
  datasetId: string;
  team: string;
  serviceAccount: string | null | undefined;
  location: string;
  inputsValid: boolean;
}) {
  if (!serviceAccount) {
    return (
      <Alert variant="warning" size="small">
        Lumi fant ikke tjenestekontoen sin, så SQL-en kan ikke lages akkurat nå.
        Last siden på nytt om litt.
      </Alert>
    );
  }
  const sql = setupSql({
    projectId: projectId || "teamets-prosjekt",
    datasetId: datasetId || "lumi",
    team,
    serviceAccount,
    location,
  });
  return (
    <VStack gap="space-12">
      <Box
        as="pre"
        background="neutral-soft"
        borderWidth="1"
        borderColor="neutral-subtle"
        borderRadius="8"
        padding="space-16"
        overflow="auto"
        aria-label="SQL for å opprette datasettet"
      >
        <BodyShort as="code" size="small">
          {sql}
        </BodyShort>
      </Box>
      <HStack gap="space-8" wrap>
        <CopyButton
          copyText={sql}
          text="Kopier SQL"
          activeText="SQL kopiert"
          size="small"
          variant="action"
          disabled={!inputsValid}
        />
        <Button
          as="a"
          href={
            inputsValid
              ? bigQueryConsoleUrl(projectId)
              : "https://console.cloud.google.com/bigquery"
          }
          target="_blank"
          rel="noreferrer"
          variant="secondary"
          size="small"
          icon={<ExternalLinkIcon aria-hidden />}
          iconPosition="right"
        >
          Åpne BigQuery
        </Button>
      </HStack>
    </VStack>
  );
}
