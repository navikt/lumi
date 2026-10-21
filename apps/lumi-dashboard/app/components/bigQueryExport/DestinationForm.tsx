import {
  BodyLong,
  BodyShort,
  Button,
  Checkbox,
  Heading,
  HGrid,
  HStack,
  InlineMessage,
  Process,
  ReadMore,
  TextField,
  VStack,
} from "@navikt/ds-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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
import { ExternalLink } from "./ExternalLink";
import { ActionFeedback, LiveRegion } from "./Feedback";
import { LUMI_SLACK_URL, RATE_LIMIT_TEXT } from "./format";
import { ProblemList } from "./ProblemList";
import { bigQueryExportQueryKey } from "./queryKey";
import { SetupSql, type SqlTarget } from "./SetupSql";

const FAILURE_TEXTS: Record<BigQueryExportFailureReason, string> = {
  unavailable:
    "BigQuery-eksport er ikke tilgjengelig for teamet. Last siden på nytt.",
  "not-configured": "Teamet har ikke satt opp BigQuery-eksport.",
  "invalid-input": "Sjekk at prosjekt og datasett er skrevet riktig.",
  limit: RATE_LIMIT_TEXT,
  problems: "Datasettet må ordnes før Lumi kan bruke det.",
};

export interface DestinationValues {
  projectId: string;
  datasetId: string;
  includeFreeText: boolean;
}

type Mode = "setup" | "edit";

function sameValues(a: DestinationValues, b: DestinationValues): boolean {
  return (
    a.projectId === b.projectId &&
    a.datasetId === b.datasetId &&
    a.includeFreeText === b.includeFreeText
  );
}

function valuesKey(values: DestinationValues): string {
  return `${values.projectId}|${values.datasetId}|${values.includeFreeText}`;
}

export function DestinationForm({
  team,
  status,
  initial,
  mode,
  onStarted,
}: {
  team: string;
  status: BigQueryExportStatus;
  /** The saved destination when editing, otherwise the suggested values. */
  initial: DestinationValues;
  mode: Mode;
  /** Called when «Start eksporten» has saved the destination. */
  onStarted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(initial);
  // Follow the saved destination when it changes outside this form, as long
  // as the user has not edited the form.
  const [synced, setSynced] = useState(initial);
  if (!sameValues(initial, synced)) {
    setSynced(initial);
    if (sameValues(values, synced)) setValues(initial);
  }
  const [touched, setTouched] = useState({
    projectId: false,
    datasetId: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [sqlOpen, setSqlOpen] = useState(false);
  const projectRef = useRef<HTMLInputElement>(null);
  const datasetRef = useRef<HTMLInputElement>(null);
  const savedMessageRef = useRef<HTMLDivElement>(null);
  const focusedSave = useRef<unknown>(null);
  const headingId = useId();
  const warningId = useId();

  const target = `${values.projectId}|${values.datasetId}`;
  const datasetChanged =
    values.projectId !== initial.projectId ||
    values.datasetId !== initial.datasetId;
  const projectError = GCP_PROJECT_ID_PATTERN.test(values.projectId)
    ? undefined
    : "Skriv ID-en til GCP-prosjektet, for eksempel team-esyfo-prod-1a2b.";
  const datasetError = BIGQUERY_DATASET_ID_PATTERN.test(values.datasetId)
    ? undefined
    : "Bruk bare bokstaver, tall og understrek, høyst 100 tegn.";
  const inputsValid = !projectError && !datasetError;
  // The API refuses free text the team may not export, also when an
  // existing destination still has it. Saving then turns it off.
  const includeFreeText = status.freeTextAvailable && values.includeFreeText;
  const next: DestinationValues = {
    projectId: values.projectId,
    datasetId: values.datasetId,
    includeFreeText,
  };
  const sqlTarget: SqlTarget = {
    projectId: values.projectId,
    datasetId: values.datasetId,
    team,
    serviceAccount: status.serviceAccount,
    location: status.location,
  };

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
      if (!result.ok) return;
      if (mode === "setup") onStarted?.();
      queryClient.setQueryData(bigQueryExportQueryKey(team), result.value);
      void queryClient.invalidateQueries({
        queryKey: bigQueryExportQueryKey(team),
      });
    },
  });

  const verifiedFor =
    verify.variables &&
    `${verify.variables.projectId}|${verify.variables.datasetId}`;
  const verification = verifiedFor === target ? verify : undefined;
  const verifiedOk =
    verification?.data?.ok === true && verification.data.value.ok;
  const saveResult =
    save.variables && valuesKey(save.variables) === valuesKey(next)
      ? save
      : undefined;

  // A new dataset must be created before it is saved, so the SQL opens.
  useEffect(() => {
    if (mode === "edit" && datasetChanged) setSqlOpen(true);
  }, [mode, datasetChanged]);

  // The save button turns disabled when nothing is left to save. Move focus
  // to the confirmation so it is not lost.
  useEffect(() => {
    if (mode !== "edit" || !save.data?.ok || focusedSave.current === save.data)
      return;
    focusedSave.current = save.data;
    savedMessageRef.current?.focus();
  }, [mode, save.data]);

  const update = (changes: Partial<DestinationValues>) =>
    setValues((current) => ({ ...current, ...changes }));

  const focusFirstInvalidField = () => {
    if (projectError) projectRef.current?.focus();
    else if (datasetError) datasetRef.current?.focus();
  };
  const runCheck = () => {
    setSubmitted(true);
    if (!inputsValid) return focusFirstInvalidField();
    if (verify.isPending) return;
    save.reset();
    verify.mutate({ projectId: values.projectId, datasetId: values.datasetId });
  };
  const submit = () => {
    setSubmitted(true);
    if (!inputsValid) return focusFirstInvalidField();
    if (save.isPending) return;
    verify.reset();
    save.mutate(next);
  };

  const fields = (
    <HGrid columns={{ xs: 1, md: 2 }} gap="space-16">
      <TextField
        ref={projectRef}
        label="GCP-prosjekt"
        description={
          status.suggestedProjectId
            ? "Teamets prosjekt i Nais er fylt inn."
            : "Prosjekt-ID-en står i Nais Console under teamet."
        }
        value={values.projectId}
        onChange={(event) => update({ projectId: event.target.value.trim() })}
        onBlur={() =>
          setTouched((current) => ({ ...current, projectId: true }))
        }
        error={touched.projectId || submitted ? projectError : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <TextField
        ref={datasetRef}
        label="Datasett"
        description="Et eget datasett bare for Lumi."
        value={values.datasetId}
        onChange={(event) => update({ datasetId: event.target.value.trim() })}
        onBlur={() =>
          setTouched((current) => ({ ...current, datasetId: true }))
        }
        error={touched.datasetId || submitted ? datasetError : undefined}
        autoComplete="off"
        spellCheck={false}
      />
    </HGrid>
  );

  const sql = (
    <SetupSql
      target={sqlTarget}
      inputsValid={inputsValid}
      onCopied={() => setCopiedFor(target)}
    />
  );

  const freeText = status.freeTextAvailable ? (
    <div>
      <Checkbox
        checked={values.includeFreeText}
        onChange={(event) => update({ includeFreeText: event.target.checked })}
        description="Fritekstsvarene legges i en egen tabell, fritekst. De kan inneholde navn, helseopplysninger og annet brukerne har skrevet, og Lumi maskerer bare kjente mønstre som fødselsnummer."
      >
        Ta med fritekstsvar
      </Checkbox>
      <LiveRegion gap="space-8">
        {values.includeFreeText && (
          <InlineMessage status="warning" size="small">
            Tabellen fritekst skal ikke deles utenfor teamet. Sjekk at PVK-en og
            behandlingen i Behandlingskatalogen dekker fritekst.
          </InlineMessage>
        )}
      </LiveRegion>
    </div>
  ) : (
    <BodyShort size="small">
      Fritekst kan ikke eksporteres for teamet ennå. Ta kontakt i{" "}
      <ExternalLink href={LUMI_SLACK_URL}>#lumi</ExternalLink> hvis teamet
      trenger fritekst og har en PVK som dekker fritekst i BigQuery.
    </BodyShort>
  );

  const verificationFeedback = feedbackForVerification(verification, sqlTarget);
  const saveFeedback = feedbackForSave(saveResult, {
    mode,
    target: sqlTarget,
    savedMessageRef,
  });

  if (mode === "edit") {
    const changed =
      datasetChanged || includeFreeText !== initial.includeFreeText;
    const deleteWarning = datasetChanged
      ? `Når du lagrer, sletter Lumi tabellene i ${initial.projectId}.${initial.datasetId}. Views, dataprodukter, Metabase-spørsmål og datafortellinger som bruker dem, slutter å virke.`
      : initial.includeFreeText && !includeFreeText
        ? "Når du lagrer, sletter Lumi tabellen fritekst."
        : null;

    return (
      <VStack gap="space-16">
        {fields}
        {datasetChanged && (
          <BodyShort size="small">
            Kjør SQL-en for det nye datasettet i BigQuery før du lagrer.
          </BodyShort>
        )}
        <ReadMore
          header="Vis SQL-en"
          size="small"
          open={sqlOpen}
          onOpenChange={setSqlOpen}
        >
          {sql}
        </ReadMore>
        {freeText}
        {deleteWarning && (
          <InlineMessage status="warning" size="small" id={warningId}>
            {deleteWarning}
          </InlineMessage>
        )}
        <div>
          <Button
            type="button"
            size="small"
            onClick={submit}
            loading={save.isPending}
            // Stays focusable while it saves; disabled only with nothing to save.
            disabled={!changed}
            aria-describedby={deleteWarning ? warningId : undefined}
          >
            Lagre endringer
          </Button>
          <ActionFeedback
            result={saveFeedback.result}
            error={saveFeedback.error}
          />
          {/* Focused when it appears, so it is not also put in a live region. */}
          {saveFeedback.focused}
        </div>
      </VStack>
    );
  }

  // Step 2 is where the user is once the SQL is copied or the dataset checked.
  const atCheck = copiedFor === target || verification !== undefined;
  return (
    <VStack gap="space-16">
      <Heading level="2" size="medium" id={headingId}>
        Sett opp eksporten
      </Heading>
      <Process aria-labelledby={headingId}>
        <Process.Event
          title="Opprett datasettet"
          bullet={1}
          status={verifiedOk || atCheck ? "completed" : "active"}
        >
          <VStack gap="space-16">
            <VStack gap="space-8">
              <BodyLong size="small">
                Kjør SQL-en i BigQuery i teamets prosjekt. Den lager datasettet
                i {status.location}, merker det med teamet og gir Lumi
                skrivetilgang til dette datasettet. Lumi får ingen tilgang til
                resten av prosjektet.
              </BodyLong>
              <BodyLong size="small">
                Den som kjører SQL-en, må kunne lage datasett og gi tilgang i
                teamets GCP-prosjekt. Send gjerne lenken til denne siden til en
                i teamet som kan det.
              </BodyLong>
            </VStack>
            {fields}
            {sql}
          </VStack>
        </Process.Event>
        <Process.Event
          title="Sjekk tilkoblingen"
          bullet={2}
          status={verifiedOk ? "completed" : atCheck ? "active" : "uncompleted"}
        >
          <VStack gap="space-12">
            <BodyShort size="small">
              Lumi sjekker at prosjektet tilhører teamet, at datasettet har
              riktig region og label, og at Lumi kan lage tabeller i det.
            </BodyShort>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={runCheck}
                loading={verify.isPending}
                // Keep focus on the button while Lumi checks.
                disabled={false}
              >
                Sjekk tilkoblingen
              </Button>
              <ActionFeedback {...verificationFeedback} />
            </div>
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
              skjermstørrelse, tagger fra appen og Lumis interne ID-er er aldri
              med.
            </BodyShort>
            {freeText}
            <div>
              <HStack gap="space-12" align="center" wrap>
                <Button
                  type="button"
                  onClick={submit}
                  loading={save.isPending}
                  // Keep focus on the button while Lumi saves.
                  disabled={false}
                >
                  Start eksporten
                </Button>
                <BodyShort size="small" textColor="subtle">
                  Lumi sjekker tilkoblingen på nytt når du starter.
                </BodyShort>
              </HStack>
              <ActionFeedback
                result={saveFeedback.result}
                error={saveFeedback.error}
              />
            </div>
          </VStack>
        </Process.Event>
      </Process>
    </VStack>
  );
}

interface MutationView<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: BigQueryExportResult<T> | undefined;
}

interface Feedback {
  result?: ReactNode;
  error?: ReactNode;
  /** A result that gets focus when it appears, outside any live region. */
  focused?: ReactNode;
}

function feedbackForVerification(
  mutation: MutationView<BigQueryExportVerification> | undefined,
  target: SqlTarget,
): Feedback {
  if (!mutation || mutation.isPending) return {};
  if (mutation.isError)
    return {
      error: writeErrorText(
        mutation.error,
        "Lumi fikk ikke sjekket tilkoblingen. Prøv igjen.",
      ),
    };
  const result = mutation.data;
  if (!result) return {};
  if (!result.ok) return { error: FAILURE_TEXTS[result.reason] };
  if (result.value.ok)
    return {
      result: (
        <InlineMessage status="success" size="small">
          Datasettet er klart. Lumi kan lage tabeller i det.
        </InlineMessage>
      ),
    };
  return {
    result: (
      <ProblemList
        problems={result.value.problems}
        target={target}
        heading="Dette må ordnes først"
      />
    ),
  };
}

function feedbackForSave(
  mutation: MutationView<BigQueryExportStatus> | undefined,
  {
    mode,
    target,
    savedMessageRef,
  }: {
    mode: Mode;
    target: SqlTarget;
    savedMessageRef: Ref<HTMLDivElement>;
  },
): Feedback {
  if (!mutation || mutation.isPending) return {};
  if (mutation.isError)
    return {
      error: writeErrorText(
        mutation.error,
        mode === "setup"
          ? "Lumi fikk ikke startet eksporten. Prøv igjen."
          : "Lumi fikk ikke lagret endringene. Prøv igjen.",
      ),
    };
  const result = mutation.data;
  if (!result) return {};
  if (result.ok)
    return mode === "edit"
      ? {
          focused: (
            <InlineMessage
              ref={savedMessageRef}
              tabIndex={-1}
              status="success"
              size="small"
            >
              Endringene er lagret. Lumi oppdaterer tabellene i løpet av noen
              minutter.
            </InlineMessage>
          ),
        }
      : {};
  if (result.reason === "problems" && result.problems?.length)
    return {
      result: (
        <ProblemList
          problems={result.problems}
          target={target}
          heading="Dette må ordnes først"
        />
      ),
    };
  return { error: FAILURE_TEXTS[result.reason] };
}
