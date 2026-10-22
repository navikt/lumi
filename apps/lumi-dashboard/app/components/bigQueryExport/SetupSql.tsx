import {
  Alert,
  BodyShort,
  Box,
  CopyButton,
  HStack,
  Label,
  ReadMore,
  VStack,
} from "@navikt/ds-react";
import { useId } from "react";
import { ExternalLinkButton } from "./ExternalLink";
import { bigQueryConsoleUrl, type SetupSqlTarget, setupSql } from "./format";

export type SqlTarget = Omit<SetupSqlTarget, "serviceAccount"> & {
  serviceAccount: string | null | undefined;
};

const MISSING_SERVICE_ACCOUNT =
  "Lumi fant ikke tjenestekontoen sin, så SQL-en kan ikke lages akkurat nå. Last siden på nytt om litt.";

/** The SQL as text that wraps, so it never scrolls sideways on a phone. */
function SqlBlock({ sql }: { sql: string }) {
  const captionId = useId();
  return (
    <VStack
      as="figure"
      gap="space-8"
      aria-labelledby={captionId}
      style={{ margin: 0 }}
    >
      <Label as="figcaption" size="small" id={captionId}>
        SQL for BigQuery
      </Label>
      <Box
        as="pre"
        background="neutral-soft"
        borderWidth="1"
        borderColor="neutral-subtle"
        borderRadius="8"
        padding="space-16"
        style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        <BodyShort as="code" size="small">
          {sql}
        </BodyShort>
      </Box>
    </VStack>
  );
}

function CopySqlButton({
  sql,
  disabled = false,
  describedBy,
  onCopied,
}: {
  sql: string;
  disabled?: boolean;
  describedBy?: string;
  onCopied?: () => void;
}) {
  return (
    <CopyButton
      copyText={sql}
      text="Kopier SQL"
      activeText="SQL kopiert"
      size="small"
      data-color="accent"
      disabled={disabled}
      aria-describedby={describedBy}
      onActiveChange={(active) => {
        if (active) onCopied?.();
      }}
    />
  );
}

/** The setup SQL with buttons to copy it and open BigQuery. */
export function SetupSql({
  target,
  inputsValid,
  onCopied,
}: {
  target: SqlTarget;
  inputsValid: boolean;
  onCopied?: () => void;
}) {
  const hintId = useId();
  if (!target.serviceAccount) {
    return (
      <Alert variant="warning" size="small">
        {MISSING_SERVICE_ACCOUNT}
      </Alert>
    );
  }
  const sql = setupSql({
    ...target,
    projectId: target.projectId || "teamets-prosjekt",
    datasetId: target.datasetId || "lumi",
    serviceAccount: target.serviceAccount,
  });
  return (
    <VStack gap="space-12">
      <SqlBlock sql={sql} />
      <HStack gap="space-8" align="center" wrap>
        <CopySqlButton
          sql={sql}
          disabled={!inputsValid}
          describedBy={inputsValid ? undefined : hintId}
          onCopied={onCopied}
        />
        <ExternalLinkButton
          href={
            inputsValid
              ? bigQueryConsoleUrl(target.projectId)
              : "https://console.cloud.google.com/bigquery"
          }
        >
          Åpne BigQuery
        </ExternalLinkButton>
      </HStack>
      {!inputsValid && (
        <BodyShort size="small" textColor="subtle" id={hintId}>
          Fyll inn GCP-prosjekt og datasett for å kopiere SQL-en.
        </BodyShort>
      )}
    </VStack>
  );
}

/**
 * The same SQL for a problem it fixes: buttons first, the text behind
 * «Vis SQL-en» so the problem list stays short.
 */
export function CompactSetupSql({ target }: { target: SqlTarget }) {
  if (!target.serviceAccount)
    return <BodyShort size="small">{MISSING_SERVICE_ACCOUNT}</BodyShort>;
  const sql = setupSql({ ...target, serviceAccount: target.serviceAccount });
  return (
    <VStack gap="space-8">
      <HStack gap="space-8" align="center" wrap>
        <CopySqlButton sql={sql} />
        <ExternalLinkButton href={bigQueryConsoleUrl(target.projectId)}>
          Åpne BigQuery
        </ExternalLinkButton>
      </HStack>
      <ReadMore header="Vis SQL-en" size="small">
        <SqlBlock sql={sql} />
      </ReadMore>
    </VStack>
  );
}
