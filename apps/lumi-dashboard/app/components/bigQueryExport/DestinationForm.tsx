import {
  Alert,
  BodyLong,
  BodyShort,
  Button,
  Checkbox,
  HGrid,
  InlineMessage,
  Process,
  ReadMore,
  TextField,
  VStack,
} from "@navikt/ds-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  saveBigQueryExport,
  verifyBigQueryExport,
} from "~/server/actions/bigQueryExport";
import {
  BIGQUERY_DATASET_ID_PATTERN,
  type BigQueryExportFailureReason,
  type BigQueryExportResult,
  type BigQueryExportStatus,
  type BigQueryExportVerification,
  GCP_PROJECT_ID_PATTERN,
} from "~/types/bigQueryExport";
import { writeErrorText } from "~/utils/publicDemo";
import { ProblemList } from "./ProblemList";
import { SetupSql } from "./SetupSql";

const FAILURE_TEXTS: Record<BigQueryExportFailureReason, string> = {
  unavailable:
    "BigQuery-eksport er ikke tilgjengelig for teamet. Last siden på nytt.",
  "not-configured": "Teamet har ikke satt opp BigQuery-eksport.",
  "invalid-input": "Sjekk at prosjekt og datasett er skrevet riktig.",
  limit:
    "Du har gjort mange endringer på kort tid. Vent et minutt og prøv igjen.",
  problems: "Lumi kan ikke bruke datasettet ennå.",
};

export interface DestinationValues {
  projectId: string;
  datasetId: string;
  includeFreeText: boolean;
}

type Mode = "setup" | "edit";

export function DestinationForm({
  team,
  status,
  initial,
  mode,
}: {
  team: string;
  status: BigQueryExportStatus;
  initial: DestinationValues;
  mode: Mode;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const target = `${values.projectId}|${values.datasetId}`;
  const projectError = GCP_PROJECT_ID_PATTERN.test(values.projectId)
    ? undefined
    : "Skriv ID-en til GCP-prosjektet, for eksempel team-esyfo-prod-1a2b.";
  const datasetError = BIGQUERY_DATASET_ID_PATTERN.test(values.datasetId)
    ? undefined
    : "Bruk bare bokstaver, tall og understrek, høyst 100 tegn.";
  const inputsValid = !projectError && !datasetError;

  const verify = useMutation({
    mutationFn: (checked: { projectId: string; datasetId: string }) =>
      verifyBigQueryExport({ data: { team, ...checked } }),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (saved: DestinationValues) =>
      saveBigQueryExport({ data: { team, ...saved } }),
    retry: false,
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(["bigquery-export", team], result.value);
        void queryClient.invalidateQueries({
          queryKey: ["bigquery-export", team],
        });
      }
    },
  });

  const verifiedFor =
    verify.variables &&
    `${verify.variables.projectId}|${verify.variables.datasetId}`;
  const verification = verifiedFor === target ? verify : undefined;
  const verifiedOk =
    verification?.data?.ok === true && verification.data.value.ok;
  const savedFor =
    save.variables && `${save.variables.projectId}|${save.variables.datasetId}`;
  const saveResult = savedFor === target ? save : undefined;
  const changed =
    values.projectId !== initial.projectId ||
    values.datasetId !== initial.datasetId ||
    values.includeFreeText !== initial.includeFreeText;

  const update = (next: Partial<DestinationValues>) =>
    setValues((current) => ({ ...current, ...next }));

  const runCheck = () => {
    setShowErrors(true);
    if (!inputsValid) return;
    verify.mutate({ projectId: values.projectId, datasetId: values.datasetId });
  };
  const submit = () => {
    setShowErrors(true);
    if (!inputsValid) return;
    save.mutate(values);
  };

  const fields = (
    <HGrid columns={{ xs: 1, md: 2 }} gap="space-16">
      <TextField
        label="GCP-prosjekt"
        description={
          status.suggestedProjectId
            ? "Teamets prosjekt i Nais er fylt inn."
            : "Prosjekt-ID-en står i Nais Console under teamet."
        }
        value={values.projectId}
        onChange={(event) => update({ projectId: event.target.value.trim() })}
        error={showErrors ? projectError : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <TextField
        label="Datasett"
        description="Et eget datasett bare for Lumi."
        value={values.datasetId}
        onChange={(event) => update({ datasetId: event.target.value.trim() })}
        error={showErrors ? datasetError : undefined}
        autoComplete="off"
        spellCheck={false}
      />
    </HGrid>
  );

  const sql = (
    <SetupSql
      projectId={values.projectId}
      datasetId={values.datasetId}
      team={team}
      serviceAccount={status.serviceAccount}
      location={status.location}
      inputsValid={inputsValid}
    />
  );

  const verificationResult = verification && (
    <VerificationResult
      mutation={verification}
      team={team}
      location={status.location}
    />
  );

  const freeText = (
    <VStack gap="space-8">
      <Checkbox
        checked={values.includeFreeText}
        onChange={(event) => update({ includeFreeText: event.target.checked })}
        description="Fritekst havner i en egen tabell, fritekst. Lumi maskerer kjente mønstre som fødselsnummer og e-post, men ikke navn."
      >
        Ta med fritekstsvar
      </Checkbox>
      {values.includeFreeText && (
        <InlineMessage status="warning" size="small">
          Sjekk at behandlingen i Behandlingskatalogen dekker fritekst før dere
          deler tabellen med flere.
        </InlineMessage>
      )}
    </VStack>
  );

  const saveFeedback = saveResult && (
    <SaveResult mutation={saveResult} team={team} location={status.location} />
  );

  if (mode === "edit") {
    return (
      <VStack gap="space-16">
        {fields}
        <ReadMore header="Vis SQL for et nytt datasett" size="small">
          {sql}
        </ReadMore>
        {freeText}
        <div>
          <Button
            type="button"
            size="small"
            onClick={submit}
            loading={save.isPending}
            disabled={!changed}
          >
            Lagre endringer
          </Button>
        </div>
        {saveFeedback}
      </VStack>
    );
  }

  return (
    <Process aria-label="Slik setter dere opp BigQuery-eksporten">
      <Process.Event
        title="Opprett datasettet"
        bullet={1}
        status={verifiedOk ? "completed" : "active"}
      >
        <VStack gap="space-16">
          <BodyLong size="small">
            Kjør SQL-en i BigQuery i teamets prosjekt. Den lager datasettet i{" "}
            {status.location}, merker det med teamet og gir Lumi skrivetilgang
            til dette datasettet. Lumi får ingen tilgang til resten av
            prosjektet.
          </BodyLong>
          {fields}
          {sql}
        </VStack>
      </Process.Event>
      <Process.Event
        title="Sjekk tilkoblingen"
        bullet={2}
        status={verifiedOk ? "completed" : "uncompleted"}
      >
        <VStack gap="space-12">
          <BodyShort size="small">
            Lumi sjekker at prosjektet tilhører teamet, at datasettet har riktig
            region og label, og at Lumi kan lage tabeller i det.
          </BodyShort>
          <div>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={runCheck}
              loading={verify.isPending}
            >
              Sjekk tilkoblingen
            </Button>
          </div>
          {verificationResult}
        </VStack>
      </Process.Event>
      <Process.Event
        title="Velg innhold og start"
        bullet={3}
        status={verifiedOk ? "active" : "uncompleted"}
      >
        <VStack gap="space-16">
          <BodyShort size="small">
            Svar på vurderings- og valgspørsmål er alltid med. URL, nettleser,
            skjermstørrelse og Lumis interne ID-er er aldri med.
          </BodyShort>
          {freeText}
          <div>
            <Button type="button" onClick={submit} loading={save.isPending}>
              Start eksporten
            </Button>
          </div>
          {saveFeedback}
        </VStack>
      </Process.Event>
    </Process>
  );
}

interface MutationView<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: BigQueryExportResult<T> | undefined;
}

function VerificationResult({
  mutation,
  team,
  location,
}: {
  mutation: MutationView<BigQueryExportVerification>;
  team: string;
  location: string;
}) {
  if (mutation.isPending) return null;
  if (mutation.isError)
    return (
      <Alert variant="error" size="small">
        {writeErrorText(
          mutation.error,
          "Lumi fikk ikke sjekket tilkoblingen. Prøv igjen.",
        )}
      </Alert>
    );
  const result = mutation.data;
  if (!result) return null;
  if (!result.ok)
    return (
      <Alert variant="error" size="small">
        {FAILURE_TEXTS[result.reason]}
      </Alert>
    );
  if (result.value.ok)
    return (
      <InlineMessage status="success" size="small">
        Alt er klart. Lumi kan lage tabeller i datasettet.
      </InlineMessage>
    );
  return (
    <ProblemList
      problems={result.value.problems}
      team={team}
      location={location}
      heading="Dette må ordnes først"
    />
  );
}

function SaveResult({
  mutation,
  team,
  location,
}: {
  mutation: MutationView<BigQueryExportStatus>;
  team: string;
  location: string;
}) {
  if (mutation.isPending) return null;
  if (mutation.isError)
    return (
      <Alert variant="error" size="small">
        {writeErrorText(
          mutation.error,
          "Lumi fikk ikke lagret innstillingene. Prøv igjen.",
        )}
      </Alert>
    );
  const result = mutation.data;
  if (!result) return null;
  if (result.ok)
    return (
      <InlineMessage status="success" size="small">
        Lagret. Lumi oppdaterer tabellene nå.
      </InlineMessage>
    );
  if (result.reason === "problems" && result.problems?.length)
    return (
      <ProblemList
        problems={result.problems}
        team={team}
        location={location}
        heading="Lumi kan ikke bruke datasettet ennå"
      />
    );
  return (
    <Alert variant="error" size="small">
      {FAILURE_TEXTS[result.reason]}
    </Alert>
  );
}
